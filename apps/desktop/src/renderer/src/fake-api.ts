// A stand-in for the preload's API in renderer tests: it answers from what the test gives it,
// records every call, and pushes states when the test says so.

import type { EntryForm, EntryValues } from "@perch/core/entry-form.ts";
import type {
  SettingsForm,
  SettingsValues,
} from "@perch/core/settings-form.ts";
import type {
  SourceTested,
  SourceTestValues,
  TokenStored,
} from "@perch/core/sources-form.ts";
import type { LaunchAction } from "@perch/core/viewmodel.ts";
import type { KeyFileSheet, PerchApi, PerchState } from "../../shared/ipc.ts";

export interface FakeApi {
  api: PerchApi;
  /** Pushes a state to every listener, as a finished scan does. */
  push(state: PerchState): void;
  rescans: number;
  launches: LaunchAction[];
  keyFileReads: string[];
  starterWrites: number;
  /** What the next starter write resolves: whether it wrote. */
  starterWritten: boolean;
  entrySaves: { birdId: string; values: EntryValues }[];
  entryRemovals: string[];
  settingsSaves: SettingsValues[];
  /** Sets what the settings form reads next, as an edit to the config file would. */
  setSettings(form: SettingsForm | null): void;
  tokenStores: { key: string; token: string }[];
  /** What the next token store answers. */
  tokenStored: TokenStored;
  sourceTests: SourceTestValues[];
  /** What the next connection test answers. */
  sourceTested: SourceTested;
}

export function fakeApi(
  initial: PerchState,
  sheetsFor: (birdId: string) => KeyFileSheet[] = () => [],
  formFor: (birdId: string) => EntryForm | null = () => null,
  settings: SettingsForm | null = null,
): FakeApi {
  const listeners = new Set<(state: PerchState) => void>();
  let current = initial;
  let settingsForm = settings;
  const fake: FakeApi = {
    api: {
      state: async () => current,
      onState(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      rescan: async () => {
        fake.rescans += 1;
      },
      keyFiles: async (birdId) => {
        fake.keyFileReads.push(birdId);
        return sheetsFor(birdId);
      },
      launch: async (action) => {
        fake.launches.push(action);
      },
      writeStarterConfig: async () => {
        fake.starterWrites += 1;
        return fake.starterWritten;
      },
      entryForm: async (birdId) => formFor(birdId),
      saveEntry: async (birdId, values) => {
        fake.entrySaves.push({ birdId, values });
      },
      removeEntry: async (birdId) => {
        fake.entryRemovals.push(birdId);
      },
      settingsForm: async () => settingsForm,
      saveSettings: async (values) => {
        fake.settingsSaves.push(values);
      },
      storeToken: async (key, token) => {
        fake.tokenStores.push({ key, token });
        return fake.tokenStored;
      },
      testSource: async (values) => {
        fake.sourceTests.push(values);
        return fake.sourceTested;
      },
    },
    push(state) {
      current = state;
      for (const listener of listeners) listener(state);
    },
    rescans: 0,
    launches: [],
    keyFileReads: [],
    starterWrites: 0,
    starterWritten: true,
    entrySaves: [],
    entryRemovals: [],
    settingsSaves: [],
    setSettings(form) {
      settingsForm = form;
    },
    tokenStores: [],
    tokenStored: { ok: true },
    sourceTests: [],
    sourceTested: { ok: true, count: 0 },
  };
  return fake;
}
