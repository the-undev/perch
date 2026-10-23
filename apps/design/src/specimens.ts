// Values the usage pages render: the mock dataset's birds, the moment its scan was taken, and
// hand-built variants for states the mock does not hold.

import { mockAviary } from "@perch/core/mock.ts";
import {
  type Aviary,
  type Bird,
  compareOnWire,
  type Wire,
} from "@perch/core/viewmodel.ts";
import { mockBird } from "@perch/ui/mock-birds.ts";

export { mockBird, mockBirds, mockEntryForm } from "@perch/ui/mock-birds.ts";

/** The mock scan's moment: times on the pages are measured to it, so they never drift. */
export const scanMoment = new Date(mockAviary.scannedAt);

/** A bird moved to another importance tier: rank 0 is the most important of three. */
export function atRank(bird: Bird, rank: number): Bird {
  return { ...bird, size: { ...bird.size, rank } };
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
    .sort(compareOnWire)
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
    .sort((a, b) => a.name.localeCompare(b.name))
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
    bubble: { ...hello.bubble, stateWord: hello.mood },
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
