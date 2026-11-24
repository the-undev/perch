// Values the usage pages render: the mock dataset's birds, the moment its scan was taken, and
// hand-built variants for states the mock does not hold.

import {
  mockAviary,
  mockConfig,
  mockHome,
  mockRoadmap,
  mockSnapshot,
} from "@perch/core/mock.ts";
import type { Entity, ForgeRepository } from "@perch/core/snapshot.ts";
import type {
  KeyringCalls,
  SourceTested,
  TokenStored,
} from "@perch/core/sources-form.ts";
import {
  type Aviary,
  type Bird,
  compareByName,
  deriveAviary,
  type LedgerFact,
  type Wire,
} from "@perch/core/viewmodel.ts";
import { mockBird } from "@perch/ui/mock-birds.ts";
import type { SnoozeCalls } from "@perch/ui/snooze-action.tsx";

export {
  mockBird,
  mockBirds,
  mockPapersForm,
  quietSnooze,
} from "@perch/ui/mock-birds.ts";

/** The mock scan's moment: times on the pages are measured to it, so they never drift. */
export const scanMoment = new Date(mockAviary.scannedAt);

/** An afternoon on the mock scan's day: every bird awake. */
export const byDay = new Date(2026, 9, 22, 14, 0);

/** Half past ten on the mock scan's day: the sky at night, every bird still awake. */
export const lateEvening = new Date(2026, 9, 22, 22, 30);

/** The small hours after the mock scan: the sky at night and every bird that sleeps asleep. */
export const smallHours = new Date(2026, 9, 23, 3, 0);

/** A bird the owner has snoozed until a date, or until woken for null. */
export function snoozedUntil(bird: Bird, until: string | null): Bird {
  return { ...bird, snooze: { until } };
}

/** Snooze calls that say what was pressed, so a page shows the control working. */
export function reportedSnooze(onPress: (what: string) => void): SnoozeCalls {
  return {
    pickedAt: () => scanMoment,
    onSnooze: (birdId, until) =>
      onPress(`onSnooze(${birdId}, ${until ?? "indefinitely"})`),
    onWake: (birdId) => onPress(`onWake(${birdId})`),
  };
}

/** A bird carrying a given amount of outstanding work, against the cap of 50. */
export function withOutstanding(bird: Bird, outstanding: number): Bird {
  return {
    ...bird,
    plumpness: { outstanding, fullness: Math.min(outstanding, 50) / 50 },
  };
}

/** One mock wire by name; throws when the mock no longer holds it. */
export function mockWire(name: string): Wire {
  const wire = mockAviary.wires.find((candidate) => candidate.name === name);
  if (wire === undefined)
    throw new Error(`the mock aviary has no wire ${name}`);
  return wire;
}

/** The mock aviary with other wires, the fence and the scene's notices kept. */
export function aviaryWith(wires: Wire[]): Aviary {
  return { ...mockAviary, wires };
}

/** Birds in the order the view model gives a wire, their positions renumbered. */
function onWire(birds: Bird[]): Bird[] {
  return [...birds]
    .sort(compareByName)
    .map((bird, position) => ({ ...bird, position }));
}

/** A wire of `count` birds: the mock's adopted birds over again, each copy numbered. */
export function crowdedWire(name: string, count: number): Wire {
  const adopted = mockAviary.wires.flatMap((wire) => wire.birds);
  const birds = Array.from({ length: count }, (_, i) => {
    const source = adopted[i % adopted.length] as Bird;
    const copy = `${source.name} ${Math.floor(i / adopted.length) + 1}`;
    return {
      ...source,
      id: `${name}/${i}`,
      name: copy,
      wire: name,
      bubble: { ...source.bubble, name: copy },
    };
  });
  return { name, birds: onWire(birds) };
}

/** The mock aviary with a fence of `count` birds: the mock's fence birds over again, each copy numbered. */
export function crowdedFence(count: number): Aviary {
  const fence = mockAviary.fence.birds;
  const birds = Array.from({ length: count }, (_, i) => {
    const source = fence[i % fence.length] as Bird;
    const copy = `${source.name} ${Math.floor(i / fence.length) + 1}`;
    return {
      ...source,
      id: `fence/${i}`,
      name: copy,
      bubble: { ...source.bubble, name: copy },
    };
  });
  // The fence is ordered by name.
  const byName = birds
    .sort(compareByName)
    .map((bird, position) => ({ ...bird, position }));
  return { ...mockAviary, fence: { birds: byName } };
}

