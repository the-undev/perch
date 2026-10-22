// The mock dataset's birds by id, for the tests and the design site.

import { mockAviary } from "@perch/core/mock.ts";
import type { Bird } from "@perch/core/viewmodel.ts";

/** Every bird in the mock aviary: the wires top to bottom, then the fence. */
export const mockBirds: Bird[] = [
  ...mockAviary.wires.flatMap((wire) => wire.birds),
  ...mockAviary.fence.birds,
];

/** One mock bird by id; throws when the mock no longer holds it. */
export function mockBird(id: string): Bird {
  const bird = mockBirds.find((candidate) => candidate.id === id);
  if (bird === undefined) throw new Error(`the mock aviary has no bird ${id}`);
  return bird;
}
