import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.ts";
import type { Item } from "../src/snapshot.ts";
import { type Bird, chipKinds, deriveAviary } from "../src/viewmodel.ts";
import { testConfig } from "./helpers/config.ts";
import {
  aged,
  forgeData,
  gitData,
  hoursBefore,
  item,
  scannedAt,
  snapshotOf,
} from "./helpers/snapshot.ts";

/** The home directory the test items' clones sit under. */
const home = "/home/test";

const adoptAll = (ids: string[], extra = "") =>
  testConfig(`${ids.map((id) => `[items."${id}"]\n`).join("\n")}\n${extra}`);

function birdIn(items: Item[], config: Config, id: string): Bird {
  const aviary = deriveAviary(snapshotOf(items), config, home);
  const bird = [
    ...aviary.wires.flatMap((wire) => wire.birds),
    ...aviary.fence.birds,
  ].find((entry) => entry.id === id);
  if (bird === undefined) throw new Error(`no bird ${id}`);
  return bird;
}

const failingRun = {
  name: "check",
  state: "failure" as const,
  forgeState: "completed/failure",
  url: "https://github.com/finch/perch/actions/runs/1",
  createdAt: hoursBefore(2),
};

const settled = item("dev/spool", { sources: { git: gitData({}) } });
const restless = item("dev/harbour", {
  sources: {
    git: gitData({
      unpushedCount: 2,
      activity: "in-progress",
      drift: {
        uncommitted: null,
        unpushed: aged(40, "amber"),
        level: "amber",
        thresholds: { amberHours: 24, redHours: 72 },
      },
    }),
  },
});
const distressed = item("dev/prism", {
  sources: {
    git: gitData({}),
    github: forgeData({ latestCi: failingRun }),
  },
});

describe("mood", () => {
  it("wears health as mood: green content, amber restless, red distressed", async () => {
    const config = await adoptAll(["dev/spool", "dev/harbour", "dev/prism"]);
    const items = [settled, restless, distressed];

    expect(
      ["dev/spool", "dev/harbour", "dev/prism"].map((id) => {
        const bird = birdIn(items, config, id);
        return [bird.health.level, bird.mood, bird.bubble.stateWord];
      }),
    ).toEqual([
      ["green", "content", "content"],
      ["amber", "restless", "restless"],
      ["red", "distressed", "distressed"],
    ]);
  });

  it("takes the worst cause and lists the amber and red ones worst first", async () => {
    const config = await adoptAll(["dev/prism"]);
    const both = item("dev/prism", {
      sources: {
        git: gitData({
          uncommittedCount: 4,
          activity: "editing",
          drift: {
            uncommitted: aged(60, "amber"),
            unpushed: null,
            level: "amber",
            thresholds: { amberHours: 24, redHours: 72 },
          },
        }),
        github: forgeData({ latestCi: failingRun }),
      },
    });

    expect(
      birdIn([both], config, "dev/prism").health.causes.map((cause) => [
        cause.kind,
        cause.level,
      ]),
    ).toEqual([
      ["ci-failing", "red"],
      ["uncommitted", "amber"],
    ]);
  });

  it("leaves green inputs out: fresh work and a young stall are content", async () => {
    const config = await testConfig('[items."dev/gramophone"]\n');
    const young = item("dev/gramophone", {
      sources: {
        git: gitData({
          branch: "spec",
          uncommittedCount: 2,
          activity: "editing",
          drift: {
            uncommitted: aged(3, "green"),
            unpushed: null,
            level: "green",
            thresholds: { amberHours: 24, redHours: 72 },
          },
          stall: {
            branch: "spec",
            since: hoursBefore(48),
            days: 2,
            level: "green",
            thresholds: { amberDays: 7, redDays: 30 },
          },
        }),
      },
    });
    const bird = birdIn([young], config, "dev/gramophone");

    expect([bird.mood, bird.health.causes]).toEqual(["content", []]);
    expect(
      bird.bubble.chips.map((chip) => [chip.label, chip.severity]),
    ).toEqual([["2 uncommitted", null]]);
  });

  it("maps the git work-state to activity, null without a local clone", async () => {
    const config = await adoptAll(["dev/spool", "dev/harbour", "dev/perch"]);
    const editing = item("dev/perch", {
      sources: { git: gitData({ uncommittedCount: 1, activity: "editing" }) },
    });
    const forgeOnly = item("github:finch/obsidian-tidy", {
      path: null,
      presences: { local: null, forges: [] },
    });
    const items = [settled, restless, editing, forgeOnly];

    expect(
      [
        "dev/spool",
        "dev/harbour",
        "dev/perch",
        "github:finch/obsidian-tidy",
      ].map((id) => birdIn(items, config, id).activity),
    ).toEqual(["settled", "in-flight", "editing", null]);
  });

  it("lets only content birds that are not being edited, and the fence, sleep at night", async () => {
    const config = await adoptAll(["dev/spool", "dev/harbour", "dev/perch"]);
    const editing = item("dev/perch", {
      sources: { git: gitData({ uncommittedCount: 1, activity: "editing" }) },
    });
    const fence = item("dev/hello", {
      sources: { git: gitData({ backup: "local-only" }) },
    });
    const items = [settled, restless, editing, fence];
    const sleeps = (id: string) => birdIn(items, config, id).sleepsAtNight;

    expect(
      ["dev/spool", "dev/harbour", "dev/perch", "dev/hello"].map(sleeps),
    ).toEqual([true, false, false, true]);
    expect(birdIn(items, config, "dev/spool").bubble.wokenSpeech).toBe(
      "Mm? You woke me. All settled over here. Last touched three days ago.",
    );
    expect(birdIn(items, config, "dev/harbour").bubble.wokenSpeech).toBeNull();
  });
});

