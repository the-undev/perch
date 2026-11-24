import { describe, expect, it } from "vitest";
import { resolvePapers, thresholdsFor } from "../src/config.ts";
import {
  configuredCards,
  countOpenWorkItems,
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
    expect(deriveAviary(mockSnapshot, mockConfig, {}, mockHome)).toEqual(
      mockAviary,
    );
  });

  it("gives each bird the speech its own speech subject speaks", () => {
    for (const bird of birds) {
      const entity = mockSnapshot.entities.find(
        (candidate) => candidate.id === bird.id,
      );
      if (entity === undefined) throw new Error(`no entity ${bird.id}`);

      expect(speak(speechSubjectFor(entity, mockConfig, scannedAt))).toBe(
        bird.bubble.speech,
      );
    }
  });

  it("holds every mood and every activity among its adopted birds, and one with no local repository and so no activity", () => {
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
        expect.stringMatching(/^I live on /),
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
      new Set([
        "unreadable-remote",
        "bugs",
        "uncommitted",
        "unpushed",
        "stalled",
      ]),
    );
    expect(kinds("red")).toEqual(
      new Set(["ci-failing", "bugs", "uncommitted"]),
    );
    expect(adopted.some((bird) => bird.health.causes.length > 1)).toBe(true);
  });

  it("holds roadmap files within their bug windows, past amber on critical bugs, and past red on bugs", () => {
    const bugCauses = adopted.flatMap((bird) =>
      bird.health.causes.flatMap((cause) =>
        cause.kind === "bugs" ? [[cause.level, cause.critical]] : [],
      ),
    );
    const quietBugRows = adopted.flatMap((bird) =>
      bird.detail.ledger.filter(
        (fact) =>
          fact.kind === "count" &&
          fact.label.startsWith("bugs in") &&
          fact.count > 0 &&
          fact.tone === null,
      ),
    );

    expect(bugCauses).toEqual(
      expect.arrayContaining([
        ["amber", true],
        ["red", false],
      ]),
    );
    expect(quietBugRows.length).toBeGreaterThan(0);
  });

  it("splits unpushed commits over several branches, one ahead of its upstream and one with none", () => {
    const dotfiles = birds.find((bird) => bird.id === ".dotfiles");
    const row = dotfiles?.detail.ledger.find(
      (fact) => fact.label === "unpushed commits",
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
        "critical-bugs",
        "uncommitted",
        "unpushed",
        "stalled",
        "pull-requests",
        "open-work-items",
      ]),
    );
    expect(chips).toContainEqual(
      expect.objectContaining({ label: "stalled 21 days", severity: "amber" }),
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
            (fact) => fact.kind !== "count" || fact.text === "none",
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

  it("offers every kind of launch action, the Obsidian one on Obsidian birds alone, and none without a local repository", () => {
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
    const withoutLocalRepository = birds.filter(
      (bird) => bird.detail.localRepositoryPath === null,
    );
    expect(withoutLocalRepository.length).toBeGreaterThan(0);
    expect(withoutLocalRepository.flatMap(kinds)).toEqual([]);
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
        ...bird.detail.ledger.flatMap((fact) =>
          fact.kind === "time" || fact.chip === null ? [] : [fact.chip],
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

  it("spells out two forges disagreeing on CI, a forge's part that couldn't be read, and open work items over two roadmap files", () => {
    const rows = (label: string) =>
      adopted.flatMap((bird) =>
        bird.detail.ledger.flatMap((fact) =>
          fact.kind !== "time" && fact.label === label ? [fact] : [],
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
          (fact) =>
            fact.kind !== "time" &&
            fact.workings.some((working) =>
              working.text.startsWith("couldn't read "),
            ),
        ),
      ),
    ).toBe(true);
    expect(rows("open work items").some((row) => row.workings.length > 1)).toBe(
      true,
    );
  });

  it("holds a forge whose pull requests alone couldn't be read, its CI and commits shown", () => {
    const pullsUnread = adopted.flatMap((bird) => {
      const unread = bird.detail.problems.filter(
        (problem) => problem.source === "GitHub pull requests",
      );
      if (unread.length === 0) return [];
      const ci = bird.detail.ledger.find((fact) => fact.label === "CI");
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

  it("holds a bird with a local repository and forges, one with no local repository, and one with no forge", () => {
    const whereabouts = birds.map(({ detail }) => ({
      local: detail.localRepositoryPath !== null,
      forged: detail.forges.length > 0,
    }));

    expect(whereabouts).toEqual(
      expect.arrayContaining([
        { local: true, forged: true },
        { local: false, forged: true },
        { local: true, forged: false },
      ]),
    );
    expect(
      birds.every(
        ({ detail }) =>
          detail.localRepositoryPath === null ||
          detail.localRepositoryPath.startsWith("~/"),
      ),
    ).toBe(true);
  });

  it("holds the no-local-repository slip on a wire and on the fence, its clause on the meta line, and on no bird with a local repository", () => {
    const slipped = birds.filter(
      (bird) => bird.detail.noLocalRepository !== null,
    );

    expect(
      slipped.map((bird) => [
        bird.adopted,
        bird.detail.noLocalRepository?.forges,
      ]),
    ).toEqual(
      expect.arrayContaining([
        [true, "Forgejo"],
        [false, "GitHub"],
      ]),
    );
    expect(
      slipped.every(
        (bird) =>
          bird.detail.noLocalRepository?.cloneAddress !== null &&
          bird.detail.noLocalRepository?.onMetaLine,
      ),
    ).toBe(true);
    expect(
      birds
        .filter((bird) => bird.detail.localRepositoryPath !== null)
        .every((bird) => bird.detail.noLocalRepository === null),
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
      count: mockSnapshot.entities.filter(
        (entity) => entity.repositories.local !== null,
      ).length,
    });
  });

  it("covers a bird whose roadmap is parsed because its papers list it, and one whose standard file is only shown", () => {
    const rawEntry = (id: string) =>
      mockConfig.entities[id] ?? { roadmaps: undefined };
    const roadmapOfBird = (id: string) =>
      mockSnapshot.entities.find((entity) => entity.id === id)?.sources.roadmap;
    const hollow = roadmapOfBird("undev/Hollow-legacy");
    const spool = roadmapOfBird("undev/spool");

    expect(rawEntry("undev/Hollow-legacy").roadmaps).toEqual([
      "docs/roadmap.md",
    ]);
    expect(hollow).toMatchObject({
      files: [{ path: "docs/roadmap.md", counts: { bug: 23 } }],
      detectedPath: null,
    });
    expect(rawEntry("undev/spool").roadmaps).toBeNull();
    expect(spool).toMatchObject({ files: [], detectedPath: "docs/roadmap.md" });
    expect(
      birds
        .find((bird) => bird.id === "undev/spool")
        ?.detail.keyFiles.map((file) => file.path),
    ).toEqual(["README.md", "docs/roadmap.md"]);
  });

  it("agrees with the derivation rules wherever it states a judged value", () => {
    for (const entity of mockSnapshot.entities) {
      const papers = resolvePapers(mockConfig, entity.id, [
        ...(entity.repositories.local ? [entity.repositories.local.ref] : []),
        ...entity.repositories.forges.map((repository) => repository.ref),
      ]).papers;
      const thresholds = thresholdsFor(mockConfig, papers);
      const roadmap = entity.sources.roadmap;
      if (roadmap !== undefined && !("error" in roadmap)) {
        expect(roadmap.counts, entity.id).toEqual(
          countOpenWorkItems(roadmap.files),
        );
        for (const file of roadmap.files) {
          expect(file.counts, `${entity.id} ${file.path}`).toEqual(
            countOpenWorkItems([file]),
          );
        }
        expect(roadmap.thresholds, entity.id).toEqual({
          bugs: thresholds.bugs,
          criticalBugs: thresholds.criticalBugs,
        });
      }
      const git = entity.sources.git;
      if (git === undefined || "error" in git) continue;
      expect(git.drift, entity.id).toEqual(
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
        expect(unpushedSince.sort()[0], entity.id).toBe(git.oldestUnpushedAt);
      }
      expect(git.stall, entity.id).toEqual(
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
        entity.id,
      ).toEqual(
        mainBranch && [Date.parse(mainBranch.lastCommitAt), mainBranch.subject],
      );
      expect(git.activity, entity.id).toBe(
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
