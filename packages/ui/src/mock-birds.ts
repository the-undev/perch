// The mock dataset's birds by id, their entry forms and the settings form, for the tests and the
// design site.

import { type EntryForm, entryFormFor } from "@perch/core/entry-form.ts";
import { mockAviary, mockConfig, mockSnapshot } from "@perch/core/mock.ts";
import {
  type SettingsForm,
  settingsFormFor,
} from "@perch/core/settings-form.ts";
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

/** One mock bird's entry form from the mock config; throws when the mock holds no such item. */
export function mockEntryForm(id: string): EntryForm {
  const item = mockSnapshot.items.find((candidate) => candidate.id === id);
  if (item === undefined)
    throw new Error(`the mock snapshot has no item ${id}`);
  return entryFormFor(mockConfig, item);
}

/** The home directory the mock's paths sit under. */
export const mockHome = "/home/owner";

/** The settings form for the mock config. */
export function mockSettingsForm(): SettingsForm {
  return settingsFormFor(mockConfig, mockHome);
}