describe("the wires", () => {
  it("lists every configured wire in order, the worst mood leftmost, then name", async () => {
    const config = await adoptAll([
      "dev/spool",
      "dev/harbour",
      "dev/prism",
      "dev/alpha",
      "dev/zeta",
    ]);
    const items = [
      settled,
      restless,
      distressed,
      item("dev/alpha", { sources: { git: gitData({}) } }),
      item("dev/zeta", { sources: { git: gitData({}) } }),
    ];
    const aviary = deriveAviary(snapshotOf(items), config, home);

    expect(aviary.wires.map((wire) => wire.name)).toEqual([
      "Machine & Home",
      "Projects",
    ]);
    expect(aviary.wires[0]?.birds).toEqual([]);
    expect(
      aviary.wires[1]?.birds.map((bird) => [bird.position, bird.id]),
    ).toEqual([
      [0, "dev/prism"],
      [1, "dev/harbour"],
      [2, "dev/alpha"],
      [3, "dev/spool"],
      [4, "dev/zeta"],
    ]);
  });

  it("puts a bird on the wire its entry names", async () => {
    const config = await testConfig(
      '[items."dev/spool"]\nwire = "Machine & Home"\n',
    );
    const aviary = deriveAviary(snapshotOf([settled]), config, home);

    expect(aviary.wires[0]?.birds.map((bird) => bird.wire)).toEqual([
      "Machine & Home",
    ]);
  });

  it("puts every unadopted bird on the fence by name, and leaves the server off the scene", async () => {
    const config = await adoptAll(["dev/spool"]);
    const items = [
      settled,
      item("dev/photo-shuttle", { sources: { git: gitData({}) } }),
      item("dev/hello", { sources: { git: gitData({}) } }),
      item("server", { kind: "server", path: null }),
    ];
    const aviary = deriveAviary(snapshotOf(items), config, home);

    expect(
      aviary.fence.birds.map((bird) => [
        bird.position,
        bird.id,
        bird.wire,
        bird.bubble.stateWord,
      ]),
    ).toEqual([
      [0, "dev/hello", null, "not adopted"],
      [1, "dev/photo-shuttle", null, "not adopted"],
    ]);
    expect(
      aviary.wires.flatMap((wire) => wire.birds).map((bird) => bird.id),
    ).toEqual(["dev/spool"]);
  });

  it("names the bird from config and fills it by outstanding work", async () => {
    const config = await testConfig('[items."dev/spool"]\nname = "Spool"\n');
    const busy = item("dev/spool", {
      sources: {
        git: gitData({}),
        roadmap: { counts: { bug: 1, feature: 19 }, files: [] },
      },
    });
    const bird = birdIn([busy], config, "dev/spool");

    expect([bird.name, bird.bubble.name]).toEqual(["Spool", "Spool"]);
    expect(bird.plumpness).toEqual({ outstanding: 20, fullness: 0.4 });
  });

  it("caps plumpness", async () => {
    const config = await adoptAll([]);
    const vault = item("obsidian/Hothouse", {
      kind: "vault",
      sources: { roadmap: { counts: { bug: 0, feature: 194 }, files: [] } },
    });

    expect(birdIn([vault], config, "obsidian/Hothouse").plumpness).toEqual({
      outstanding: 194,
      fullness: 1,
    });
  });

  it("carries failing sources and warnings to the scene", async () => {
    const config = await adoptAll([]);
    const snapshot = snapshotOf([]);
    snapshot.warnings = ["include not found: /home/test/gone"];
    snapshot.sources.forgejo = {
      state: "error",
      reason: "request-failed",
      error: "unreachable",
      lastSucceededAt: hoursBefore(5),
      durationMs: 3,
    };
    const aviary = deriveAviary(snapshot, config, home);

    expect(aviary.scannedAt).toBe(scannedAt);
    expect(aviary.warnings).toEqual(["include not found: /home/test/gone"]);
    expect(aviary.sourceErrors).toEqual([
      {
        source: "forgejo",
        reason: "request-failed",
        error: "unreachable",
        lastSucceededAt: hoursBefore(5),
      },
    ]);
  });
});

