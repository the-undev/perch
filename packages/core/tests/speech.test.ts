import { describe, expect, it } from "vitest";
import type { HealthLevel } from "../src/snapshot.ts";
import {
  countWords,
  daysWords,
  hoursWords,
  type SpeechSubject,
  speak,
} from "../src/speech.ts";
import type { HealthCause } from "../src/viewmodel.ts";
import { aged, hoursBefore } from "./helpers/snapshot.ts";

const windows = { amberHours: 24, redHours: 72 };
const dayWindows = { amberDays: 7, redDays: 30 };

function subject(overrides: Partial<SpeechSubject>): SpeechSubject {
  return {
    fence: null,
    causes: [],
    activity: "settled",
    branch: "main",
    defaultBranch: "main",
    unpushedCount: 0,
    openItems: 0,
    lastTouchedHours: 30,
    ...overrides,
  };
}

const cause = {
  ci: (): HealthCause => ({
    kind: "ci-failing",
    level: "red",
    forge: "forgejo",
    branch: "main",
    run: {
      name: "check",
      state: "failure",
      forgeState: "failure",
      url: null,
      createdAt: null,
    },
  }),
  bugs: (count: number): HealthCause => ({ kind: "bugs", level: "red", count }),
  uncommitted: (
    count: number,
    hours: number,
    level: HealthLevel,
  ): HealthCause => ({
    kind: "uncommitted",
    level,
    count,
    work: aged(hours, level),
    thresholds: windows,
  }),
  unpushed: (
    count: number,
    hours: number,
    level: HealthLevel,
  ): HealthCause => ({
    kind: "unpushed",
    level,
    count,
    work: aged(hours, level),
    thresholds: windows,
  }),
  stalled: (days: number, everythingPushed: boolean): HealthCause => ({
    kind: "stalled",
    level: days >= 30 ? "red" : "amber",
    stall: {
      branch: "extension-popup-ia",
      since: hoursBefore(days * 24),
      days,
      level: days >= 30 ? "red" : "amber",
      thresholds: dayWindows,
    },
    everythingPushed,
  }),
};

describe("content birds are brief", () => {
  it("settled: says so, and when it was last touched", () => {
    expect(speak(subject({ lastTouchedHours: 30 }))).toBe(
      "All settled over here. Last touched 30 hours ago.",
    );
    expect(speak(subject({ lastTouchedHours: null }))).toBe(
      "All settled over here.",
    );
  });

  it("being edited: acknowledges you, with the song", () => {
    expect(speak(subject({ activity: "editing", openItems: 24 }))).toBe(
      "We're in the middle of something. ♪",
    );
  });

  it("settled with a backlog: offers the items", () => {
    expect(speak(subject({ openItems: 12 }))).toBe(
      "All settled, and twelve items on my roadmap when you want me.",
    );
    expect(speak(subject({ openItems: 1 }))).toBe(
      "All settled, and one item on my roadmap when you want me.",
    );
  });

  it("in flight while fresh: names the branch, or the commits waiting to go up", () => {
    expect(
      speak(subject({ activity: "in-flight", branch: "scanner-poc" })),
    ).toBe("Out on scanner-poc. All fresh so far.");
    expect(speak(subject({ activity: "in-flight", unpushedCount: 2 }))).toBe(
      "Two commits waiting to go up. All fresh so far.",
    );
  });
});

describe("restless birds nudge", () => {
  it("uncommitted work ageing", () => {
    expect(
      speak(subject({ causes: [cause.uncommitted(6, 30, "amber")] })),
    ).toBe("Six changes have sat uncommitted for 30 hours. Past a day now.");
    expect(
      speak(subject({ causes: [cause.uncommitted(1, 50, "amber")] })),
    ).toBe("One change has sat uncommitted for two days. Past a day now.");
  });

  it("an unpushed backlog", () => {
    expect(speak(subject({ causes: [cause.unpushed(3, 52, "amber")] }))).toBe(
      "Three commits have been local only for two days. Nothing stops them being pushed.",
    );
    expect(speak(subject({ causes: [cause.unpushed(1, 30, "amber")] }))).toBe(
      "One commit has been local only for 30 hours. Nothing stops it being pushed.",
    );
  });

  it("stalled flight, saying everything is pushed only when it is", () => {
    expect(speak(subject({ causes: [cause.stalled(21, true)] }))).toBe(
      "Parked on extension-popup-ia for three weeks. Everything's pushed, but the flight's gone quiet.",
    );
    expect(speak(subject({ causes: [cause.stalled(9, false)] }))).toBe(
      "Parked on extension-popup-ia for nine days. The flight's gone quiet.",
    );
  });
});

