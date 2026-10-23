// The main process's one source of truth: the config, the latest snapshot and the aviary derived
// from them, what went wrong outside any one source, and the scan, launch and key-file reads
// that act on the aviary's birds. Electron stays outside: every effect is a dependency.

import type { Config, LoadedConfig } from "@perch/core/config.ts";
import { errorMessage } from "@perch/core/fs.ts";
import type { Snapshot } from "@perch/core/snapshot.ts";
import {
  type Aviary,
  type Bird,
  deriveAviary,
  type LaunchAction,
} from "@perch/core/viewmodel.ts";
import type { KeyFileSheet, PerchState } from "../shared/ipc.ts";
import type { ConfigStore } from "./config-store.ts";

export interface AppStateDeps {
  config: ConfigStore;
  /** The snapshot cached by the last scan, or null. */
  readCached: () => Promise<Snapshot | null>;
  /** Gathers every source into the raw directory. */
  gather: (config: Config) => Promise<void>;
  /** Aggregates the raw directory into a snapshot and caches it. */
  aggregate: (loaded: LoadedConfig) => Promise<Snapshot>;
  /** Performs a launch action with the commands from config. */
  launch: (action: LaunchAction, config: Config) => Promise<void>;
  /** Reads a file's text; rejects when it cannot. */
  readText: (path: string) => Promise<string>;
  /** Told every change to the state. */
  publish: (state: PerchState) => void;
}

export interface AppState {
  /** Reads the config and the cached snapshot, so the window has something to show at once. */
  start(): Promise<void>;
  state(): PerchState;
  /** Rereads the config, then gathers and aggregates; failures become problems, never throws. */
  scan(): Promise<void>;
  /** Rereads the config and publishes the state, without scanning. */
  recheck(): Promise<void>;
  setScanning(scanning: boolean): void;
  /**
   * Performs a launch action when some bird in the aviary offers it, else nothing; a failure
   * becomes a problem until the next scan.
   */
  launch(action: LaunchAction): Promise<void>;
  /** A bird's key files with what was read from each; none for a bird the aviary does not hold. */
  keyFiles(birdId: string): Promise<KeyFileSheet[]>;
}

/** Two launch actions are the same when every field is: they are flat records of strings. */
function sameAction(a: LaunchAction, b: LaunchAction): boolean {
  const fields = Object.entries(a);
  return (
    fields.length === Object.keys(b).length &&
    fields.every(([key, value]) => b[key as keyof LaunchAction] === value)
  );
}

function birdsOf(aviary: Aviary): Bird[] {
  return [...aviary.wires.flatMap((wire) => wire.birds), ...aviary.fence.birds];
}

export function createAppState(deps: AppStateDeps): AppState {
  let snapshot: Snapshot | null = null;
  let scanning = false;
  let scanError: string | null = null;
  let launchError: string | null = null;
  let derived: { snapshot: Snapshot; config: Config; aviary: Aviary } | null =
    null;

  function aviary(): Aviary | null {
    const config = deps.config.current().loaded?.config ?? null;
    if (snapshot === null || config === null) return null;
    if (derived?.snapshot !== snapshot || derived.config !== config) {
      derived = { snapshot, config, aviary: deriveAviary(snapshot, config) };
    }
    return derived.aviary;
  }

  function problems(): string[] {
    const { loaded, error } = deps.config.current();
    const list: string[] = [];
    if (error !== null) {
      list.push(
        loaded === null ? error : `${error}; the config read before stands`,
      );
    }
    if (scanError !== null) list.push(`The scan failed: ${scanError}`);
    if (launchError !== null) list.push(launchError);
    return list;
  }

  function state(): PerchState {
    return {
      noConfig: deps.config.current().missing,
      aviary: aviary(),
      scanning,
      problems: problems(),
    };
  }

  function bird(birdId: string): Bird | undefined {
    const current = aviary();
    if (current === null) return undefined;
    return birdsOf(current).find((candidate) => candidate.id === birdId);
  }

  const publish = () => deps.publish(state());

  return {
    async start() {
      await deps.config.reload();
      snapshot = await deps.readCached();
    },
    state,
    async scan() {
      const { loaded } = await deps.config.reload();
      launchError = null;
      if (loaded === null) {
        publish();
        return;
      }
      try {
        await deps.gather(loaded.config);
        snapshot = await deps.aggregate(loaded);
        scanError = null;
      } catch (error) {
        scanError = errorMessage(error);
      }
      publish();
    },
    async recheck() {
      await deps.config.reload();
      publish();
    },
    setScanning(next) {
      scanning = next;
      publish();
    },
    async launch(requested) {
      const current = aviary();
      const action = (current === null ? [] : birdsOf(current))
        .flatMap((candidate) => candidate.detail.actions)
        .find((candidate) => sameAction(candidate, requested));
      const config = deps.config.current().loaded?.config;
      if (action === undefined || config === undefined) return;
      try {
        await deps.launch(action, config);
      } catch (error) {
        launchError = `${action.verb} failed: ${errorMessage(error)}`;
        publish();
      }
    },
    async keyFiles(birdId) {
      const files = bird(birdId)?.detail.keyFiles ?? [];
      return Promise.all(
        files.map(async (file) => ({
          file,
          markdown: await deps.readText(file.absolutePath).catch(() => null),
        })),
      );
    },
  };
}