describe("chips", () => {
  it("carry real numbers in order, each with the severity of its fact", async () => {
    const config = await testConfig('[items."dev/prism"]\n');
    const busy = item("dev/prism", {
      sources: {
        git: gitData({
          uncommittedCount: 4,
          unpushedCount: 1,
          drift: {
            uncommitted: aged(80, "red"),
            unpushed: aged(3, "green"),
            level: "red",
            thresholds: { amberHours: 24, redHours: 72 },
          },
        }),
        roadmap: { counts: { bug: 2, feature: 7 }, files: [] },
        github: forgeData({
          latestCi: { ...failingRun, state: "success" },
          openPullRequests: [
            {
              number: 3,
              title: "Retry quirks",
              author: "finch",
              draft: false,
              updatedAt: hoursBefore(1),
              url: "https://github.com/the-undev/prism/pull/3",
            },
          ],
        }),
        forgejo: forgeData({ latestCi: failingRun }),
      },
    });

    expect(
      birdIn([busy], config, "dev/prism").bubble.chips.map((chip) => [
        chip.label,
        chip.count,
        chip.severity,
      ]),
    ).toEqual([
      ["ci failure", null, "red"],
      ["2 bugs", 2, "red"],
      ["4 uncommitted", 4, "red"],
      ["1 unpushed", 1, null],
      ["1 open PR", 1, null],
      ["9 open items", 9, null],
    ]);
    expect(
      birdIn([busy], config, "dev/prism").bubble.chips.map(
        (chip) => chip.kind,
      ),
    ).toEqual(chipKinds);
  });

  it("show only what exists: a clean, quiet bird carries none", async () => {
    const config = await adoptAll(["dev/spool"]);

    expect(birdIn([settled], config, "dev/spool").bubble.chips).toEqual([]);
  });

  it("say nothing of CI a bird does not run: no chip, no not set up, no ledger row", async () => {
    const config = await adoptAll(["dev/oxbow"]);
    const noCi = item("dev/oxbow", {
      sources: { github: forgeData({}), forgejo: forgeData({}) },
    });
    const bird = birdIn([noCi], config, "dev/oxbow");

    expect(bird.bubble.chips).toEqual([]);
    expect(
      bird.detail.ledger.filter(
        (entry) =>
          /ci/i.test(entry.label) ||
          ("text" in entry && entry.text === "not set up"),
      ),
    ).toEqual([]);
    expect(bird.mood).toBe("content");
  });

  it("stay off fence birds, which only say where they stand", async () => {
    const config = await adoptAll([]);
    const found = item("dev/mixed-bag", {
      sources: {
        git: gitData({}),
        roadmap: { counts: { bug: 1, feature: 44 }, files: [] },
      },
    });

    expect(birdIn([found], config, "dev/mixed-bag").bubble.chips).toEqual([]);
  });
});