describe("distressed birds are blunt and lead with the worst", () => {
  it("CI failing", () => {
    expect(speak(subject({ causes: [cause.ci()] }))).toBe(
      "My CI is failing on main. Start there.",
    );
  });

  it("open bugs", () => {
    expect(speak(subject({ causes: [cause.bugs(2)] }))).toBe(
      "Two bugs open against me. Not thrilled about it.",
    );
  });

  it("unsafe work gone stale", () => {
    expect(
      speak(subject({ causes: [cause.uncommitted(14, 5 * 24 + 3, "red")] })),
    ).toBe(
      "Fourteen changes uncommitted for five days. I'd rather not be the only copy.",
    );
  });

  it("several things at once: the worst first, one secondary, the rest left to the chips", () => {
    expect(
      speak(
        subject({
          causes: [
            cause.ci(),
            cause.uncommitted(4, 60, "amber"),
            cause.bugs(3),
          ],
        }),
      ),
    ).toBe(
      "My CI is failing on main. I'm also holding four uncommitted changes for two days.",
    );
  });

  it("gives every cause a secondary sentence", () => {
    const secondaries = [
      cause.ci(),
      cause.bugs(1),
      cause.uncommitted(2, 100, "red"),
      cause.unpushed(1, 80, "red"),
      cause.stalled(40, false),
    ].map((next) => speak(subject({ causes: [cause.bugs(2), next] })));

    expect(secondaries.map((speech) => speech.split(". ")[1])).toEqual([
      "My CI is also failing on main.",
      "I've also got one bug open.",
      "I'm also holding two uncommitted changes for four days.",
      "I'm also holding one local-only commit for three days.",
      "I've also been parked on extension-popup-ia for a month.",
    ]);
  });
});

describe("fence birds state where they stand", () => {
  it("forge only, one disk, and found but undecided", () => {
    const fence = (situation: SpeechSubject["fence"]) =>
      speak(subject({ fence: situation, causes: [cause.bugs(2)] }));

    expect(
      fence({
        kind: "forge-only",
        forge: "github",
        fullName: "finch/obsidian-tidy",
      }),
    ).toBe(
      "Nobody's cloned me yet. I live on GitHub as finch/obsidian-tidy.",
    );
    expect(fence({ kind: "one-disk" })).toBe(
      "I only exist on this machine. One disk, no backup.",
    );
    expect(fence({ kind: "undecided" })).toBe(
      "Still on the fence. You haven't decided about me.",
    );
  });
});

describe("the voice", () => {
  it("never exclaims and never runs past three sentences", () => {
    const all = [
      cause.ci(),
      cause.bugs(9),
      cause.uncommitted(30, 200, "red"),
      cause.unpushed(21, 20, "amber"),
      cause.stalled(100, true),
    ];
    const speeches = all.flatMap((first) =>
      all.map((second) =>
        speak(
          subject({ causes: first === second ? [first] : [first, second] }),
        ),
      ),
    );

    for (const speech of speeches) {
      expect(speech).not.toContain("!");
      expect(speech.split(/(?<=\.) /).length).toBeLessThanOrEqual(3);
    }
  });

  it("spells counts to twenty and spans in the largest whole unit", () => {
    expect([countWords(0), countWords(20), countWords(21)]).toEqual([
      "zero",
      "twenty",
      "21",
    ]);
    expect([0, 1, 5, 47, 48, 24 * 20].map(hoursWords)).toEqual([
      "under an hour",
      "an hour",
      "five hours",
      "47 hours",
      "two days",
      "two weeks",
    ]);
    expect([1, 13, 14, 29, 30, 59, 60, 400].map(daysWords)).toEqual([
      "a day",
      "thirteen days",
      "two weeks",
      "four weeks",
      "a month",
      "a month",
      "two months",
      "thirteen months",
    ]);
  });
});
