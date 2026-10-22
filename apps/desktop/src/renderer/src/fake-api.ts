// A stand-in for the preload's API in renderer tests: it answers from what the test gives it,
// records every call, and pushes states when the test says so.

import type { LaunchAction } from "@perch/core/viewmodel.ts";
import type { KeyFileSheet, PerchApi, PerchState } from "../../shared/ipc.ts";

export interface FakeApi {
  api: PerchApi;
  /** Pushes a state to every listener, as a finished scan does. */
  push(state: PerchState): void;
  rescans: number;
  launches: LaunchAction[];
  keyFileReads: string[];
}

export function fakeApi(
  initial: PerchState,
  sheetsFor: (birdId: string) => KeyFileSheet[] = () => [],
): FakeApi {
  const listeners = new Set<(state: PerchState) => void>();
  let current = initial;
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
    },
    push(state) {
      current = state;
      for (const listener of listeners) listener(state);
    },
    rescans: 0,
    launches: [],
    keyFileReads: [],
  };
  return fake;
}
