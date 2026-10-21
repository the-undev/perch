import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deriveClaudeSessions } from "../src/derivations.ts";
import {
  createClaudeSessionsSource,
  encodeProjectPath,
  readSessions,
} from "../src/sources/claude-sessions.ts";
import { makeTempDir, removeDir, writeFile } from "./helpers/git-fixture.ts";

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

describe("readSessions", () => {
  it("lists every transcript with its mtime and ignores other files", async () => {
    const encoded = encodeProjectPath("/home/owner/dev/perch");
    writeFile(
      projectsDir,
      `${encoded}/b.jsonl`,
      "{}\n",
      new Date("2026-05-03T10:00:00Z"),
    );
    writeFile(
      projectsDir,
      `${encoded}/a.jsonl`,
      "{}\n",
      new Date("2026-05-01T10:00:00Z"),
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
    });
  });

  it("states that a directory without sessions has no project directory", async () => {
    expect(await readSessions(projectsDir, "/home/owner/dev/none")).toEqual({
      directory: "-home-owner-dev-none",
      transcripts: { state: "absent", reason: "no-project-directory" },
    });
  });

  it("gathers an entry per item with a path and skips the server", async () => {
    writeFile(
      projectsDir,
      join(encodeProjectPath("/work/repo"), "s.jsonl"),
      "{}\n",
    );

    const entries = await createClaudeSessionsSource(projectsDir).gather(
      [
        { id: "repo", name: "repo", kind: "repo", path: "/work/repo" },
        { id: "server", name: "Silo", kind: "server" },
      ],
      {},
    );

    expect(entries.repo?.state).toBe("observed");
    expect(entries.server).toBeUndefined();
  });
});

describe("deriving the last session", () => {
  it("takes the newest transcript mtime", () => {
    expect(
      deriveClaudeSessions({
        directory: "-x",
        transcripts: {
          state: "observed",
          value: [
            { file: "a.jsonl", mtime: "2026-05-03T10:00:00.000Z" },
            { file: "b.jsonl", mtime: "2026-05-01T10:00:00.000Z" },
          ],
        },
      }),
    ).toEqual({ lastSessionAt: "2026-05-03T10:00:00.000Z" });
  });

  it("is null without a project directory or transcripts", () => {
    expect(
      deriveClaudeSessions({
        directory: "-x",
        transcripts: { state: "absent", reason: "no-project-directory" },
      }),
    ).toEqual({ lastSessionAt: null });
    expect(
      deriveClaudeSessions({
        directory: "-x",
        transcripts: { state: "observed", value: [] },
      }),
    ).toEqual({ lastSessionAt: null });
  });
});
