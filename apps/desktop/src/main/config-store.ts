import { type LoadedConfig, parseConfig } from "@perch/core/config.ts";
import { errorMessage } from "@perch/core/fs.ts";

/** The config the app runs on, and why the latest read failed if it did. */
export interface ConfigState {
  /** The config last read successfully; null when no read has succeeded or the file is missing. */
  loaded: LoadedConfig | null;
  /** The latest read's failure; null when it succeeded or found no file. */
  error: string | null;
  /** The latest read found no file: the no-config state, holding no config. */
  missing: boolean;
}

export interface ConfigStoreDeps {
  /** The home directory a leading ~ in config paths expands to. */
  home: string;
  /** The owner's config, the only file the store reads. */
  path: string;
  /** A file's text; null when it does not exist. */
  readText: (path: string) => Promise<string | null>;
}

export interface ConfigStore {
  /** Reads the config again; a failure keeps the config last read, a missing file drops it. */
  reload(): Promise<ConfigState>;
  current(): ConfigState;
}

/** Holds the config across reads, so an edit that does not parse never takes the app down. */
export function createConfigStore(deps: ConfigStoreDeps): ConfigStore {
  let state: ConfigState = { loaded: null, error: null, missing: false };
  return {
    async reload() {
      try {
        const text = await deps.readText(deps.path);
        state =
          text === null
            ? { loaded: null, error: null, missing: true }
            : {
                loaded: {
                  config: parseConfig(text, deps.home),
                  path: deps.path,
                },
                error: null,
                missing: false,
              };
      } catch (error) {
        state = {
          loaded: state.loaded,
          error: errorMessage(error),
          missing: false,
        };
      }
      return state;
    },
    current: () => state,
  };
}
