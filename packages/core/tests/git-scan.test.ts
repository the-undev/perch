import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deriveActivity, deriveDrift, deriveGit } from "../src/derivations.ts";
import { fileMtime } from "../src/fs.ts";
import type { RawCommit, RawGit } from "../src/raw.ts";
import type { HourThresholds } from "../src/snapshot.ts";
import { readRepository } from "../src/sources/git.ts";
import {
  clonedRepo,
  commit,
  fixtureGit,
  git,
  initRepo,
  makeTempDir,
  removeDir,
  writeFile,
} from "./helpers/git-fixture.ts";

const now = new Date("2026-06-01T12:00:00Z");
const daysBefore = (days: number) =>
  new Date(now.getTime() - days * 86_400_000);
const thresholds: HourThresholds = { amberHours: 7 * 24, redHours: 30 * 24 };
const deps = { runGit: fixtureGit, mtimeOf: fileMtime };

let base: string;
beforeEach(() => {
  base = makeTempDir();
});
afterEach(() => {
  removeDir(base);
});

describe("gathering uncommitted changes", () => {
  it("lists modified, staged, untracked and deleted paths with their codes and mtimes", async () => {
    const { clone } = clonedRepo(base, daysBefore(2));
    commit(clone, "gone.txt", "Add a file to delete", daysBefore(2));
    rmSync(join(clone, "gone.txt"));
    writeFile(clone, "README.md", "changed\n", daysBefore(1));
    writeFile(clone, "staged.txt", "new\n", daysBefore(3));
    git(clone, ["add", "staged.txt"]);
    writeFile(clone, "untracked.txt", "untracked\n", daysBefore(4));

    const raw = await readRepository(clone, deps);

    expect(raw.dirtyFiles).toEqual([
      {
        path: "README.md",
        code: ".M",
        mtime: { state: "observed", value: daysBefore(1).toISOString() },
      },
      {
        path: "gone.txt",
        code: ".D",
        mtime: { state: "absent", reason: "file-deleted" },
      },
      {
        path: "staged.txt",
        code: "A.",
        mtime: { state: "observed", value: daysBefore(3).toISOString() },
      },
      {
        path: "untracked.txt",
        code: "??",
        mtime: { state: "observed", value: daysBefore(4).toISOString() },
      },
    ]);
  });
});

describe("gathering branches and tracking", () => {
  it("records ahead and behind on a tracking branch and the commits no remote holds", async () => {
    const { remote, clone } = clonedRepo(base, daysBefore(5));
    const other = join(base, "other");
    git(base, ["clone", "--quiet", remote, other]);
    commit(other, "a.txt", "Remote one", daysBefore(4));
    commit(other, "b.txt", "Remote two", daysBefore(3));
    git(other, ["push", "--quiet", "origin", "main"]);
    commit(clone, "c.txt", "Local one", daysBefore(2));
    git(clone, ["fetch", "--quiet"]);

    const raw = await readRepository(clone, deps);

    expect(raw.head).toEqual({ state: "branch", name: "main" });
    expect(raw.branches[0]?.tracking).toEqual({
      state: "tracking",
      upstream: "origin/main",
      ahead: 1,
      behind: 2,
    });
    expect(
      raw.unpushedCommits.map((entry) => [entry.subject, entry.committedAt]),
    ).toEqual([["Local one", daysBefore(2).toISOString()]]);
    expect(raw.originHead).toEqual({ state: "observed", value: "main" });
    expect(raw.remotes).toEqual({
      state: "observed",
      value: [{ name: "origin", fetchUrl: remote, pushUrls: [remote] }],
    });
  });

  it("gives a reason for a branch with no upstream and one whose upstream is gone", async () => {
    const { clone } = clonedRepo(base, daysBefore(5));
    git(clone, ["switch", "--quiet", "-c", "local-only"]);
    git(clone, ["switch", "--quiet", "-c", "pushed"]);
    git(clone, ["push", "--quiet", "-u", "origin", "pushed"]);
    git(clone, ["push", "--quiet", "origin", "--delete", "pushed"]);

    const raw = await readRepository(clone, deps);
    const tracking = Object.fromEntries(
      raw.branches.map((branch) => [branch.name, branch.tracking]),
    );

    expect(tracking["local-only"]).toEqual({
      state: "absent",
      reason: "no-tracking-branch",
    });
    expect(tracking.pushed).toEqual({
      state: "absent",
      reason: "upstream-gone",
      upstream: "origin/pushed",
    });
  });

  it("states no remote, no origin head, and lists every commit as unpushed", async () => {
    const repo = initRepo(join(base, "local"));
    commit(repo, "a.txt", "First", daysBefore(3));
    commit(repo, "b.txt", "Second", daysBefore(1));

    const raw = await readRepository(repo, deps);

    expect(raw.remotes).toEqual({ state: "absent", reason: "no-remote" });
    expect(raw.originHead).toEqual({
      state: "absent",
      reason: "no-origin-head",
    });
    expect(raw.unpushedCommits.map((entry) => entry.subject)).toEqual([
      "Second",
      "First",
    ]);
  });

  it("states a detached head and a repository with no commits", async () => {
    const { clone } = clonedRepo(base, daysBefore(5));
    git(clone, ["switch", "--quiet", "--detach"]);
    const empty = initRepo(join(base, "empty"));

    const detached = await readRepository(clone, deps);
    const unborn = await readRepository(empty, deps);

    expect(detached.head).toMatchObject({
      state: "absent",
      reason: "detached-head",
    });
    expect(unborn.lastCommit).toEqual({
      state: "absent",
      reason: "no-commits",
    });
    expect(unborn.branches).toEqual([]);
  });
});

