import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discover } from "../src/discovery.ts";
import { fileMtime } from "../src/fs.ts";
import type { DriftThresholds, Item } from "../src/snapshot.ts";
import {
  createGitSource,
  deriveActivity,
  deriveDrift,
  scanRepository,
} from "../src/sources/git.ts";
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
const thresholds: DriftThresholds = { amberDays: 7, redDays: 30 };
const deps = { runGit: fixtureGit, mtimeOf: fileMtime, now: () => now };

let base: string;
beforeEach(() => {
  base = makeTempDir();
});
afterEach(() => {
  removeDir(base);
});

describe("uncommitted changes", () => {
  it("counts modified, staged and untracked files and reports editing", async () => {
    const { clone } = clonedRepo(base, daysBefore(2));
    writeFile(clone, "README.md", "changed\n", daysBefore(1));
    writeFile(clone, "staged.txt", "new\n", daysBefore(1));
    git(clone, ["add", "staged.txt"]);
    writeFile(clone, "notes/untracked.txt", "untracked\n", daysBefore(1));

    const data = await scanRepository(clone, thresholds, deps);

    expect(data.uncommittedCount).toBe(3);
    expect(data.activity).toBe("editing");
    expect(data.branch).toBe("main");
  });
});

describe("tracking branch", () => {
  it("reports commits ahead of and behind the upstream", async () => {
    const { remote, clone } = clonedRepo(base, daysBefore(5));
    const other = join(base, "other");
    git(base, ["clone", "--quiet", remote, other]);
    commit(other, "a.txt", "Remote one", daysBefore(4));
    commit(other, "b.txt", "Remote two", daysBefore(3));
    git(other, ["push", "--quiet", "origin", "main"]);
    commit(clone, "c.txt", "Local one", daysBefore(2));
    git(clone, ["fetch", "--quiet"]);

    const data = await scanRepository(clone, thresholds, deps);

    expect(data.upstream).toBe("origin/main");
    expect([data.ahead, data.behind]).toEqual([1, 2]);
    expect(data.unpushedCount).toBe(1);
    expect(data.activity).toBe("in-progress");
    expect(data.lastCommitAt).toBe(daysBefore(2).toISOString());
  });

  it("leaves ahead and behind null without an upstream", async () => {
    const repo = initRepo(join(base, "local"));
    commit(repo, "a.txt", "Only commit", daysBefore(1));

    const data = await scanRepository(repo, thresholds, deps);

    expect([data.upstream, data.ahead, data.behind]).toEqual([
      null,
      null,
      null,
    ]);
    expect(data.remotes).toEqual([]);
  });
});

describe("activity state", () => {
  it("is settled when everything is on the default branch and pushed", async () => {
    const { remote, clone } = clonedRepo(base, daysBefore(3));

    const data = await scanRepository(clone, thresholds, deps);

    expect(data.defaultBranch).toBe("main");
    expect(data.remotes).toEqual([{ name: "origin", url: remote }]);
    expect(data.activity).toBe("settled");
    expect(data.drift.driftDays).toBeNull();
    expect(data.drift.level).toBe("green");
  });

  it("is in progress when another local branch exists, listing branches newest first", async () => {
    const { clone } = clonedRepo(base, daysBefore(3));
    git(clone, ["switch", "--quiet", "-c", "feature"]);
    commit(clone, "f.txt", "Feature work", daysBefore(1));
    git(clone, ["switch", "--quiet", "main"]);

    const data = await scanRepository(clone, thresholds, deps);

    expect(data.activity).toBe("in-progress");
    expect(
      data.branches.map((branch) => [branch.name, branch.subject]),
    ).toEqual([
      ["feature", "Feature work"],
      ["main", "Initial commit"],
    ]);
    expect(data.branches[0]?.lastCommitAt).toBe(daysBefore(1).toISOString());
    expect(data.branches[1]?.upstream).toBe("origin/main");
  });

  it("ranks editing over in progress over settled", () => {
    const settled = {
      uncommittedCount: 0,
      unpushedCount: 0,
      branch: "main",
      defaultBranch: "main",
      branchNames: ["main"],
    };

    expect(deriveActivity(settled)).toBe("settled");
    expect(deriveActivity({ ...settled, branch: null })).toBe("in-progress");
    expect(deriveActivity({ ...settled, unpushedCount: 1 })).toBe(
      "in-progress",
    );
    expect(
      deriveActivity({ ...settled, uncommittedCount: 1, unpushedCount: 1 }),
    ).toBe("editing");
  });
});