/** The mock aviary after a scan in which config adopts Hello onto Projects: a large change. */
export function withHelloAdopted(): Aviary {
  const hello = mockBird("dev/odin/hello");
  const adopted: Bird = {
    ...hello,
    adopted: true,
    wire: "Projects",
  };
  return {
    ...mockAviary,
    wires: mockAviary.wires.map((wire) =>
      wire.name === "Projects"
        ? { ...wire, birds: onWire([...wire.birds, adopted]) }
        : wire,
    ),
    fence: {
      birds: mockAviary.fence.birds
        .filter((bird) => bird.id !== hello.id)
        .map((bird, position) => ({ ...bird, position })),
    },
  };
}

const pergolaNotesId = "forgejo:finch/field-notes";

/** Pergola Notes derived again from the mock snapshot with its forge repositories changed, so its words are the view model's. */
function pergolaNotesWith(
  repositories: (forges: ForgeRepository[]) => ForgeRepository[],
): Bird {
  const entities = mockSnapshot.entities.map(
    (entity): Entity =>
      entity.id === pergolaNotesId
        ? {
            ...entity,
            repositories: {
              ...entity.repositories,
              forges: repositories(entity.repositories.forges),
            },
          }
        : entity,
  );
  const aviary = deriveAviary(
    { ...mockSnapshot, entities },
    mockConfig,
    {},
    mockHome,
  );
  const bird = aviary.wires
    .flatMap((wire) => wire.birds)
    .find((candidate) => candidate.id === pergolaNotesId);
  if (bird === undefined) throw new Error("the mock has no Pergola Notes");
  return bird;
}

/** Pergola Notes read from a snapshot cached before the scanner kept SSH addresses. */
export function pergolaNotesCached(): Bird {
  return pergolaNotesWith((forges) =>
    forges.map(({ sshUrl: _, ...repository }) => repository),
  );
}

/** Pergola Notes held on GitHub as well as Forgejo, GitHub found second. */
export function pergolaNotesOnBothForges(): Bird {
  return pergolaNotesWith((forges) => [
    ...forges,
    {
      forge: "github",
      ref: "github:finch/field-notes",
      fullName: "finch/field-notes",
      url: "https://github.com/finch/field-notes",
      sshUrl: "git@github.com:finch/field-notes.git",
      foundBy: "account-listing",
    },
  ]);
}

/** What stub keyring calls answer; never leaves the call running. */
export interface KeyringAnswers {
  stored: TokenStored;
  tested: SourceTested | "never";
}

/**
 * Keyring calls that answer after a moment, as the main process would, and report each call by
 * its key or card, never the token.
 */
export function stubKeyring(
  answers: KeyringAnswers,
  onCall: (call: string) => void,
): KeyringCalls {
  const later = <T>(value: T) =>
    new Promise<T>((resolve) => setTimeout(() => resolve(value), 700));
  return {
    storeToken: (key) => {
      onCall(`storeToken("${key}", token)`);
      return later(answers.stored);
    },
    testSource: (values) => {
      onCall(`testSource({ kind: "${values.kind}", key: "${values.key}" })`);
      const { tested } = answers;
      return tested === "never" ? new Promise(() => {}) : later(tested);
    },
  };
}

const bugLedgerEntityId = "undev/Hollow-legacy";

/** Hollow's bug and critical bug ledger rows derived again with the given open counts, the windows 5 and 20 for bugs and 3 and 6 for critical bugs. */
export function bugLedgerRows(bug: number, criticalBug: number): LedgerFact[] {
  const entities = mockSnapshot.entities.map(
    (entity): Entity =>
      entity.id === bugLedgerEntityId
        ? {
            ...entity,
            sources: {
              ...entity.sources,
              roadmap: {
                ...mockRoadmap([
                  { path: "docs/roadmap.md", task: 0, bug, criticalBug },
                ]),
                thresholds: {
                  bugs: { amberCount: 5, redCount: 20 },
                  criticalBugs: { amberCount: 3, redCount: 6 },
                },
              },
            },
          }
        : entity,
  );
  const aviary = deriveAviary(
    { ...mockSnapshot, entities },
    mockConfig,
    {},
    mockHome,
  );
  const bird = aviary.wires
    .flatMap((wire) => wire.birds)
    .find((candidate) => candidate.id === bugLedgerEntityId);
  if (bird === undefined) throw new Error("the mock has no Hollow");
  return bird.detail.ledger.filter(
    (fact) => fact.kind === "count" && fact.label.includes("bugs in"),
  );
}
