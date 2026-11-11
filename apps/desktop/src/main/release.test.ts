import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  evaluatePreChecks,
  gatherGitState,
  isGreater,
  parseVersion,
} from "../../scripts/release.ts";

describe("parseVersion", () => {
  it("accepts x.y.z", () => {
    expect(parseVersion("1.20.3")).toEqual([1, 20, 3]);
  });

  it.each(["1.2", "v1.2.3", "1.2.3-rc.1", "1.2.3.4", "01.2.3", "a.b.c", ""])(
    "rejects %j",
    (text) => {
      expect(parseVersion(text)).toBeNull();
    },
  );
});

describe("isGreater", () => {
  it("accepts patch, minor and major bumps", () => {
    expect(isGreater([0, 3, 1], [0, 3, 0])).toBe(true);
    expect(isGreater([0, 4, 0], [0, 3, 9])).toBe(true);
    expect(isGreater([1, 0, 0], [0, 9, 9])).toBe(true);
  });

  it("refuses equal and lower versions", () => {
    expect(isGreater([0, 3, 0], [0, 3, 0])).toBe(false);
    expect(isGreater([0, 2, 9], [0, 3, 0])).toBe(false);
    expect(isGreater([0, 3, 0], [1, 0, 0])).toBe(false);
  });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

describe("pre-checks against a git repository", () => {
  let directory: string;
  let clone: string;
  let origin: string;

  const check = (version = "0.4.0") =>
    evaluatePreChecks(version, "0.3.0", gatherGitState(clone, version));

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "perch-release-"));
    origin = join(directory, "origin.git");
    clone = join(directory, "clone");
    mkdirSync(origin);
    git(origin, "init", "--bare", "--initial-branch=main");
    git(directory, "clone", origin, clone);
    git(clone, "config", "user.name", "Test Person");
    git(clone, "config", "user.email", "test@example.invalid");
    git(clone, "switch", "-c", "main");
    writeFileSync(join(clone, "file.txt"), "one\n");
    git(clone, "add", ".");
    git(clone, "commit", "-m", "First");
    git(clone, "push", "-u", "origin", "main");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("passes in the clean case", () => {
    expect(check()).toBeNull();
  });

  it("refuses off main", () => {
    git(clone, "switch", "-c", "feature");
    expect(check()).toContain('current branch is "feature"');
  });

  it("refuses a dirty working tree", () => {
    writeFileSync(join(clone, "file.txt"), "changed\n");
    expect(check()).toContain("uncommitted changes");
  });

  it("refuses when local main is ahead of origin", () => {
    writeFileSync(join(clone, "file.txt"), "two\n");
    git(clone, "commit", "-am", "Second");
    expect(check()).toContain("differs from origin/main");
  });

  it("refuses when local main is behind origin", () => {
    const other = join(directory, "other");
    git(directory, "clone", origin, other);
    git(other, "config", "user.name", "Test Person");
    git(other, "config", "user.email", "test@example.invalid");
    writeFileSync(join(other, "file.txt"), "two\n");
    git(other, "commit", "-am", "Second");
    git(other, "push", "origin", "main");
    expect(check()).toContain("differs from origin/main");
  });

  it("refuses a tag that exists locally", () => {
    git(clone, "tag", "v0.4.0");
    expect(check()).toContain("exists locally");
  });

  it("refuses a tag that exists on origin only", () => {
    git(clone, "tag", "v0.4.0");
    git(clone, "push", "origin", "v0.4.0");
    git(clone, "tag", "-d", "v0.4.0");
    expect(check()).toContain("exists on origin");
  });

  it("refuses a version that is not greater", () => {
    expect(check("0.3.0")).toContain("must be greater");
  });
});