describe("the ledger", () => {
  it("reads clean zeros as a green none and tones counts by severity", async () => {
    const config = await adoptAll(["dev/harbour"]);
    const harbour = item("dev/harbour", {
      sources: {
        git: gitData({
          unpushedCount: 2,
          lastCommitAt: hoursBefore(40),
          drift: {
            uncommitted: null,
            unpushed: aged(40, "amber"),
            level: "amber",
            thresholds: { amberHours: 24, redHours: 72 },
          },
        }),
        roadmap: { counts: { bug: 0, feature: 15 }, files: [] },
        claudeSessions: {
          lastSessionAt: hoursBefore(30),
          basis: "last-message",
        },
        github: forgeData({
          fullName: "the-undev/harbour",
          url: "https://github.com/the-undev/harbour",
          latestCi: { ...failingRun, state: "success", url: null },
        }),
      },
    });

    expect(birdIn([harbour], config, "dev/harbour").detail.ledger).toEqual([
      {
        kind: "count",
        label: "uncommitted changes",
        count: 0,
        text: "none",
        tone: "green",
        chip: null,
        workings: [],
      },
      {
        kind: "count",
        label: "unpushed commits",
        count: 2,
        text: "2",
        tone: "amber",
        chip: "unpushed",
        workings: [
          {
            source: "git",
            text: "oldest commit",
            tone: "amber",
            url: null,
            at: hoursBefore(40),
          },
        ],
      },
      {
        kind: "count",
        label: "open bugs",
        count: 0,
        text: "none",
        tone: "green",
        chip: null,
        workings: [],
      },
      {
        kind: "count",
        label: "open roadmap items",
        count: 15,
        text: "15",
        tone: null,
        chip: "open-items",
        workings: [],
      },
      {
        kind: "count",
        label: "open pull requests",
        count: 0,
        text: "none",
        tone: "green",
        chip: null,
        workings: [],
      },
      {
        kind: "state",
        label: "CI",
        text: "success",
        tone: "green",
        url: null,
        chip: "ci",
        workings: [
          {
            source: "github",
            text: "success on main, run “check”",
            tone: "green",
            url: null,
            at: hoursBefore(2),
          },
        ],
      },
      { kind: "time", label: "last commit", at: hoursBefore(40) },
      { kind: "time", label: "last Claude session", at: hoursBefore(30) },
    ]);
  });

  it("states one disk only, and failing CI in red with its run", async () => {
    const config = await testConfig('[items."dev/hello"]\n');
    const hello = item("dev/hello", {
      sources: {
        git: gitData({ backup: "local-only", lastCommitAt: null }),
        github: forgeData({ latestCi: failingRun }),
      },
    });
    const ledger = birdIn([hello], config, "dev/hello").detail.ledger;

    expect(ledger).toContainEqual({
      kind: "state",
      label: "remote",
      text: "none, one disk only",
      tone: null,
      url: null,
      chip: null,
      workings: [],
    });
    expect(ledger).toContainEqual(
      expect.objectContaining({
        label: "CI",
        text: "failure",
        tone: "red",
        workings: [
          expect.objectContaining({
            source: "github",
            tone: "red",
            url: failingRun.url,
          }),
        ],
      }),
    );
    expect(ledger.some((entry) => entry.label === "unpushed commits")).toBe(
      false,
    );
  });
});

