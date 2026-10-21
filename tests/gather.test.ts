import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SourceFailure } from "../src/failure.ts";
import { createRawStore, gather, type PolledSources } from "../src/gather.ts";
import type {
  DiscoveryFile,
  PolledSourceName,
  RawEntries,
  StatusFile,
} from "../src/raw.ts";
import type { PolledSource } from "../src/sources/source.ts";
import { makeTempDir, removeDir } from "./helpers/git-fixture.ts";

let rawDir: string;
beforeEach(() => {
  rawDir = makeTempDir();
});
afterEach(() => {
  removeDir(rawDir);
});

const discovery: DiscoveryFile = {
  gatheredAt: "2026-10-21T09:00:00.000Z",
  home: "/home/test",
  items: [
    { id: "dev/a", name: "a", kind: "repo", path: "/home/test/dev/a" },
    { id: "dev/b", name: "b", kind: "repo", path: "/home/test/dev/b" },
    { id: "server", name: "Silo", kind: "server" },
  ],
  warnings: [],
};

function stepClock(start: number): () => Date {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 9, 21, start, 0, tick++));
}

function empty<N extends PolledSourceName>(name: N): PolledSource<N> {
  return { name, gather: async () => ({}) };
}

function sources(overrides: Partial<PolledSources>): PolledSources {
  return {
    git: empty("git"),
    roadmap: empty("roadmap"),
    claudeSessions: empty("claudeSessions"),
    github: empty("github"),
    forgejo: empty("forgejo"),
    kuma: empty("kuma"),
    ...overrides,
  };
}

const sessions: PolledSource<"claudeSessions"> = {
  name: "claudeSessions",
  gather: async () => {
    const entries: Record<string, RawEntries["claudeSessions"]> = {};
    entries["dev/b"] = {
      state: "observed",
      value: {
        directory: "-b",
        transcripts: { state: "absent", reason: "no-project-directory" },
      },
    };
    entries["dev/a"] = {
      state: "observed",
      value: { directory: "-a", transcripts: { state: "observed", value: [] } },
    };
    return entries;
  },
};

const failingSessions: PolledSource<"claudeSessions"> = {
  name: "claudeSessions",
  gather: async () => {
    throw new SourceFailure("token-not-stored", "not stored");
  },
};

function readRaw(name: string): string {
  return readFileSync(join(rawDir, `${name}.json`), "utf8");
}

describe("gather", () => {
  it("writes discovery, one pretty-printed file per source in item order, and status", async () => {
    await gather(discovery, {
      now: stepClock(9),
      store: createRawStore(rawDir),
      sources: sources({ claudeSessions: sessions }),
    });

    const text = readRaw("claudeSessions");
    const file = JSON.parse(text);
    expect(text).toContain('\n  "source": "claudeSessions",\n');
    expect(Object.keys(file.items)).toEqual(["dev/a", "dev/b"]);
    expect(JSON.parse(readRaw("discovery"))).toEqual(discovery);
    const status: StatusFile = JSON.parse(readRaw("status"));
    expect(Object.keys(status.sources)).toEqual([
      "git",
      "roadmap",
      "claudeSessions",
      "github",
      "forgejo",
      "kuma",
    ]);
    expect(status.sources.claudeSessions.state).toBe("ok");
  });

  it("keeps a failing source's previous raw file and records its reason and last success", async () => {
    const store = createRawStore(rawDir);
    const first = await gather(discovery, {
      now: stepClock(9),
      store,
      sources: sources({ claudeSessions: sessions }),
    });
    const kept = readRaw("claudeSessions");

    await gather(discovery, {
      now: stepClock(10),
      store,
      sources: sources({ claudeSessions: failingSessions }),
    });
    const third = await gather(discovery, {
      now: stepClock(11),
      store,
      sources: sources({ claudeSessions: failingSessions }),
    });

    const firstStatus = first.sources.claudeSessions;
    expect(firstStatus.state).toBe("ok");
    expect(readRaw("claudeSessions")).toBe(kept);
    expect(third.sources.claudeSessions).toMatchObject({
      state: "error",
      reason: "token-not-stored",
      message: "not stored",
      lastSucceededAt: {
        state: "observed",
        value: firstStatus.state === "ok" ? firstStatus.lastSucceededAt : "",
      },
    });
  });

  it("states that a source that has never succeeded has no last success", async () => {
    const status = await gather(discovery, {
      now: stepClock(9),
      store: createRawStore(rawDir),
      sources: sources({ claudeSessions: failingSessions }),
    });

    expect(status.sources.claudeSessions).toMatchObject({
      state: "error",
      lastSucceededAt: { state: "absent", reason: "never-succeeded" },
    });
  });

  it("passes earlier raw files to later sources, using the kept file when a source fails", async () => {
    const store = createRawStore(rawDir);
    const gitOnce: PolledSource<"git"> = {
      name: "git",
      gather: async () => ({ "dev/a": { state: "error", error: "first run" } }),
    };
    const seen: string[] = [];
    const github: PolledSource<"github"> = {
      name: "github",
      gather: async (_items, earlier) => {
        const entry = earlier.git?.items["dev/a"];
        seen.push(entry?.state === "error" ? entry.error : "none");
        return {};
      },
    };
    await gather(discovery, {
      now: stepClock(9),
      store,
      sources: sources({ git: gitOnce, github }),
    });
    const gitFailing: PolledSource<"git"> = {
      name: "git",
      gather: async () => {
        throw new Error("git missing");
      },
    };

    const status = await gather(discovery, {
      now: stepClock(10),
      store,
      sources: sources({ git: gitFailing, github }),
    });

    expect(seen).toEqual(["first run", "first run"]);
    expect(status.sources.git).toMatchObject({
      state: "error",
      reason: "unexpected",
    });
  });
});
