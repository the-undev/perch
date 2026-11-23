import {
  configVersion,
  type LoadedConfig,
  parseVersionedConfig,
} from "@perch/core/config.ts";
import { writeConfig } from "@perch/core/config-write.ts";
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
  /** Replaces a file's text in one step. */
  writeText: (path: string, text: string) => Promise<void>;
  /** Copies a file's bytes to a new path. */
  copyFile: (from: string, to: string) => Promise<void>;
}

export interface ConfigStore {
  /** Reads the config again; a failure keeps the config last read, a missing file drops it. */
  reload(): Promise<ConfigState>;
  current(): ConfigState;
}

/**
 * Reads the config file, and writes a file of an older version back migrated, after copying it
 * beside itself as config.toml.v<old version>; null when the file does not exist.
 */
async function readMigrating(
  deps: ConfigStoreDeps,
): Promise<LoadedConfig | null> {
  const text = await deps.readText(deps.path);
  if (text === null) return null;
  const { config, fileVersion } = parseVersionedConfig(text, deps.home);
  if (fileVersion < configVersion) {
    await deps.copyFile(deps.path, `${deps.path}.v${fileVersion}`);
    await deps.writeText(deps.path, writeConfig(config, deps.home));
  }
  return { config, path: deps.path };
}

/**
 * Holds the config across reads, so an edit that does not parse never takes the app down. A file
 * of an older version is migrated and written back as it is read.
 */
export function createConfigStore(deps: ConfigStoreDeps): ConfigStore {
  let state: ConfigState = { loaded: null, error: null, missing: false };
  return {
    async reload() {
      try {
        const loaded = await readMigrating(deps);
        state =
          loaded === null
            ? { loaded: null, error: null, missing: true }
            : { loaded, error: null, missing: false };
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
