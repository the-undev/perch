import { describe, expect, it } from "vitest";
import { aggregate, type RawBundle } from "../src/aggregate.ts";
import type { Config } from "../src/config.ts";
import { defaultConfig } from "../src/config-default.ts";
import type { RawFiles } from "../src/raw.ts";
import { readRoadmapStructure } from "../src/roadmap-parser.ts";
import type {
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
  withRemotes,
} from "./helpers/raw.ts";

const config = await testConfig(
  '[[sources.kuma]]\nname = "Silo"\nbase_url = "http://forge.example.lan:3001"\nstatus_page = "perch"\n\n[items."dev/perch"]\nunsafe_amber_hours = 48\nunsafe_red_hours = 96\n',
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
      ["dev/perch", "git", []],
      ["server:Silo", "server", ["dockerContainers"]],
    ]);
    expect(snapshot.items[1]?.name).toBe("Silo");
    expect(snapshot.scannedAt).toBe(gatheredAt);
    expect(snapshot.aggregatedAt).toBe("2026-10-22T00:00:00.000Z");
    expect(snapshot.warnings).toEqual([
      "include not found: /home/test/missing",
    ]);
  });

  it("names a local item's kind by what it holds: obsidian with an .obsidian folder, else git", () => {
    const siloFiles = rawFiles({
      includes: { "/home/test/obsidian": "directory" },
      locals: {
        "obsidian/notes": localPresence("/home/test/obsidian/notes", {
          include: "/home/test/obsidian",
          obsidian: true,
        }),
        "obsidian/plain": localPresence("/home/test/obsidian/plain", {
          include: "/home/test/obsidian",
        }),
      },
      forges: {},
    });

    const snapshot = aggregate(
      { ...bundle, files: siloFiles },
      input,
      new Date("2026-10-22T00:00:00Z"),
    );

    expect(
      snapshot.items
        .filter((item) => item.path !== null)
        .map((item) => [item.id, item.kind]),
    ).toEqual([
      ["obsidian/notes", "obsidian"],
      ["obsidian/plain", "git"],
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
      counts: { task: 0, bug: 0, "critical-bug": 0 },
      files: [],
      thresholds: {
        bugs: { amberCount: 5, redCount: 20 },
        criticalBugs: { amberCount: 1, redCount: 3 },
      },
    });
  });

  it("classes roadmap items by the word lists the item's entry sets, else [work], and judges them by its windows", async () => {
    const worded = await testConfig(
      '[work]\nbug_words = ["defect"]\n\n[items."dev/perch"]\ncritical_bug_words = ["outage"]\nbugs_red_count = 9\n',
    );
    const structure = readRoadmapStructure(
      "- A defect in the export\n- An outage at night\n- A bug in the import\n",
    );
    const roadmapFiles: Partial<RawFiles> = {
      ...files,
      roadmap: {
        source: "roadmap",
        gatheredAt,
        data: {
          "dev/perch": {
            state: "observed",
            value: {
              files: [
                {
                  path: "docs/roadmap.md",
                  structure: { state: "observed", value: structure },
                },
              ],
            },
          },
        },
      },
    };

    const perch = aggregate(
      { ...bundle, files: roadmapFiles },
      { ...input, config: worded },
      new Date(),
    ).items[0];

    expect(perch?.sources.roadmap).toMatchObject({
      counts: { task: 1, bug: 1, "critical-bug": 1 },
      files: [{ counts: { task: 1, bug: 1, "critical-bug": 1 } }],
      thresholds: {
        bugs: { amberCount: 5, redCount: 9 },
        criticalBugs: { amberCount: 1, redCount: 3 },
      },
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

  it("keeps a forge the enricher could not read as a presence carrying its error", () => {
    const clone = (path: string, url: string) =>
      localPresence(path, {
        include: "/home/test/undev",
        git: withRemotes([{ name: "origin", url }]),
      });
    const unread = rawFiles({
      includes: { "/home/test/undev": "directory" },
      locals: {
        "undev/skiff": clone(
          "/home/test/undev/skiff",
          "git@github-work:skiff-app/skiff.git",
        ),
        "undev/gone": clone(
          "/home/test/undev/gone",
          "git@github.com:the-undev/gone.git",
        ),
        "undev/fork": clone(
          "/home/test/undev/fork",
          "git@github.com:the-undev/fork.git",
        ),
      },
      forges: {},
    });
    unread.github = {
      source: "github",
      gatheredAt,
      data: {
        "skiff-app/skiff": {
          state: "error",
          reason: "no-card",
          error: "no GitHub card is configured for owner skiff-app",
        },
        "the-undev/gone": {
          state: "error",
          reason: "lookup-failed",
          error: "HTTP 404 for the-undev/gone",
        },
        "the-undev/fork": { state: "absent", reason: "fork-not-tracked" },
      },
    };

    const snapshot = aggregate(
      { status: okStatus({}), files: unread },
      input,
      new Date(),
    );
    const item = (id: string) =>
      snapshot.items.find((candidate) => candidate.id === id);

    expect(item("undev/skiff")?.sources.github).toEqual({
      error: "no GitHub card is configured for owner skiff-app",
      cause: "no-card",
    });
    expect(item("undev/skiff")?.presences.forges).toEqual([
      {
        forge: "github",
        ref: "github:skiff-app/skiff",
        fullName: "skiff-app/skiff",
        url: null,
        sshUrl: null,
        foundBy: "local-remote",
      },
    ]);
    expect(item("undev/gone")?.sources.github).toEqual({
      error: "HTTP 404 for the-undev/gone",
      cause: "read-failed",
    });
    expect(item("undev/fork")?.presences.forges).toEqual([]);
    expect(item("undev/fork")?.sources.github).toBeUndefined();
    expect(snapshot.forges.github.active).toEqual([]);
  });

  it("carries the SSH clone address each forge gives onto its presence, null when it gives none", () => {
    const silent = forgeRepo("finch/silent", {});
    silent.info.sshUrl = { state: "absent", reason: "not-reported" };
    const forgeOnly = rawFiles({
      includes: {},
      locals: {},
      forges: {
        github: [forgeRepo("finch/notes", {})],
        forgejo: [silent],
      },
    });

    const snapshot = aggregate(
      { ...bundle, files: forgeOnly },
      input,
      new Date(),
    );

    expect(
      snapshot.items.flatMap((item) =>
        item.presences.forges.map((presence) => [
          presence.ref,
          presence.sshUrl,
        ]),
      ),
    ).toEqual([
      ["github:finch/notes", "git@example.invalid:finch/notes.git"],
      ["forgejo:finch/silent", null],
    ]);
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
        "github-finch": listing("finch/perch", "finch/harbour", "finch/toy"),
        "github-the-undev": listing(),
        "github-skiff-app": { state: "error", error: "HTTP 401" },
      },
    },
    forgejoAccounts: {
      source: "forgejoAccounts",
      gatheredAt,
      data: {
        "forgejo-finch": listing("finch/perch"),
        "forgejo-the-undev": listing("the-undev/notes", "the-undev/box"),
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
