import { describe, expect, it } from "vitest";
import { resolveEntry, thresholdsFor } from "../src/config.ts";
import {
  configuredCards,
  countOpenItems,
  deriveActivity,
  deriveDrift,
  deriveStall,
} from "../src/derivations.ts";
import { launchKinds } from "../src/launch-kinds.ts";
import { mockAviary, mockConfig, mockHome, mockSnapshot } from "../src/mock.ts";
import type { GitData } from "../src/snapshot.ts";
import { speak } from "../src/speech.ts";
import { deriveAviary, speechSubjectFor } from "../src/viewmodel.ts";

const scannedAt = new Date(mockSnapshot.scannedAt);
const birds = [
  ...mockAviary.wires.flatMap((wire) => wire.birds),
  ...mockAviary.fence.birds,
];
const adopted = birds.filter((bird) => bird.adopted);

describe("the mock dataset", () => {
  it("derives the exported aviary", () => {
    expect(deriveAviary(mockSnapshot, mockConfig, mockHome)).toEqual(
      mockAviary,
    );
  });

  it("gives each bird the speech its own speech subject speaks", () => {
    for (const bird of birds) {
      const item = mockSnapshot.items.find(
        (candidate) => candidate.id === bird.id,
      );
      if (item === undefined) throw new Error(`no item ${bird.id}`);

      expect(speak(speechSubjectFor(item, mockConfig, scannedAt))).toBe(
        bird.bubble.speech,
      );
    }
  });

  it("holds every mood and every activity among its adopted birds, and one with no clone and so no activity", () => {
    expect(new Set(adopted.map((bird) => bird.mood))).toEqual(
      new Set(["content", "restless", "distressed"]),
    );
    expect(new Set(adopted.map((bird) => bird.activity))).toEqual(
      new Set(["editing", "in-flight", "settled", null]),
    );
  });

  it("puts birds on every wire, and the fence's three situations beneath", () => {
    expect(mockAviary.wires.every((wire) => wire.birds.length > 0)).toBe(true);
    expect(mockAviary.fence.birds.map((bird) => bird.bubble.speech)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Nobody's cloned me yet\./),
        expect.stringMatching(/^I only exist on this machine\./),
        expect.stringMatching(/^Still on the fence\./),
      ]),
    );
  });

  it("covers every health cause, and amber and red unsafe work", () => {
    const causes = adopted.flatMap((bird) => bird.health.causes);
    const kinds = (level: string) =>
      new Set(
        causes
          .filter((cause) => cause.level === level)
          .map((cause) => cause.kind),
      );

    expect(new Set(causes.map((cause) => cause.kind))).toEqual(
      new Set([
        "ci-failing",
        "unreadable-remote",
        "bugs",
        "uncommitted",
        "unpushed",
        "stalled",
      ]),
    );
    expect(kinds("amber")).toEqual(
      new Set(["unreadable-remote", "uncommitted", "unpushed", "stalled"]),
    );
    expect(kinds("red")).toEqual(
      new Set(["ci-failing", "bugs", "uncommitted"]),
    );
    expect(adopted.some((bird) => bird.health.causes.length > 1)).toBe(true);
  });

  it("splits unpushed commits over several branches, one ahead of its upstream and one with none", () => {
    const dotfiles = birds.find((bird) => bird.id === ".dotfiles");
    const row = dotfiles?.detail.ledger.find(
      (entry) => entry.label === "unpushed commits",
    );

    expect(row).toMatchObject({
      count: 4,
      tone: "amber",
      workings: [
        {
          text: "main, 3 ahead of origin/main",
          tone: "amber",
          url: "https://github.com/finch/dotfiles/tree/main",
        },
        { text: "split-layout, no upstream, 1 commit", tone: null, url: null },
      ],
    });
  });

  it("carries every kind of chip, a clean ledger, a source problem and a scene error", () => {
    const chips = adopted.flatMap((bird) => bird.bubble.chips);

    expect(new Set(chips.map((chip) => chip.kind))).toEqual(
      new Set([
        "unreadable",
        "ci",
        "bugs",
        "uncommitted",
        "unpushed",
        "stalled",
        "pull-requests",
        "open-items",
      ]),
    );
    expect(chips).toContainEqual(
      expect.objectContaining({ label: "parked 21 days", severity: "amber" }),
    );
    expect(chips).toContainEqual(
      expect.objectContaining({ label: "ci failure", severity: "red" }),
    );
    expect(chips).toContainEqual(
      expect.objectContaining({
        label: "can't read github",
        severity: "amber",
      }),
    );
    expect(
      adopted.some(
        (bird) =>
          bird.bubble.chips.length === 0 &&
          bird.detail.ledger.every(
            (entry) => entry.kind !== "count" || entry.text === "none",
          ),
      ),
    ).toBe(true);
    expect(adopted.some((bird) => bird.detail.problems.length > 0)).toBe(true);
    expect(birds.some((bird) => bird.kind === "obsidian")).toBe(true);
    expect(mockAviary.sourceErrors).toHaveLength(1);
    expect(mockAviary.warnings).toHaveLength(1);
  });

  it("opens a ledger with each quiet sentence, and another with none", () => {
    expect(new Set(birds.map((bird) => bird.detail.quiet))).toEqual(
      new Set([
        "The working tree is clean and everything is pushed.",
        "The working tree is clean; no remote holds a copy.",
        null,
      ]),
    );
  });

  it("offers every kind of launch action, the Obsidian one on Obsidian birds alone, and none without a clone", () => {
    const kinds = (bird: (typeof birds)[number]) =>
      bird.detail.actions.map((action) => action.kind);

    expect(new Set(birds.flatMap(kinds))).toEqual(
      new Set(["zellij", "command", "obsidian"]),
    );
    for (const bird of birds) {
      expect(kinds(bird).includes("obsidian"), bird.id).toBe(
        bird.kind === "obsidian",
      );
    }
    const unCloned = birds.filter((bird) => bird.detail.clonePath === null);
    expect(unCloned.length).toBeGreaterThan(0);
    expect(unCloned.flatMap(kinds)).toEqual([]);
  });

  it("holds every kind of launch action in config, one overridden, and a custom command wearing a picked icon", () => {
    const actions = mockConfig.launch.actions;
    const perch = birds.find((bird) => bird.id === "dev/perch");

    expect(new Set(actions.map((action) => action.kind))).toEqual(
      new Set(launchKinds),
    );
    expect(actions).toContainEqual(
      expect.objectContaining({
        kind: "folder",
        command: ["dolphin", "{path}"],
      }),
    );
    expect(
      perch?.detail.actions.map((action) => [action.verb, action.icon]),
    ).toEqual([
      ["Open the zellij tab", "terminal"],
      ["Open in VS Code", "code"],
      ["Open the folder", "folder"],
      ["Open in nvim", "edit"],
      ["Follow the log", "terminal"],
    ]);
  });

  it("hands each chip on a bubble one ledger row or the notice holding its working, and nothing a chip it lacks", () => {
    for (const bird of birds) {
      const handled = [
        ...bird.detail.ledger.flatMap((entry) =>
          entry.kind === "time" || entry.chip === null ? [] : [entry.chip],
        ),
        ...(bird.detail.branches.length > 0 &&
        bird.bubble.chips.some((chip) => chip.kind === "stalled")
          ? ["stalled" as const]
          : []),
        ...(bird.detail.notices.length > 0 && bird.adopted
          ? ["unreadable" as const]
          : []),
      ];

      expect(handled.sort(), bird.id).toEqual(
        bird.bubble.chips.map((chip) => chip.kind).sort(),
      );
    }
  });

  it("spells out two forges disagreeing on CI, a forge's part that couldn't be read, and open items over two roadmap files", () => {
    const rows = (label: string) =>
      adopted.flatMap((bird) =>
        bird.detail.ledger.flatMap((entry) =>
          entry.kind !== "time" && entry.label === label ? [entry] : [],
        ),
      );
    const runStates = rows("CI").map(
      (row) =>
        new Set(
          row.workings
            .filter((working) => working.url !== null)
            .map((working) => working.text.split(" ")[0]),
        ),
    );

    expect(runStates.some((states) => states.size > 1)).toBe(true);
    expect(
      adopted.some((bird) =>
        bird.detail.ledger.some(
          (entry) =>
            entry.kind !== "time" &&
            entry.workings.some((working) =>
              working.text.startsWith("couldn't read "),
            ),
        ),
      ),
    ).toBe(true);
    expect(
      rows("open roadmap items").some((row) => row.workings.length > 1),
    ).toBe(true);
  });

  it("holds a forge whose pull requests alone couldn't be read, its CI and commits shown", () => {
    const pullsUnread = adopted.flatMap((bird) => {
      const unread = bird.detail.problems.filter(
        (problem) => problem.source === "GitHub pull requests",
      );
      if (unread.length === 0) return [];
      const ci = bird.detail.ledger.find((entry) => entry.label === "CI");
      return [
        {
          ciFromGithub:
            ci?.kind === "state" &&
            ci.workings.some(
              (working) => working.source === "github" && working.url !== null,
            ),
          spreadOnGithub: bird.detail.river.commits.some((commit) =>
            commit.spread.includes("github"),
          ),
          notes: bird.detail.river.notes,
        },
      ];
    });

    expect(pullsUnread).toEqual([
      { ciFromGithub: true, spreadOnGithub: true, notes: [] },
    ]);
  });

  it("holds a restless bird whose remote no card can read, and a fence bird whose tokens failed untroubled", () => {
    const skiff = birds.find((bird) => bird.id === "undev/skiff");
    const homeIt = birds.find((bird) => bird.id === "dev/hearth-config");

    expect(skiff?.mood).toBe("restless");
    expect(skiff?.health.causes[0]?.kind).toBe("unreadable-remote");
    expect(skiff?.detail.notices).toHaveLength(1);
    expect(skiff?.detail.river.notes).toEqual([
      "couldn't read github · no card covers skiff-app",
    ]);
    expect(homeIt?.health.causes).toEqual([]);
    expect(homeIt?.detail.notices).toEqual([]);
    expect(homeIt?.detail.problems).toHaveLength(2);
    expect(
      homeIt?.detail.river.commits.every((commit) => commit.tone === "amber"),
    ).toBe(true);
  });

  it("holds a bird with a clone and forges, one with no clone, and one with no forge", () => {
    const whereabouts = birds.map(({ detail }) => ({
      cloned: detail.clonePath !== null,
      forged: detail.forges.length > 0,
    }));

    expect(whereabouts).toEqual(
      expect.arrayContaining([
        { cloned: true, forged: true },
        { cloned: false, forged: true },
        { cloned: true, forged: false },
      ]),
    );
    expect(
      birds.every(
        ({ detail }) =>
          detail.clonePath === null || detail.clonePath.startsWith("~/"),
      ),
    ).toBe(true);
  });

  it("holds the no-clone slip on a wire and on the fence, its clause on the meta line, and on no bird with a clone", () => {
    const slipped = birds.filter((bird) => bird.detail.noClone !== null);

    expect(
      slipped.map((bird) => [bird.adopted, bird.detail.noClone?.forges]),
    ).toEqual(
      expect.arrayContaining([
        [true, "Forgejo"],
        [false, "GitHub"],
      ]),
    );
    expect(
      slipped.every(
        (bird) =>
          bird.detail.noClone?.cloneAddress !== null &&
          bird.detail.noClone?.onMetaLine,
      ),
    ).toBe(true);
    expect(
      birds
        .filter((bird) => bird.detail.clonePath !== null)
        .every((bird) => bird.detail.noClone === null),
    ).toBe(true);
  });

  it("tones river commits for every spread, with a divergence and a forge that couldn't be read", () => {
    const rivers = birds.map(({ detail }) => detail.river);
    const spreads = new Set(
      rivers.flatMap((river) =>
        river.commits.map((commit) => `${commit.tone} ${commit.spread}`),
      ),
    );

    expect([...spreads]).toEqual(
      expect.arrayContaining([
        "green on github and forgejo",
        "green on forgejo",
        "amber only on github",
        "amber not pushed to a remote",
        "amber no remote could be read",
        "null no remote",
      ]),
    );
    expect(rivers.some((river) => river.divergence !== null)).toBe(true);
    expect(rivers.some((river) => river.notes.length > 0)).toBe(true);
  });

  it("counts Perch's commits beyond Forgejo's list as held there", () => {
    const perch = birds.find((bird) => bird.id === "dev/perch");

    expect(perch?.detail.river.commits.map((commit) => commit.tone)).toEqual([
      "green",
      "green",
      "green",
    ]);
  });

  it("has a source card per configured table, covering every scan state", () => {
    const cards = mockSnapshot.sourceCards;
    const states = cards.map((card) =>
      card.result.state === "ok" && card.result.missingIncludes.length > 0
        ? "ok-missing-include"
        : card.result.state,
    );

    expect(cards.map(({ id, kind, label }) => ({ id, kind, label }))).toEqual(
      configuredCards(mockConfig.sources, "/home/owner").map(
        ({ id, kind, label }) => ({ id, kind, label }),
      ),
    );
    expect(new Set(states)).toEqual(
      new Set(["never-scanned", "ok", "ok-missing-include", "failed"]),
    );
    expect(cards.find((card) => card.kind === "local")?.result).toMatchObject({
      count: mockSnapshot.items.filter((item) => item.presences.local !== null)
        .length,
    });
  });

  it("agrees with the derivation rules wherever it states a judged value", () => {
    for (const item of mockSnapshot.items) {
      const entry = resolveEntry(mockConfig, item.id, [
        ...(item.presences.local ? [item.presences.local.ref] : []),
        ...item.presences.forges.map((presence) => presence.ref),
      ]).entry;
      const thresholds = thresholdsFor(mockConfig, entry);
      const roadmap = item.sources.roadmap;
      if (roadmap !== undefined && !("error" in roadmap)) {
        expect(roadmap.counts, item.id).toEqual(countOpenItems(roadmap.files));
      }
      const git = item.sources.git;
      if (git === undefined || "error" in git) continue;
      expect(git.drift, item.id).toEqual(
        deriveDrift(
          {
            oldestUncommittedAt: git.oldestUncommittedAt,
            oldestUnpushedAt: git.oldestUnpushedAt,
          },
          thresholds.unsafe,
          scannedAt,
        ),
      );
      const unpushedSince = (git.unpushedBranches ?? []).map(
        (branch) => branch.work.since,
      );
      if (unpushedSince.length > 0) {
        expect(unpushedSince.sort()[0], item.id).toBe(git.oldestUnpushedAt);
      }
      expect(git.stall, item.id).toEqual(
        deriveStall(
          {
            branch: git.branch,
            defaultBranch: git.defaultBranch,
            branchLastCommitAt: currentBranchCommit(git),
          },
          thresholds.stalled,
          scannedAt,
        ),
      );
      const mainBranch = git.branches.find(
        (branch) => branch.name === git.defaultBranch,
      );
      const [newestOnMain] = git.defaultBranchCommits ?? [];
      expect(
        newestOnMain && [
          Date.parse(newestOnMain.committedAt),
          newestOnMain.subject,
        ],
        item.id,
      ).toEqual(
        mainBranch && [Date.parse(mainBranch.lastCommitAt), mainBranch.subject],
      );
      expect(git.activity, item.id).toBe(
        deriveActivity({
          uncommittedCount: git.uncommittedCount,
          unpushedCount: git.unpushedCount,
          branch: git.branch,
          defaultBranch: git.defaultBranch,
          branchNames: git.branches.map((branch) => branch.name),
        }),
      );
    }
  });
});

function currentBranchCommit(git: GitData): string | null {
  return (
    git.branches.find((branch) => branch.name === git.branch)?.lastCommitAt ??
    null
  );
}
