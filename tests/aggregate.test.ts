import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aggregate, type RawBundle } from "../src/aggregate.ts";
import { parseConfig } from "../src/config.ts";
import type { RawGit, SourceStatus } from "../src/raw.ts";
import { dockerContainersSource } from "../src/sources/docker-containers.ts";

const home = "/home/test";
const config = parseConfig(
  (
    await readFile(
      join(import.meta.dirname, "..", "config.example.toml"),
      "utf8",
    )
  ).replace(
    "[items]\n",
    '[items]\n[items."dev/perch"]\nimportance = "machine"\ndrift_amber_days = 2\n',
  ),
  home,
);
const gitGatheredAt = "2026-10-21T09:00:00.000Z";
const ok: SourceStatus = {
  state: "ok",
  lastSucceededAt: gitGatheredAt,
  durationMs: 5,
};

const rawGit: RawGit = {
  head: { state: "branch", name: "main" },
  lastCommit: {
    state: "observed",
    value: {
      sha: "a",
      committedAt: "2026-10-01T09:00:00.000Z",
      subject: "First",
    },
  },
  dirtyFiles: [
    {
      path: "notes.md",
      code: ".M",
      mtime: { state: "observed", value: "2026-10-18T09:00:00.000Z" },
    },
  ],
  branches: [],
  remotes: { state: "absent", reason: "no-remote" },
  originHead: { state: "absent", reason: "no-origin-head" },
  unpushedCommits: [],
};

const bundle: RawBundle = {
  discovery: {
    gatheredAt: gitGatheredAt,
    home,
    items: [
      {
        id: "dev/perch",
        name: "perch",
        kind: "repo",
        path: "/home/test/dev/perch",
      },
      {
        id: "obsidian/Hothouse",
        name: "Hothouse",
        kind: "vault",
        path: "/home/test/obsidian/Hothouse",
      },
      { id: "server", name: "Silo", kind: "server" },
    ],
    warnings: ["root not found: /home/test/undev"],
  },
  status: {
    gatheredAt: gitGatheredAt,
    durationMs: 1234,
    sources: {
      git: ok,
      roadmap: ok,
      claudeSessions: ok,
      github: ok,
      forgejo: {
        state: "error",
        reason: "token-not-stored",
        message: "not stored",
        lastSucceededAt: { state: "absent", reason: "never-succeeded" },
        durationMs: 3,
      },
      kuma: ok,
    },
  },
  files: {
    git: {
      source: "git",
      gatheredAt: gitGatheredAt,
      items: {
        "dev/perch": { state: "observed", value: rawGit },
        "obsidian/Hothouse": { state: "error", error: "not a git repository" },
      },
    },
    roadmap: {
      source: "roadmap",
      gatheredAt: gitGatheredAt,
      items: { "dev/perch": { state: "absent", reason: "no-roadmap-file" } },
    },
    github: {
      source: "github",
      gatheredAt: gitGatheredAt,
      items: { "dev/perch": { state: "absent", reason: "no-github-remote" } },
    },
  },
};

const input = {
  config,
  configPath: "config.toml",
  liveSources: [dockerContainersSource],
};

describe("aggregate", () => {
  it("builds items from discovery and config, wiring live sources by kind", () => {
    const snapshot = aggregate(bundle, input, new Date("2026-10-22T00:00:00Z"));

    expect(
      snapshot.items.map((item) => [
        item.id,
        item.kind,
        item.path,
        item.importance,
        item.liveSources,
      ]),
    ).toEqual([
      ["dev/perch", "repo", "/home/test/dev/perch", "machine", []],
      [
        "obsidian/Hothouse",
        "vault",
        "/home/test/obsidian/Hothouse",
        "projects",
        [],
      ],
      ["server", "server", null, "projects", ["dockerContainers"]],
    ]);
    expect(snapshot.scannedAt).toBe(gitGatheredAt);
    expect(snapshot.durationMs).toBe(1234);
    expect(snapshot.aggregatedAt).toBe("2026-10-22T00:00:00.000Z");
    expect(snapshot.warnings).toEqual(["root not found: /home/test/undev"]);
  });

  it("derives git data against the item's thresholds, as of when git was gathered", () => {
    const later = aggregate(bundle, input, new Date("2027-01-01T00:00:00Z"));
    const perch = later.items[0]?.sources;

    expect(perch?.git).toMatchObject({
      activity: "editing",
      drift: {
        uncommittedDays: 3,
        level: "amber",
        thresholds: { amberDays: 2, redDays: 30 },
      },
    });
    expect(later.items[1]?.sources.git).toEqual({
      error: "not a git repository",
    });
  });

  it("maps absence by rule: no roadmap file is empty work, no forge remote is no forge data", () => {
    const perch = aggregate(bundle, input, new Date()).items[0]?.sources;

    expect(perch?.roadmap).toEqual({
      counts: { bug: 0, feature: 0 },
      files: [],
    });
    expect(perch && "github" in perch).toBe(false);
  });

  it("carries each source's status, with no last success for one that never succeeded", () => {
    const snapshot = aggregate(bundle, input, new Date());

    expect(snapshot.sources.forgejo).toEqual({
      state: "error",
      reason: "token-not-stored",
      error: "not stored",
      lastSucceededAt: null,
      durationMs: 3,
    });
    expect(snapshot.sources.git.lastSucceededAt).toBe(gitGatheredAt);
  });

  it("returns not-implemented from the container list stub", async () => {
    const server = aggregate(bundle, input, new Date()).items[2];

    expect(server && (await dockerContainersSource.fetch(server))).toEqual({
      state: "not-implemented",
    });
  });
});
