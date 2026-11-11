import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SourceFailure } from "../src/failure.ts";
import {
  createRawStore,
  gather,
  gatherRounds,
  type PolledSources,
} from "../src/gather.ts";
import type { PolledSourceName, RawData, StatusFile } from "../src/raw.ts";
import type { PolledSource } from "../src/sources/source.ts";
import { makeTempDir, removeDir } from "./helpers/git-fixture.ts";
import { localPresence } from "./helpers/raw.ts";

let rawDir: string;
beforeEach(() => {
  rawDir = makeTempDir();
});
afterEach(() => {
  removeDir(rawDir);
});

function stepClock(start: number): () => Date {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 9, 21, start, 0, tick++));
}

function returning<N extends PolledSourceName>(
  name: N,
  data: RawData[N],
): PolledSource<N> {
  return { name, gather: async () => data };
}

function failing<N extends PolledSourceName>(
  name: N,
  error: Error,
): PolledSource<N> {
  return {
    name,
    gather: async () => {
      throw error;
    },
  };
}

const localData: RawData["local"] = {
  includes: { "/home/test/dev": { state: "observed", value: "directory" } },
  presences: {
    "dev/a": localPresence("/home/test/dev/a", { include: "/home/test/dev" }),
  },
};

function sources(overrides: Partial<PolledSources>): PolledSources {
  return {
    local: returning("local", localData),
    githubAccounts: returning("githubAccounts", {}),
    forgejoAccounts: returning("forgejoAccounts", {}),
    kuma: returning("kuma", {
      Silo: {
        state: "observed",
        value: { statusPage: "perch", monitors: [] },
      },
    }),
    roadmap: returning("roadmap", {}),
    github: returning("github", {}),
    forgejo: returning("forgejo", {}),
    ...overrides,
  };
}

function readRaw(name: string): string {
  return readFileSync(join(rawDir, `${name}.json`), "utf8");
}

describe("gather", () => {
  it("runs root collectors before enrichers, and the roadmap reader last", () => {
    expect(gatherRounds).toEqual([
      ["local", "githubAccounts", "forgejoAccounts", "kuma"],
      ["github", "forgejo"],
      ["roadmap"],
    ]);
  });

  it("gives the roadmap reader the forge enrichers' files", async () => {
    const seen: string[][] = [];
    const roadmap: PolledSource<"roadmap"> = {
      name: "roadmap",
      gather: async (earlier) => {
        seen.push(Object.keys(earlier.forgejo?.data ?? {}));
        return {};
      },
    };
    const forgejo = returning("forgejo", {
      "finch/a": {
        state: "error",
        reason: "lookup-failed",
        error: "details not gathered",
      },
    });

    await gather({
      now: stepClock(9),
      store: createRawStore(rawDir),
      sources: sources({ roadmap, forgejo }),
    });

    expect(seen).toEqual([["finch/a"]]);
  });

  it("skips the kuma collector and writes no kuma file when config declares no kuma source", async () => {
    const status = await gather({
      now: stepClock(9),
      store: createRawStore(rawDir),
      sources: sources({ kuma: null }),
    });

    expect(Object.keys(status.sources)).not.toContain("kuma");
    expect(existsSync(join(rawDir, "kuma.json"))).toBe(false);
    expect(status.sources.local?.state).toBe("ok");
  });

  it("writes one pretty-printed file per source and a status file", async () => {
    await gather({
      now: stepClock(9),
      store: createRawStore(rawDir),
      sources: sources({}),
    });

    const text = readRaw("local");
    expect(text).toContain('\n  "source": "local",\n');
    expect(JSON.parse(text).data).toEqual(localData);
    const status: StatusFile = JSON.parse(readRaw("status"));
    expect(Object.keys(status.sources)).toEqual(gatherRounds.flat());
    expect(status.sources.local?.state).toBe("ok");
  });

  it("gives enrichers the first round's raw files", async () => {
    const seen: string[][] = [];
    const roadmap: PolledSource<"roadmap"> = {
      name: "roadmap",
      gather: async (earlier) => {
        seen.push(Object.keys(earlier.local?.data.presences ?? {}));
        return {};
      },
    };

    await gather({
      now: stepClock(9),
      store: createRawStore(rawDir),
      sources: sources({ roadmap }),
    });

    expect(seen).toEqual([["dev/a"]]);
  });

  it("keeps a failing source's previous raw file, feeds it to enrichers, and records reason and last success", async () => {
    const store = createRawStore(rawDir);
    const first = await gather({
      now: stepClock(9),
      store,
      sources: sources({}),
    });
    const kept = readRaw("local");
    const seen: string[][] = [];
    const roadmap: PolledSource<"roadmap"> = {
      name: "roadmap",
      gather: async (earlier) => {
        seen.push(Object.keys(earlier.local?.data.presences ?? {}));
        return {};
      },
    };
    const broken = sources({
      local: failing(
        "local",
        new SourceFailure("request-failed", "unreachable"),
      ),
      roadmap,
    });

    await gather({ now: stepClock(10), store, sources: broken });
    const third = await gather({ now: stepClock(11), store, sources: broken });

    const firstLocal = first.sources.local;
    expect(readRaw("local")).toBe(kept);
    expect(seen).toEqual([["dev/a"], ["dev/a"]]);
    expect(third.sources.local).toMatchObject({
      state: "error",
      reason: "request-failed",
      message: "unreachable",
      lastSucceededAt: {
        state: "observed",
        value: firstLocal?.state === "ok" ? firstLocal.lastSucceededAt : "",
      },
    });
  });

  it("states that a source that has never succeeded has no last success", async () => {
    const status = await gather({
      now: stepClock(9),
      store: createRawStore(rawDir),
      sources: sources({ kuma: failing("kuma", new Error("unreachable")) }),
    });

    expect(status.sources.kuma).toMatchObject({
      state: "error",
      reason: "unexpected",
      lastSucceededAt: { state: "absent", reason: "never-succeeded" },
    });
  });
});