describe("drift", () => {
  it("ages uncommitted work from the dirty files' modification times", async () => {
    const { clone } = clonedRepo(base, daysBefore(20));
    writeFile(clone, "old.txt", "old\n", daysBefore(10));
    writeFile(clone, "new.txt", "new\n", daysBefore(1));

    const data = await scanRepository(clone, thresholds, deps);

    expect(data.oldestUncommittedAt).toBe(daysBefore(10).toISOString());
    expect(data.drift.uncommittedDays).toBe(10);
    expect(data.drift.level).toBe("amber");
  });

  it("ages unpushed work from the oldest commit no remote holds", async () => {
    const { clone } = clonedRepo(base, daysBefore(60));
    commit(clone, "a.txt", "Unpushed old", daysBefore(40));
    commit(clone, "b.txt", "Unpushed new", daysBefore(2));

    const data = await scanRepository(clone, thresholds, deps);

    expect(data.unpushedCount).toBe(2);
    expect(data.drift.unpushedDays).toBe(40);
    expect(data.drift.driftDays).toBe(40);
    expect(data.drift.level).toBe("red");
  });

  it("judges the larger age against the injected thresholds", () => {
    const ages = {
      oldestUncommittedAt: daysBefore(4),
      oldestUnpushedAt: daysBefore(2),
    };

    expect(deriveDrift(ages, thresholds, now).level).toBe("green");
    expect(deriveDrift(ages, { amberDays: 3, redDays: 9 }, now)).toEqual({
      uncommittedDays: 4,
      unpushedDays: 2,
      driftDays: 4,
      level: "amber",
      thresholds: { amberDays: 3, redDays: 9 },
    });
    expect(deriveDrift(ages, { amberDays: 1, redDays: 4 }, now).level).toBe(
      "red",
    );
  });
});

describe("git source", () => {
  function item(id: string, path: string | null): Item {
    return {
      id,
      name: id,
      kind: "repo",
      path,
      importance: "projects",
      liveSources: [],
      sources: {},
    };
  }

  it("applies per-item thresholds and records a broken repository as an error", async () => {
    const { clone } = clonedRepo(base, daysBefore(20));
    writeFile(clone, "old.txt", "old\n", daysBefore(5));
    const notRepo = join(base, "not-a-repo");
    mkdirSync(notRepo);
    const source = createGitSource({
      ...deps,
      thresholdsFor: (id) =>
        id === "strict" ? { amberDays: 2, redDays: 4 } : thresholds,
      concurrency: 2,
    });

    const results = await source.scan([
      item("strict", clone),
      item("broken", notRepo),
      item("server", null),
    ]);

    expect(results.get("strict")).toMatchObject({ drift: { level: "red" } });
    expect(results.get("broken")).toHaveProperty("error");
    expect(results.has("server")).toBe(false);
  });
});

describe("discover", () => {
  it("finds nested repositories and skips excluded segments and hidden folders", async () => {
    initRepo(join(base, "dev", "perch"));
    initRepo(join(base, "dev", "all", "finch", "antler"));
    initRepo(join(base, "dev", "archived", "old"));
    initRepo(join(base, "dev", "all", "delete", "gone"));
    initRepo(join(base, "dev", "third-party", "fork"));
    initRepo(join(base, "dev", ".cache", "hidden"));
    const vault = join(base, "vault");
    mkdirSync(vault);

    const discovery = await discover(
      [
        { path: join(base, "dev"), kind: "repo", roadmaps: [] },
        { path: vault, kind: "vault", roadmaps: [] },
        { path: join(base, "missing"), kind: "repo", roadmaps: [] },
      ],
      ["archived", "third-party", "delete"],
    );

    expect(discovery.found).toEqual([
      { path: join(base, "dev", "all", "finch", "antler"), kind: "repo" },
      { path: join(base, "dev", "perch"), kind: "repo" },
      { path: vault, kind: "vault" },
    ]);
    expect(discovery.warnings).toEqual([
      `root not found: ${join(base, "missing")}`,
    ]);
  });
});
