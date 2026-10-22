import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aggregate, type RawBundle } from "../src/aggregate.ts";
import { parseConfig } from "../src/config.ts";
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
    '[items."dev/perch"]\nimportance = "machine"\ndrift_amber_days = 2\n\n[forges]\n',
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
        uncommittedDays: 3,
        level: "amber",
        thresholds: { amberDays: 2, redDays: 30 },
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
