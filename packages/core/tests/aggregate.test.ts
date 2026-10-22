import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aggregate, type RawBundle } from "../src/aggregate.ts";
import { parseConfig } from "../src/config.ts";
import { deriveExpectation, expectationMet } from "../src/derivations.ts";
import type { ForgeData } from "../src/snapshot.ts";
import { dockerContainersSource } from "../src/sources/docker-containers.ts";
import {
  gatheredAt,
  localPresence,
  okStatus,
  rawFiles,
} from "./helpers/raw.ts";

const config = parseConfig(
  (
    await readFile(
      join(import.meta.dirname, "..", "..", "..", "config.example.toml"),
      "utf8",
    )
  ).replace(
    "[forges]\n",
    '[items."dev/perch"]\nimportance = "machine"\nunsafe_amber_hours = 48\nunsafe_red_hours = 96\nexpect = ["ci", "tickets"]\n\n[forges]\n',
  ),
  "/home/test",
);

const files = rawFiles({
  includes: { "/home/test/dev": "directory", "/home/test/undev": "directory" },
  locals: {
    "dev/perch": localPresence("/home/test/dev/perch", {
      include: "/home/test/dev",
      git: {
        dirtyFiles: [
          {
            path: "notes.md",
            code: ".M",
            mtime: { state: "observed", value: "2026-10-18T09:00:00.000Z" },
          },
        ],
      },
    }),
  },
  forges: {},
});
files.roadmap = {
  source: "roadmap",
  gatheredAt,
  data: { "dev/perch": { state: "absent", reason: "no-roadmap-file" } },
};
if (files.local) {
  files.local.data.includes["/home/test/missing"] = {
    state: "absent",
    reason: "path-not-found",
  };
}

const bundle: RawBundle = {
  status: okStatus({
    forgejo: {
      state: "error",
      reason: "request-failed",
      message: "unreachable",
      lastSucceededAt: { state: "absent", reason: "never-succeeded" },
      durationMs: 3,
    },
  }),
  files,
};

const input = {
  config,
  configPath: "config.toml",
  liveSources: [dockerContainersSource],
  previous: null,
};

describe("aggregate", () => {
  it("adds the server item from config, wiring live sources by kind", () => {
    const snapshot = aggregate(bundle, input, new Date("2026-10-22T00:00:00Z"));

    expect(
      snapshot.items.map((item) => [
        item.id,
        item.kind,
        item.importance,
        item.liveSources,
      ]),
    ).toEqual([
      ["dev/perch", "repo", "machine", []],
      ["server", "server", "projects", ["dockerContainers"]],
    ]);
    expect(snapshot.items[1]?.name).toBe("Silo");
    expect(snapshot.scannedAt).toBe(gatheredAt);
    expect(snapshot.aggregatedAt).toBe("2026-10-22T00:00:00.000Z");
    expect(snapshot.warnings).toEqual([
      "include not found: /home/test/missing",
    ]);
  });

  it("derives git data against the item's thresholds, as of when it was gathered", () => {
    const later = aggregate(bundle, input, new Date("2027-01-01T00:00:00Z"));

    expect(later.items[0]?.sources.git).toMatchObject({
      backup: "local-only",
      activity: "editing",
      drift: {
        uncommitted: { hours: 72, level: "amber" },
        level: "amber",
        thresholds: { amberHours: 48, redHours: 96 },
      },
    });
  });

  it("maps a missing roadmap file to no work items", () => {
    const perch = aggregate(bundle, input, new Date()).items[0];

    expect(perch?.sources.roadmap).toEqual({
      counts: { bug: 0, feature: 0 },
      files: [],
    });
  });

  it("carries each source's status, with no last success for one that never succeeded", () => {
    const snapshot = aggregate(bundle, input, new Date());

    expect(snapshot.sources.forgejo).toEqual({
      state: "error",
      reason: "request-failed",
      error: "unreachable",
      lastSucceededAt: null,
      durationMs: 3,
    });
    expect(snapshot.sources.local.lastSucceededAt).toBe(gatheredAt);
  });

  it("returns not-implemented from the container list stub", async () => {
    const server = aggregate(bundle, input, new Date()).items[1];

    expect(server && (await dockerContainersSource.fetch(server))).toEqual({
      state: "not-implemented",
    });
  });
});

describe("expectations", () => {
  const daysBeforeScan = (days: number) =>
    new Date(Date.parse(gatheredAt) - days * 86_400_000).toISOString();

  it("starts the clock on an unmet expectation at the scan that first finds it", () => {
    const perch = aggregate(bundle, input, new Date()).items[0];

    expect(perch?.expectations).toEqual([
      {
        name: "ci",
        met: false,
        unmetSince: gatheredAt,
        days: 0,
        level: "green",
        thresholds: { amberDays: 7, redDays: 30 },
      },
      expect.objectContaining({ name: "tickets", unmetSince: gatheredAt }),
    ]);
  });

  it("carries the first-seen time forward from the previous snapshot", () => {
    const previous = aggregate(bundle, input, new Date());
    const ci = previous.items[0]?.expectations[0];
    if (ci) ci.unmetSince = daysBeforeScan(10);

    const perch = aggregate(bundle, { ...input, previous }, new Date())
      .items[0];

    expect(perch?.expectations[0]).toMatchObject({
      unmetSince: daysBeforeScan(10),
      days: 10,
      level: "amber",
    });
    expect(perch?.expectations[1]?.unmetSince).toBe(gatheredAt);
  });

  it("restarts every clock from a previous snapshot that has no expectations", () => {
    const previous = aggregate(bundle, input, new Date());
    for (const item of previous.items) {
      Reflect.deleteProperty(item, "expectations");
    }

    const perch = aggregate(bundle, { ...input, previous }, new Date())
      .items[0];

    expect(perch?.expectations.map((entry) => entry.unmetSince)).toEqual([
      gatheredAt,
      gatheredAt,
    ]);
  });

  it("meets CI from any readable forge with a CI result, and never meets tickets yet", () => {
    const forge = (latestCi: ForgeData["latestCi"]): ForgeData => ({
      fullName: "finch/perch",
      url: "https://github.com/finch/perch",
      defaultBranch: "main",
      openPullRequests: [],
      latestCi,
      finalisedCommits: [],
    });
    const run = {
      name: "check",
      state: "failure" as const,
      forgeState: "completed/failure",
      url: null,
      createdAt: null,
    };

    expect(expectationMet("ci", { github: forge(run) })).toBe(true);
    expect(
      expectationMet("ci", {
        github: { error: "HTTP 404" },
        forgejo: forge(null),
      }),
    ).toBe(false);
    expect(expectationMet("tickets", { github: forge(run) })).toBe(false);
  });

  it("clears the clock once met", () => {
    expect(
      deriveExpectation(
        "ci",
        true,
        daysBeforeScan(40),
        { amberDays: 7, redDays: 30 },
        new Date(gatheredAt),
      ),
    ).toEqual({
      name: "ci",
      met: true,
      unmetSince: null,
      days: null,
      level: "green",
      thresholds: { amberDays: 7, redDays: 30 },
    });
  });
});