describe("the ledger's workings", () => {
  /** A ledger row by its label, failing when the bird has none. */
  function row(bird: Bird, label: string) {
    const entry = bird.detail.ledger.find(
      (candidate) => candidate.label === label,
    );
    if (entry === undefined || entry.kind === "time") {
      throw new Error(`no ${label} row`);
    }
    return entry;
  }

  it("names each forge's newest run on one CI row, which says the worst state as the chip does", async () => {
    const config = await adoptAll(["dev/perch"]);
    const perch = item("dev/perch", {
      sources: {
        github: forgeData({
          latestCi: { ...failingRun, state: "success" },
        }),
        forgejo: forgeData({
          url: "http://forgejo.test/finch/perch",
          defaultBranch: "trunk",
          latestCi: {
            name: "check / check (push)",
            state: "pending",
            forgeState: "pending",
            url: "http://forgejo.test/finch/perch/actions/runs/14",
            createdAt: hoursBefore(5),
          },
        }),
      },
    });
    const bird = birdIn([perch], config, "dev/perch");
    const ci = row(bird, "CI");

    expect(bird.bubble.chips[0]?.label).toBe("ci pending");
    expect([ci.text, ci.tone, ci.chip]).toEqual(["pending", null, "ci"]);
    expect(ci.workings).toEqual([
      {
        source: "github",
        text: "success on main, run “check”",
        tone: "green",
        url: failingRun.url,
        at: hoursBefore(2),
      },
      {
        source: "forgejo",
        text: "pending on trunk, run “check / check (push)”",
        tone: null,
        url: "http://forgejo.test/finch/perch/actions/runs/14",
        at: hoursBefore(5),
      },
    ]);
  });

  it("leaves a forge with no run, or no pull requests, silent", async () => {
    const config = await adoptAll(["dev/perch"]);
    const perch = item("dev/perch", {
      sources: {
        github: forgeData({
          latestCi: failingRun,
          openPullRequests: [
            {
              number: 6,
              title: "Typed contracts",
              author: "finch",
              draft: false,
              updatedAt: hoursBefore(3),
              url: "https://github.com/finch/perch/pull/6",
            },
          ],
        }),
        forgejo: forgeData({ url: "http://forgejo.test/finch/perch" }),
      },
    });
    const bird = birdIn([perch], config, "dev/perch");

    expect(row(bird, "CI").workings.map((working) => working.source)).toEqual([
      "github",
    ]);
    expect(row(bird, "open pull requests")).toMatchObject({
      text: "1",
      chip: "pull-requests",
      workings: [
        {
          source: "github",
          text: "1 open",
          tone: null,
          url: "https://github.com/finch/perch/pulls",
          at: null,
        },
      ],
    });
  });

  it("says a forge was not read on the rows it would have spelled out", async () => {
    const config = await adoptAll(["dev/prism"]);
    const prism = item("dev/prism", {
      sources: {
        github: { error: "HTTP 404" },
        forgejo: forgeData({
          url: "http://forgejo.test/the-undev/prism",
          latestCi: failingRun,
        }),
      },
    });
    const bird = birdIn([prism], config, "dev/prism");
    const notRead = {
      source: "github",
      text: "not read",
      tone: "amber",
      url: null,
      at: null,
    };

    expect(row(bird, "CI").workings).toEqual([
      notRead,
      expect.objectContaining({ source: "forgejo", tone: "red" }),
    ]);
    expect(row(bird, "open pull requests")).toMatchObject({
      text: "none",
      workings: [notRead],
    });
  });

  it("counts open items and bugs per roadmap file, a file with none silent", async () => {
    const config = await adoptAll(["dev/hollow"]);
    const open = (kind: "bug" | "feature", line: number) => ({
      text: `${kind} ${line}`,
      kind,
      done: false,
      line,
      source: "bullet" as const,
      body: null,
    });
    const hollow = item("dev/hollow", {
      sources: {
        roadmap: {
          counts: { bug: 2, feature: 2 },
          files: [
            {
              path: "docs/roadmap.md",
              items: [open("feature", 1), open("bug", 2)],
              groups: [
                {
                  heading: "Bugs",
                  level: 2,
                  line: 3,
                  role: "group",
                  items: [open("bug", 4), { ...open("bug", 5), done: true }],
                  groups: [],
                  progress: { done: 1, total: 2 },
                },
              ],
            },
            {
              path: "docs/ideas.md",
              items: [open("feature", 1)],
              groups: [],
            },
            { path: "docs/done.md", items: [], groups: [] },
          ],
        },
      },
    });
    const bird = birdIn([hollow], config, "dev/hollow");
    const sourced = (label: string) =>
      row(bird, label).workings.map((working) => [
        working.source,
        working.text,
      ]);

    expect(row(bird, "open bugs").chip).toBe("bugs");
    expect(sourced("open bugs")).toEqual([["docs/roadmap.md", "2 open"]]);
    expect(sourced("open roadmap items")).toEqual([
      ["docs/roadmap.md", "3 open"],
      ["docs/ideas.md", "1 open"],
    ]);
  });

  it("ages uncommitted changes from the oldest, toned by its window", async () => {
    const config = await adoptAll(["dev/gramophone"]);
    const gramophone = item("dev/gramophone", {
      sources: {
        git: gitData({
          uncommittedCount: 14,
          activity: "editing",
          drift: {
            uncommitted: aged(123, "red"),
            unpushed: null,
            level: "red",
            thresholds: { amberHours: 24, redHours: 72 },
          },
        }),
      },
    });
    const bird = birdIn([gramophone], config, "dev/gramophone");

    expect(row(bird, "uncommitted changes")).toMatchObject({
      chip: "uncommitted",
      workings: [
        {
          source: "git",
          text: "oldest change",
          tone: "red",
          url: null,
          at: hoursBefore(123),
        },
      ],
    });
  });

  it("hands a fence bird's rows no chip, for its bubble carries none", async () => {
    const config = await adoptAll([]);
    const found = item("dev/mixed-bag", {
      sources: {
        git: gitData({ uncommittedCount: 2 }),
        github: forgeData({ latestCi: failingRun }),
      },
    });
    const ledger = birdIn([found], config, "dev/mixed-bag").detail.ledger;

    expect(
      ledger.map((entry) => (entry.kind === "time" ? null : entry.chip)),
    ).toEqual(ledger.map(() => null));
    expect(ledger.find((entry) => entry.label === "CI")).toBeDefined();
  });
});