function commitAt(subject: string, date: Date): RawCommit {
  return { sha: subject, committedAt: date.toISOString(), subject };
}

function rawGit(overrides: Partial<RawGit>): RawGit {
  return {
    head: { state: "branch", name: "main" },
    lastCommit: {
      state: "observed",
      value: commitAt("Initial", daysBefore(20)),
    },
    dirtyFiles: [],
    branches: [
      {
        name: "main",
        lastCommit: commitAt("Initial", daysBefore(20)),
        tracking: {
          state: "tracking",
          upstream: "origin/main",
          ahead: 0,
          behind: 0,
        },
      },
    ],
    remotes: {
      state: "observed",
      value: [{ name: "origin", fetchUrl: "x", pushUrls: ["x"] }],
    },
    originHead: { state: "observed", value: "main" },
    unpushedCommits: [],
    ...overrides,
  };
}

describe("deriving git data", () => {
  it("is settled when everything is on the default branch and pushed", () => {
    const data = deriveGit(rawGit({}), thresholds, now, "joined");

    expect(data.activity).toBe("settled");
    expect(data.drift).toMatchObject({
      uncommitted: null,
      unpushed: null,
      level: "green",
    });
    expect([data.upstream, data.ahead, data.behind]).toEqual([
      "origin/main",
      0,
      0,
    ]);
  });

  it("is in progress with another local branch, unpushed commits or a detached head", () => {
    const feature = {
      name: "feature",
      lastCommit: commitAt("Work", daysBefore(1)),
      tracking: { state: "absent", reason: "no-tracking-branch" } as const,
    };
    const main = rawGit({}).branches;

    expect(
      deriveGit(
        rawGit({ branches: [...main, feature] }),
        thresholds,
        now,
        "joined",
      ).activity,
    ).toBe("in-progress");
    expect(
      deriveGit(
        rawGit({ unpushedCommits: [commitAt("Local", daysBefore(1))] }),
        thresholds,
        now,
        "joined",
      ).activity,
    ).toBe("in-progress");
    expect(
      deriveGit(
        rawGit({
          head: { state: "absent", reason: "detached-head", commit: "abc" },
        }),
        thresholds,
        now,
        "joined",
      ).activity,
    ).toBe("in-progress");
  });

  it("ranks editing over in progress", () => {
    expect(
      deriveActivity({
        uncommittedCount: 1,
        unpushedCount: 1,
        branch: "main",
        defaultBranch: "main",
        branchNames: ["main"],
      }),
    ).toBe("editing");
  });

  it("ages uncommitted work from the oldest existing dirty file, ignoring deleted ones", () => {
    const data = deriveGit(
      rawGit({
        dirtyFiles: [
          {
            path: "a",
            code: ".M",
            mtime: { state: "observed", value: daysBefore(10).toISOString() },
          },
          {
            path: "b",
            code: "??",
            mtime: { state: "observed", value: daysBefore(1).toISOString() },
          },
          {
            path: "c",
            code: ".D",
            mtime: { state: "absent", reason: "file-deleted" },
          },
        ],
      }),
      thresholds,
      now,
      "joined",
    );

    expect(data.uncommittedCount).toBe(3);
    expect(data.oldestUncommittedAt).toBe(daysBefore(10).toISOString());
    expect(data.drift).toMatchObject({
      uncommitted: {
        since: daysBefore(10).toISOString(),
        hours: 240,
        level: "amber",
      },
      unpushed: null,
      level: "amber",
    });
    expect(data.activity).toBe("editing");
  });

  it("ages unpushed work from the oldest commit no remote holds", () => {
    const data = deriveGit(
      rawGit({
        unpushedCommits: [
          commitAt("New", daysBefore(2)),
          commitAt("Old", daysBefore(40)),
        ],
      }),
      thresholds,
      now,
      "joined",
    );

    expect(data.unpushedCount).toBe(2);
    expect(data.drift).toMatchObject({
      unpushed: { hours: 960, level: "red" },
      level: "red",
    });
  });

  it("judges each age in hours against the injected windows, the worse giving the level", () => {
    const ages = {
      oldestUncommittedAt: daysBefore(4).toISOString(),
      oldestUnpushedAt: new Date(now.getTime() - 30 * 3_600_000).toISOString(),
    };

    expect(deriveDrift(ages, thresholds, now).level).toBe("green");
    expect(deriveDrift(ages, { amberHours: 24, redHours: 72 }, now)).toEqual({
      uncommitted: { since: ages.oldestUncommittedAt, hours: 96, level: "red" },
      unpushed: { since: ages.oldestUnpushedAt, hours: 30, level: "amber" },
      level: "red",
      thresholds: { amberHours: 24, redHours: 72 },
    });
    expect(
      deriveDrift(ages, { amberHours: 24, redHours: 120 }, now).level,
    ).toBe("amber");
    expect(deriveDrift(ages, thresholds, daysBefore(-30)).level).toBe("red");
  });
});

