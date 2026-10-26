import { describe, expect, it } from "vitest";
import { aggregate, type RawBundle } from "../src/aggregate.ts";
import type { Config } from "../src/config.ts";
import { defaultConfig } from "../src/config-default.ts";
import { deriveExpectation, expectationMet } from "../src/derivations.ts";
import type { RawFiles } from "../src/raw.ts";
import type {
  ForgeData,
  Snapshot,
  SourceCard,
  SourceCardResult,
} from "../src/snapshot.ts";
import { dockerContainersSource } from "../src/sources/docker-containers.ts";
import { testConfig } from "./helpers/config.ts";
import {
  forgeRepo,
  gatheredAt,
  localPresence,
  okStatus,
  rawFiles,
} from "./helpers/raw.ts";

const config = await testConfig(
  '[[sources.kuma]]\nname = "Silo"\nbase_url = "http://forge.example.lan:3001"\nstatus_page = "perch"\n\n[items."dev/perch"]\nunsafe_amber_hours = 48\nunsafe_red_hours = 96\nexpect = ["ci", "tickets"]\n',
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
  home: "/home/test",
  liveSources: [dockerContainersSource],
  previous: null,
};

describe("aggregate", () => {
  it("adds the server item from config, wiring live sources by kind", () => {
    const snapshot = aggregate(bundle, input, new Date("2026-10-22T00:00:00Z"));

    expect(
      snapshot.items.map((item) => [item.id, item.kind, item.liveSources]),
    ).toEqual([
      ["dev/perch", "repo", []],
      ["server:Silo", "server", ["dockerContainers"]],
    ]);
    expect(snapshot.items[1]?.name).toBe("Silo");
    expect(snapshot.scannedAt).toBe(gatheredAt);
    expect(snapshot.aggregatedAt).toBe("2026-10-22T00:00:00.000Z");
    expect(snapshot.warnings).toEqual([
      "include not found: /home/test/missing",
    ]);
  });

  it("adds a server item per kuma source, each with its own status page", async () => {
    const twoServers = await testConfig(
      '[[sources.kuma]]\nname = "Silo"\nbase_url = "http://kuma.invalid"\nstatus_page = "silo"\n\n[[sources.kuma]]\nname = "Box"\nbase_url = "http://kuma.invalid"\nstatus_page = "box"\n',
    );
    const withKuma: RawBundle = {
      ...bundle,
      files: {
        ...files,
        kuma: {
          source: "kuma",
          gatheredAt,
          data: {
            Silo: {
              state: "observed",
              value: { statusPage: "silo", monitors: [] },
            },
            Box: { state: "error", error: "HTTP 502" },
          },
        },
      },
    };

    const servers = aggregate(
      withKuma,
      { ...input, config: twoServers },
      new Date(),
    ).items.filter((item) => item.kind === "server");

    expect(
      servers.map((item) => [item.id, item.name, item.sources.kuma]),
    ).toEqual([
      ["server:Silo", "Silo", { allUp: false, monitors: [] }],
      ["server:Box", "Box", { error: "HTTP 502" }],
    ]);
  });

  it("adds no server item when config has no kuma source", async () => {
    const withoutServer = await testConfig("");

    const snapshot = aggregate(
      bundle,
      { ...input, config: withoutServer },
      new Date(),
    );

    expect(snapshot.items.map((item) => item.id)).toEqual(["dev/perch"]);
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
    expect(snapshot.sources.local?.lastSucceededAt).toBe(gatheredAt);
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

describe("source cards", () => {
  const listing = (...names: string[]) => ({
    state: "observed" as const,
    value: {
      repos: names.map((name) => forgeRepo(name, {}).info),
      skippedForks: [],
    },
  });
  const cardFiles: Partial<RawFiles> = {
    ...rawFiles({
      includes: {
        "/home/test/dev": "directory",
        "/home/test/.dotfiles": "repo",
        "/home/test/undev": "directory",
      },
      locals: {
        "dev/perch": localPresence("/home/test/dev/perch", {
          include: "/home/test/dev",
        }),
        "dev/harbour": localPresence("/home/test/dev/harbour", {
          include: "/home/test/dev",
        }),
        ".dotfiles": localPresence("/home/test/.dotfiles", {
          include: "/home/test/.dotfiles",
        }),
        "undev/skiff": localPresence("/home/test/undev/skiff", {
          include: "/home/test/undev",
        }),
      },
      forges: {},
    }),
    githubAccounts: {
      source: "githubAccounts",
      gatheredAt,
      data: {
        finch: listing("finch/perch", "finch/harbour", "finch/toy"),
        "the-undev": listing(),
        "skiff-app": { state: "error", error: "HTTP 401" },
      },
    },
    forgejoAccounts: {
      source: "forgejoAccounts",
      gatheredAt,
      data: {
        finch: listing("finch/perch"),
        "the-undev": listing("the-undev/notes", "the-undev/box"),
      },
    },
    kuma: {
      source: "kuma",
      gatheredAt,
      data: {
        Silo: {
          state: "observed",
          value: {
            statusPage: "perch",
            monitors: [
              { id: 1, name: "web", group: "", heartbeats: [] },
              { id: 2, name: "db", group: "", heartbeats: [] },
            ],
          },
        },
      },
    },
  };
  const cardBundle: RawBundle = { status: okStatus({}), files: cardFiles };
  const cardsOf = (
    bundleGiven: RawBundle,
    configGiven: Config,
    previous: Snapshot | null = null,
  ) =>
    aggregate(
      bundleGiven,
      { ...input, config: configGiven, previous },
      new Date(),
    ).sourceCards;
  const resultOf = (cards: SourceCard[], id: string) =>
    cards.find((card) => card.id === id)?.result;
  const ok = (
    count: number,
    missingIncludes: string[] = [],
  ): SourceCardResult => ({
    state: "ok",
    at: gatheredAt,
    count,
    missingIncludes,
  });

  it("makes one card per configured source in config order, headed with home as ~", () => {
    const cards = cardsOf(cardBundle, config);

    expect(cards.map(({ id, kind, label }) => [id, kind, label])).toEqual([
      ["local:~/dev", "local", "~/dev, ~/.dotfiles"],
      ["github:finch", "github", "finch"],
      ["github:the-undev", "github", "the-undev"],
      ["github:skiff-app", "github", "skiff-app"],
      [
        "forgejo:finch@forge.example.lan:3000",
        "forgejo",
        "finch@forge.example.lan:3000",
      ],
      [
        "forgejo:the-undev@forge.example.lan:3000",
        "forgejo",
        "the-undev@forge.example.lan:3000",
      ],
      ["kuma:Silo", "kuma", "Silo"],
    ]);
  });

  it("counts what each kind read, as of its raw file's gather", () => {
    const cards = cardsOf(cardBundle, config);

    expect(resultOf(cards, "local:~/dev")).toEqual(ok(3));
    expect(resultOf(cards, "github:finch")).toEqual(ok(3));
    expect(resultOf(cards, "github:the-undev")).toEqual(ok(0));
    expect(resultOf(cards, "forgejo:the-undev@forge.example.lan:3000")).toEqual(
      ok(2),
    );
    expect(resultOf(cards, "kuma:Silo")).toEqual(ok(2));
  });

  it("fails a forge card on its account's error, carrying its last read from the previous snapshot", () => {
    const first = cardsOf(cardBundle, config);
    expect(resultOf(first, "github:skiff-app")).toEqual({
      state: "failed",
      message: "HTTP 401",
      lastSucceededAt: null,
    });

    const earlier = "2026-10-20T09:00:00.000Z";
    const previous = aggregate(cardBundle, input, new Date());
    previous.sourceCards = previous.sourceCards.map((card) =>
      card.id === "github:skiff-app"
        ? { ...card, result: { ...ok(1), at: earlier } }
        : card,
    );
    expect(
      resultOf(cardsOf(cardBundle, config, previous), "github:skiff-app"),
    ).toEqual({
      state: "failed",
      message: "HTTP 401",
      lastSucceededAt: earlier,
    });
  });

  it("fails a kuma card whose status page could not be read", () => {
    const pageError: RawBundle = {
      ...cardBundle,
      files: {
        ...cardFiles,
        kuma: {
          source: "kuma",
          gatheredAt,
          data: { Silo: { state: "error", error: "HTTP 502" } },
        },
      },
    };

    expect(resultOf(cardsOf(pageError, config), "kuma:Silo")).toEqual({
      state: "failed",
      message: "HTTP 502",
      lastSucceededAt: null,
    });
  });

  it("fails every card of a source that failed as a whole", () => {
    const failing: RawBundle = {
      ...cardBundle,
      status: okStatus({
        forgejoAccounts: {
          state: "error",
          reason: "request-failed",
          message: "unreachable",
          lastSucceededAt: { state: "absent", reason: "never-succeeded" },
          durationMs: 3,
        },
      }),
    };
    const cards = cardsOf(failing, config).filter(
      (card) => card.kind === "forgejo",
    );

    expect(cards.map((card) => card.result)).toEqual([
      { state: "failed", message: "unreachable", lastSucceededAt: null },
      { state: "failed", message: "unreachable", lastSucceededAt: null },
    ]);
  });

  it("lists a local card's include paths that do not exist, counting only its own", async () => {
    const twoLocal = await testConfig(
      '[[sources.local]]\ninclude = ["~/undev", "~/gone"]\n',
    );
    const withGone = structuredClone(cardFiles);
    if (withGone.local) {
      withGone.local.data.includes["/home/test/gone"] = {
        state: "absent",
        reason: "path-not-found",
      };
    }

    const cards = cardsOf({ ...cardBundle, files: withGone }, twoLocal);

    expect(resultOf(cards, "local:~/dev")).toEqual(ok(3));
    expect(resultOf(cards, "local:~/undev")).toEqual(ok(1, ["~/gone"]));
  });

  it("says never scanned for a card added since the last gather", async () => {
    const added = await testConfig(
      '[[sources.local]]\ninclude = ["~/new"]\n\n[[sources.github]]\naccount = "newcomer"\nkey = "github-newcomer"\nhosts = ["github.com"]\n\n[[sources.kuma]]\nname = "Box"\nbase_url = "http://kuma.invalid"\nstatus_page = "box"\n',
    );

    const cards = cardsOf(cardBundle, added);

    for (const id of ["local:~/new", "github:newcomer", "kuma:Box"]) {
      expect(resultOf(cards, id), id).toEqual({ state: "never-scanned" });
    }
    expect(resultOf(cards, "github:finch")).toEqual(ok(3));
  });

  it("says never scanned for a source the gather did not run", () => {
    const { kuma: _kuma, ...sources } = okStatus({}).sources;
    const unrun: RawBundle = {
      status: { ...okStatus({}), sources },
      files: cardFiles,
    };

    expect(resultOf(cardsOf(unrun, config), "kuma:Silo")).toEqual({
      state: "never-scanned",
    });
  });

  it("makes no cards when config declares no sources", () => {
    expect(cardsOf(cardBundle, defaultConfig())).toEqual([]);
  });
});
