import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Item } from "../src/snapshot.ts";
import {
  createClaudeSessionsSource,
  encodeProjectPath,
  lastSessionAt,
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

describe("lastSessionAt", () => {
  it("returns the newest transcript mtime and ignores other files", async () => {
    const encoded = encodeProjectPath("/home/owner/dev/perch");
    const newest = new Date("2026-05-03T10:00:00Z");
    writeFile(
      projectsDir,
      `${encoded}/a.jsonl`,
      "{}\n",
      new Date("2026-05-01T10:00:00Z"),
    );
    writeFile(projectsDir, `${encoded}/b.jsonl`, "{}\n", newest);
    writeFile(
      projectsDir,
      `${encoded}/notes.txt`,
      "x\n",
      new Date("2026-05-09T10:00:00Z"),
    );

    expect(await lastSessionAt(projectsDir, "/home/owner/dev/perch")).toEqual(
      newest,
    );
  });

  it("returns null for a directory with no sessions", async () => {
    expect(await lastSessionAt(projectsDir, "/home/owner/dev/none")).toBeNull();
  });
});

describe("claude sessions source", () => {
  it("records a time per item with a path and skips the server", async () => {
    const when = new Date("2026-05-03T10:00:00Z");
    writeFile(
      projectsDir,
      join(encodeProjectPath("/work/repo"), "s.jsonl"),
      "{}\n",
      when,
    );
    const item = (id: string, path: string | null): Item => ({
      id,
      name: id,
      kind: "repo",
      path,
      importance: "projects",
      liveSources: [],
      sources: {},
    });

    const results = await createClaudeSessionsSource(projectsDir).scan([
      item("repo", "/work/repo"),
      item("quiet", "/work/quiet"),
      item("server", null),
    ]);

    expect(results.get("repo")).toEqual({ lastSessionAt: when.toISOString() });
    expect(results.get("quiet")).toEqual({ lastSessionAt: null });
    expect(results.has("server")).toBe(false);
  });
});