describe("deriving git data by backup state", () => {
  const unpushed = rawGit({
    remotes: { state: "absent", reason: "no-remote" },
    branches: [],
    unpushedCommits: [commitAt("Old", daysBefore(40))],
    dirtyFiles: [
      {
        path: "a",
        code: ".M",
        mtime: { state: "observed", value: daysBefore(9).toISOString() },
      },
    ],
  });

  it("gives a local-only clone no unpushed work and no unpushed drift", () => {
    const data = deriveGit(unpushed, thresholds, now, "local-only");

    expect(data.backup).toBe("local-only");
    expect(data.unpushedCount).toBe(0);
    expect(data.drift).toMatchObject({
      unpushed: null,
      uncommitted: { hours: 216, level: "amber" },
      level: "amber",
    });
  });

  it("counts unpushed commits against an unjoined remote but does not age them", () => {
    const data = deriveGit(
      { ...unpushed, dirtyFiles: [] },
      thresholds,
      now,
      "unjoined-remote",
    );

    expect(data.unpushedCount).toBe(1);
    expect(data.drift).toMatchObject({
      unpushed: null,
      uncommitted: null,
      level: "green",
    });
  });

  it("ages unpushed commits against a joined remote", () => {
    expect(
      deriveGit(unpushed, thresholds, now, "joined").drift.unpushed?.hours,
    ).toBe(960);
  });
});
