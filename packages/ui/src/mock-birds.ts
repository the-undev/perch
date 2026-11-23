// The mock dataset's birds by id, their entry forms and the settings form, for the tests and the
// design site.

import { type EntryForm, entryFormFor } from "@perch/core/entry-form.ts";
import {
  mockAviary,
  mockConfig,
  mockHome,
  mockImage,
  mockLogin,
  mockSnapshot,
} from "@perch/core/mock.ts";
import {
  type SettingsForm,
  settingsFormFor,
} from "@perch/core/settings-form.ts";
import type { Aviary, Bird } from "@perch/core/viewmodel.ts";
import type { SnoozeCalls } from "./snooze-action.tsx";

/** Snooze calls that do nothing, for tests and scenes that only show the control. */
export const quietSnooze: SnoozeCalls = {
  pickedAt: () => new Date(2026, 9, 22, 9, 0),
  onSnooze: () => {},
  onWake: () => {},
};

/** The mock aviary with the named birds snoozed until a date, or until woken for null. */
export function snoozing(ids: string[], until: string | null): Aviary {
  return {
    ...mockAviary,
    wires: mockAviary.wires.map((wire) => ({
      ...wire,
      birds: wire.birds.map((bird) =>
        ids.includes(bird.id) ? { ...bird, snooze: { until } } : bird,
      ),
    })),
  };
}

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

/** One mock bird's entry form from the mock config; throws when the mock holds no such entity. */
export function mockEntryForm(id: string): EntryForm {
  const entity = mockSnapshot.entities.find((candidate) => candidate.id === id);
  if (entity === undefined)
    throw new Error(`the mock snapshot has no entity ${id}`);
  return entryFormFor(mockConfig, entity, mockHome);
}

export { mockHome };

/** The settings form for the mock config. */
export function mockSettingsForm(): SettingsForm {
  return settingsFormFor(mockConfig, mockHome, mockLogin, mockImage);
}
