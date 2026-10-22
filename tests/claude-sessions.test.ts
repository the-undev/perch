import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deriveClaudeSessions } from "../src/derivations.ts";
import {
  createClaudeSessionsSource,
  encodeProjectPath,
  readLastMessageAt,
  readSessions,
} from "../src/sources/claude-sessions.ts";
import { makeTempDir, removeDir, writeFile } from "./helpers/git-fixture.ts";
import { localPresence } from "./helpers/raw.ts";

let projectsDir: string;
beforeEach(() => {
  projectsDir = makeTempDir();
});
afterEach(() => {
  removeDir(projectsDir);
});

describe("encodeProjectPath", () => {
  it("replaces slashes with hyphens", () => {
    expect(encodeProjectPath("/home/owner/dev/perch")).toBe(
      "-home-owner-dev-perch",
    );
  });

  it("replaces dots too, as Claude Code does for hidden directories", () => {
    expect(encodeProjectPath("/home/owner/.dotfiles")).toBe(
      "-home-owner--dotfiles",
    );
  });
});

const line = (record: object) => `${JSON.stringify(record)}\n`;

describe("readSessions", () => {
  it("lists every transcript with its mtime and reads the newest one's last message", async () => {
    const encoded = encodeProjectPath("/home/owner/dev/perch");
    writeFile(
      projectsDir,
      `${encoded}/a.jsonl`,
      "{}\n",
      new Date("2026-05-01T10:00:00Z"),
    );
    writeFile(
      projectsDir,
      `${encoded}/b.jsonl`,
      line({ type: "user", timestamp: "2026-05-02T09:00:00.000Z" }) +
        line({ type: "assistant", timestamp: "2026-05-02T09:05:00.000Z" }) +
        line({ type: "system", timestamp: "2026-05-03T09:59:00.000Z" }) +
        line({ type: "cost-state" }),
      new Date("2026-05-03T10:00:00Z"),
    );
    writeFile(
      projectsDir,
      `${encoded}/notes.txt`,
      "x\n",
      new Date("2026-05-09T10:00:00Z"),
    );

    expect(await readSessions(projectsDir, "/home/owner/dev/perch")).toEqual({
      directory: encoded,
      transcripts: {
        state: "observed",
        value: [
          { file: "a.jsonl", mtime: "2026-05-01T10:00:00.000Z" },
          { file: "b.jsonl", mtime: "2026-05-03T10:00:00.000Z" },
        ],
      },
      newest: {
        state: "observed",
        value: {
          file: "b.jsonl",
          lastMessageAt: {
            state: "observed",
            value: "2026-05-02T09:05:00.000Z",
          },
        },
      },
    });
  });

  it("finds a message line across chunk boundaries, and states when none exists", async () => {
    const encoded = encodeProjectPath("/work/long");
    const filler = line({ type: "system", padding: "x".repeat(150_000) });
    writeFile(
      projectsDir,
      `${encoded}/long.jsonl`,
      line({ type: "assistant", timestamp: "2026-05-02T09:05:00.000Z" }) +
        filler +
        filler,
    );
    writeFile(
      projectsDir,
      `${encodeProjectPath("/work/bare")}/s.jsonl`,
      line({ type: "bridge-session" }),
    );

    const long = await readSessions(projectsDir, "/work/long");
    const bare = await readSessions(projectsDir, "/work/bare");

    expect(long.newest).toMatchObject({
      value: {
        lastMessageAt: { state: "observed", value: "2026-05-02T09:05:00.000Z" },
      },
    });
    expect(bare.newest).toMatchObject({
      value: { lastMessageAt: { state: "absent", reason: "no-message-line" } },
    });
  });

  it("stops at the tail limit", async () => {
    const encoded = encodeProjectPath("/work/long");
    writeFile(
      projectsDir,
      `${encoded}/long.jsonl`,
      line({ type: "user", timestamp: "2026-05-02T09:05:00.000Z" }) +
        line({ type: "system", padding: "x".repeat(200_000) }),
    );

    expect(
      await readLastMessageAt(
        join(projectsDir, encoded, "long.jsonl"),
        64 * 1024,
      ),
    ).toEqual({
      state: "absent",
      reason: "beyond-tail-limit",
    });
  });

  it("states that a directory without sessions has no project directory", async () => {
    expect(await readSessions(projectsDir, "/home/owner/dev/none")).toEqual({
      directory: "-home-owner-dev-none",
      transcripts: { state: "absent", reason: "no-project-directory" },
      newest: { state: "absent", reason: "no-transcripts" },
    });
  });

  it("gathers an entry for every local presence", async () => {
    writeFile(
      projectsDir,
      join(encodeProjectPath("/work/repo"), "s.jsonl"),
      "{}\n",
    );

    const entries = await createClaudeSessionsSource(projectsDir).gather({
      local: {
        source: "local",
        gatheredAt: "2026-10-21T09:00:00.000Z",
        data: {
          includes: {},
          presences: {
            repo: localPresence("/work/repo", { include: "/work" }),
          },
        },
      },
    });

    expect(Object.keys(entries)).toEqual(["repo"]);
    expect(entries.repo?.state).toBe("observed");
  });
});

describe("deriving the last session", () => {
  const transcripts = {
    state: "observed" as const,
    value: [
      { file: "a.jsonl", mtime: "2026-05-01T10:00:00.000Z" },
      { file: "b.jsonl", mtime: "2026-05-03T10:00:00.000Z" },
    ],
  };

  it("takes the newest transcript's last message time", () => {
    expect(
      deriveClaudeSessions({
        directory: "-x",
        transcripts,
        newest: {
          state: "observed",
          value: {
            file: "b.jsonl",
            lastMessageAt: {
              state: "observed",
              value: "2026-05-02T09:05:00.000Z",
            },
          },
        },
      }),
    ).toEqual({
      lastSessionAt: "2026-05-02T09:05:00.000Z",
      basis: "last-message",
    });
  });

  it("falls back to the newest transcript's mtime when no message line was read", () => {
    expect(
      deriveClaudeSessions({
        directory: "-x",
        transcripts,
        newest: {
          state: "observed",
          value: {
            file: "b.jsonl",
            lastMessageAt: { state: "absent", reason: "no-message-line" },
          },
        },
      }),
    ).toEqual({
      lastSessionAt: "2026-05-03T10:00:00.000Z",
      basis: "file-mtime",
    });
  });

  it("is null without transcripts", () => {
    expect(
      deriveClaudeSessions({
        directory: "-x",
        transcripts: { state: "absent", reason: "no-project-directory" },
        newest: { state: "absent", reason: "no-transcripts" },
      }),
    ).toEqual({ lastSessionAt: null, basis: null });
  });
});
