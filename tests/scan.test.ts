import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.ts";
import { type PolledSources, polledSourceOrder, runScan } from "../src/scan.ts";
import type { PolledSourceData, PolledSourceName } from "../src/snapshot.ts";
import { dockerContainersSource } from "../src/sources/docker-containers.ts";
import type { PolledSource } from "../src/sources/source.ts";

const home = "/home/test";
const config = parseConfig(
  await readFile(
    join(import.meta.dirname, "..", "config.example.toml"),
    "utf8",
  ),
  home,
);
const discovery = {
  found: [
    { path: "/home/test/dev/perch", kind: "repo" as const },
    { path: "/home/test/obsidian/Hothouse", kind: "vault" as const },
  ],
  warnings: ["root not found: /home/test/undev"],
};

function stepClock(): () => Date {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 9, 21, 9, 0, tick++));
}

function empty<N extends PolledSourceName>(name: N): PolledSource<N> {
  return { name, scan: async () => new Map() };
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

const sessionAt = (iso: string): PolledSourceData["claudeSessions"] => ({
  lastSessionAt: iso,
});

describe("runScan", () => {
  it("builds items with ids from home, the server last, and live sources wired by kind", async () => {
    const snapshot = await runScan(
      {
        config,
        configPath: "config.example.toml",
        home,
        discovery,
        previous: null,
      },
      {
        now: stepClock(),
        polledSources: sources({}),
        liveSources: [dockerContainersSource],
      },
    );

    expect(
      snapshot.items.map((item) => [
        item.id,
        item.name,
        item.kind,
        item.importance,
        item.liveSources,
      ]),
    ).toEqual([
      ["dev/perch", "perch", "repo", "projects", []],
      ["obsidian/Hothouse", "Hothouse", "vault", "projects", []],
      ["server", "Silo", "server", "projects", ["dockerContainers"]],
    ]);
    expect(Object.keys(snapshot.sources)).toEqual([...polledSourceOrder]);
    expect(snapshot.warnings).toEqual(["root not found: /home/test/undev"]);
  });

  it("keeps a failing source's previous data and last success time", async () => {
    const ok = sources({
      claudeSessions: {
        name: "claudeSessions",
        scan: async () =>
          new Map([["dev/perch", sessionAt("2026-10-20T08:00:00.000Z")]]),
      },
    });
    const first = await runScan(
      { config, configPath: "c", home, discovery, previous: null },
      { now: stepClock(), polledSources: ok, liveSources: [] },
    );
    const failing = sources({
      claudeSessions: {
        name: "claudeSessions",
        scan: async () => {
          throw new Error("projects directory unreadable");
        },
      },
    });

    const second = await runScan(
      { config, configPath: "c", home, discovery, previous: first },
      { now: stepClock(), polledSources: failing, liveSources: [] },
    );

    expect(second.sources.claudeSessions).toMatchObject({
      state: "error",
      error: "projects directory unreadable",
      lastSucceededAt: first.sources.claudeSessions.lastSucceededAt,
    });
    expect(second.items[0]?.sources.claudeSessions).toEqual(
      sessionAt("2026-10-20T08:00:00.000Z"),
    );
    expect(second.sources.git.state).toBe("ok");
  });

  it("returns not-implemented from the container list stub", async () => {
    const snapshot = await runScan(
      { config, configPath: "c", home, discovery, previous: null },
      {
        now: stepClock(),
        polledSources: sources({}),
        liveSources: [dockerContainersSource],
      },
    );
    const server = snapshot.items.find((item) => item.kind === "server");

    expect(server && (await dockerContainersSource.fetch(server))).toEqual({
      state: "not-implemented",
    });
  });
});