describe("the detail", () => {
  const perch = item("dev/perch", {
    flags: [
      {
        flag: "config-conflict",
        level: null,
        detail:
          'items."dev/perch", items."github:finch/perch": name one item, dev/perch; items."dev/perch" applies',
      },
    ],
    presences: {
      local: { ref: "local:dev/perch", path: "/home/test/dev/perch" },
      forges: [
        {
          forge: "github",
          ref: "github:finch/perch",
          fullName: "finch/perch",
          url: "https://github.com/finch/perch",
          foundBy: "local-remote",
        },
      ],
    },
    sources: {
      git: gitData({
        branch: "contracts",
        upstream: "origin/contracts",
        activity: "in-progress",
        branches: [
          {
            name: "main",
            lastCommitAt: hoursBefore(72),
            subject: "Merge foundations",
            upstream: "origin/main",
          },
          {
            name: "scratch",
            lastCommitAt: hoursBefore(500),
            subject: "Try a thing",
            upstream: null,
          },
          {
            name: "contracts",
            lastCommitAt: hoursBefore(1),
            subject: "Add the view model",
            upstream: "origin/contracts",
          },
        ],
      }),
      roadmap: {
        counts: { bug: 0, feature: 16 },
        files: [{ path: "docs/roadmap.md", items: [], groups: [] }],
      },
      github: forgeData({
        finalisedCommits: [
          {
            sha: "af0893d1234567",
            committedAt: hoursBefore(72),
            subject: "Merge foundations",
          },
        ],
        openPullRequests: [
          {
            number: 4,
            title: "Old",
            author: null,
            draft: true,
            updatedAt: hoursBefore(90),
            url: "https://github.com/finch/perch/pull/4",
          },
          {
            number: 5,
            title: "New",
            author: "finch",
            draft: false,
            updatedAt: hoursBefore(2),
            url: "https://github.com/finch/perch/pull/5",
          },
        ],
      }),
      forgejo: { error: "HTTP 500" },
    },
  });

  it("lists branches current first, then newest, linking those pushed to a forge presence", async () => {
    const config = await adoptAll(["dev/perch"]);

    expect(
      birdIn([perch], config, "dev/perch").detail.branches.map((branch) => [
        branch.name,
        branch.current,
        branch.isDefault,
        branch.url,
      ]),
    ).toEqual([
      [
        "contracts",
        true,
        false,
        "https://github.com/finch/perch/tree/contracts",
      ],
      ["main", false, true, "https://github.com/finch/perch/tree/main"],
      ["scratch", false, false, null],
    ]);
  });

  it("heads the newest commits with the actual branch and forge, linking each", async () => {
    const config = await adoptAll(["dev/perch"]);
    const detail = birdIn([perch], config, "dev/perch").detail;

    expect(detail.newestCommits).toEqual([
      {
        forge: "github",
        heading: "main on GitHub",
        branchUrl: "https://github.com/finch/perch/tree/main",
        commits: [
          {
            sha: "af0893d1234567",
            shortSha: "af0893d",
            subject: "Merge foundations",
            committedAt: hoursBefore(72),
            url: "https://github.com/finch/perch/commit/af0893d1234567",
          },
        ],
      },
    ]);
    expect(detail.pullRequests.map((pull) => pull.number)).toEqual([5, 4]);
    expect(detail.links).toEqual([
      {
        label: "finch/perch on GitHub",
        url: "https://github.com/finch/perch",
      },
    ]);
    expect(detail.flags).toEqual([
      {
        flag: "config-conflict",
        text: "config conflict",
        detail:
          'items."dev/perch", items."github:finch/perch": name one item, dev/perch; items."dev/perch" applies',
        level: null,
      },
    ]);
    expect(detail.problems).toEqual([{ source: "Forgejo", error: "HTTP 500" }]);
  });

  it("offers launch actions as verbs, in the item's zellij session", async () => {
    const config = await adoptAll(
      ["dev/perch", "undev/notes"],
      '[launch.zellij_sessions]\n"~/undev" = "undev"\n',
    );
    const vault = item("undev/notes", { kind: "vault" });

    expect(birdIn([perch], config, "dev/perch").detail.actions).toEqual([
      {
        kind: "zellij-tab",
        verb: "Open the zellij tab",
        session: "home",
        tab: "perch",
        cwd: "/home/test/dev/perch",
      },
      { kind: "vscode", verb: "Open in VS Code", path: "/home/test/dev/perch" },
      { kind: "folder", verb: "Open the folder", path: "/home/test/dev/perch" },
    ]);
    expect(
      birdIn([vault], config, "undev/notes").detail.actions.map((action) =>
        action.kind === "obsidian"
          ? [action.verb, action.vault]
          : action.kind === "zellij-tab"
            ? [action.verb, action.session]
            : [action.verb],
      ),
    ).toEqual([
      ["Open in Obsidian", "notes"],
      ["Open the zellij tab", "undev"],
      ["Open in VS Code"],
      ["Open the folder"],
    ]);
  });

  it("leaves out an action whose command config leaves out", async () => {
    const config = await adoptAll(["undev/notes"]);
    config.launch.commands.terminal = null;
    config.launch.commands.obsidian = null;
    const vault = item("undev/notes", { kind: "vault" });

    expect(
      birdIn([vault], config, "undev/notes").detail.actions.map(
        (action) => action.kind,
      ),
    ).toEqual(["vscode", "folder"]);
  });

  it("says where the bird lives: its clone with home as ~, and each forge once", async () => {
    const presence = (forge: "github" | "forgejo", fullName: string) => ({
      forge,
      ref: `${forge}:${fullName}`,
      fullName,
      url: `https://${forge}.example/${fullName}`,
      foundBy: "local-remote" as const,
    });
    const cloned = item("dev/perch", {
      presences: {
        local: { ref: "local:dev/perch", path: "/home/test/dev/perch" },
        forges: [
          presence("forgejo", "finch/perch"),
          presence("github", "finch/perch"),
          presence("forgejo", "the-undev/perch"),
        ],
      },
    });
    const forgeOnly = item("github:finch/obsidian-tidy", {
      path: null,
      presences: {
        local: null,
        forges: [presence("github", "finch/obsidian-tidy")],
      },
    });
    const oneDisk = item("dev/odin/hello");
    const outside = item("scratch", {
      path: "/srv/scratch",
      presences: {
        local: { ref: "local:/srv/scratch", path: "/srv/scratch" },
        forges: [],
      },
    });
    const items = [cloned, forgeOnly, oneDisk, outside];
    const config = await adoptAll(items.map((entry) => entry.id));
    const whereabouts = (id: string) => {
      const { clonePath, forges } = birdIn(items, config, id).detail;
      return { clonePath, forges };
    };

    expect(whereabouts(cloned.id)).toEqual({
      clonePath: "~/dev/perch",
      forges: ["forgejo", "github"],
    });
    expect(whereabouts(forgeOnly.id)).toEqual({
      clonePath: null,
      forges: ["github"],
    });
    expect(whereabouts(oneDisk.id)).toEqual({
      clonePath: "~/dev/odin/hello",
      forges: [],
    });
    expect(whereabouts(outside.id)).toEqual({
      clonePath: "/srv/scratch",
      forges: [],
    });
  });

  it("offers no launch actions and no key files without a local clone", async () => {
    const config = await adoptAll(["github:finch/obsidian-tidy"]);
    const forgeOnly = item("github:finch/obsidian-tidy", {
      path: null,
      presences: { local: null, forges: [] },
    });
    const detail = birdIn([forgeOnly], config, forgeOnly.id).detail;

    expect([detail.actions, detail.keyFiles]).toEqual([[], []]);
  });

  it("lists the README and roadmaps as key files, unless config names its own", async () => {
    const defaults = await adoptAll(["dev/perch"]);
    const own = await testConfig(
      '[items."dev/perch"]\nkey_files = ["docs/spec.md"]\n',
    );

    expect(birdIn([perch], defaults, "dev/perch").detail.keyFiles).toEqual([
      { path: "README.md", absolutePath: "/home/test/dev/perch/README.md" },
      {
        path: "docs/roadmap.md",
        absolutePath: "/home/test/dev/perch/docs/roadmap.md",
      },
    ]);
    expect(birdIn([perch], own, "dev/perch").detail.keyFiles).toEqual([
      {
        path: "docs/spec.md",
        absolutePath: "/home/test/dev/perch/docs/spec.md",
      },
    ]);
  });
});
