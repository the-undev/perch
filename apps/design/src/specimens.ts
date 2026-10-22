// Values the usage pages render: the mock dataset's birds, the moment its scan was taken, and
// hand-built variants for states the mock does not hold.

import { mockAviary } from "@perch/core/mock.ts";
import type { Bird, Wire } from "@perch/core/viewmodel.ts";

export { mockBird, mockBirds } from "@perch/ui/mock-birds.ts";

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
