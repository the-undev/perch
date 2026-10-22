import type { LoadedConfig } from "@perch/core/config.ts";
import { errorMessage } from "@perch/core/fs.ts";

/** The config the app runs on, and why the latest read failed if it did. */
export interface ConfigState {
  /** The config last read successfully; null when no read has succeeded. */
  loaded: LoadedConfig | null;
  /** The latest read's failure; null when it succeeded. */
  error: string | null;
}

export interface ConfigStore {
  /** Reads the config again; a failure keeps the config last read. */
  reload(): Promise<ConfigState>;
  current(): ConfigState;
}

/** Holds the config across reads, so an edit that does not parse never takes the app down. */
export function createConfigStore(
  load: () => Promise<LoadedConfig>,
): ConfigStore {
  let state: ConfigState = { loaded: null, error: null };
  return {
    async reload() {
      try {
        state = { loaded: await load(), error: null };
      } catch (error) {
        state = { loaded: state.loaded, error: errorMessage(error) };
      }
      return state;
    },
    current: () => state,
  };
}
