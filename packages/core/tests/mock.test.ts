import { describe, expect, it } from "vitest";
import { importanceFor, resolveEntry, thresholdsFor } from "../src/config.ts";
import {
  configuredCards,
  deriveActivity,
  deriveDrift,
  deriveExpectation,
  deriveStall,
  expectationMet,
} from "../src/derivations.ts";
import { mockAviary, mockConfig, mockSnapshot } from "../src/mock.ts";
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
    expect(deriveAviary(mockSnapshot, mockConfig)).toEqual(mockAviary);
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

  it("holds every mood and every activity among its adopted birds", () => {
    expect(new Set(adopted.map((bird) => bird.mood))).toEqual(
      new Set(["content", "restless", "distressed"]),
    );
    expect(new Set(adopted.map((bird) => bird.activity))).toEqual(
      new Set(["editing", "in-flight", "settled"]),
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

  it("covers every health cause, amber and red unsafe work, and both expectations", () => {
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
        "bugs",
        "uncommitted",
        "unpushed",
        "stalled",
        "expectation",
      ]),
    );
    expect(kinds("amber")).toEqual(
      new Set(["uncommitted", "unpushed", "stalled", "expectation"]),
    );
    expect(kinds("red")).toEqual(
      new Set(["ci-failing", "bugs", "uncommitted", "expectation"]),
    );
    expect(adopted.some((bird) => bird.health.causes.length > 1)).toBe(true);
  });

  it("carries every kind of chip, a clean ledger, a source problem and a scene error", () => {
    const chips = adopted.flatMap((bird) => bird.bubble.chips);

    expect(new Set(chips.map((chip) => chip.kind))).toEqual(
      new Set([
        "ci",
        "expectation",
        "bugs",
        "uncommitted",
        "unpushed",
        "pull-requests",
        "open-items",
      ]),
    );
    expect(chips).toContainEqual(
      expect.objectContaining({ label: "ci failure", severity: "red" }),
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
    expect(birds.some((bird) => bird.kind === "vault")).toBe(true);
    expect(mockAviary.sourceErrors).toHaveLength(1);
    expect(mockAviary.warnings).toHaveLength(1);
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
      expect(item.importance).toBe(importanceFor(mockConfig, entry));
      const thresholds = thresholdsFor(mockConfig, entry);
      expect(item.expectations).toEqual(
        item.expectations.map((expectation) =>
          deriveExpectation(
            expectation.name,
            expectationMet(expectation.name, item.sources),
            expectation.unmetSince,
            thresholds.expectation,
            scannedAt,
          ),
        ),
      );
      expect(item.expectations.map((entry) => entry.name)).toEqual(
        entry?.expect ?? [],
      );
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
