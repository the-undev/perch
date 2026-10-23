// The main process's one source of truth: the config, the latest snapshot and the aviary derived
// from them, what went wrong outside any one source, and the scan, launch, key-file reads, config
// entry edits and settings that act on them. Electron stays outside: every effect is a dependency.

import type { Config, LoadedConfig } from "@perch/core/config.ts";
import {
  type EntryForm,
  type EntryValues,
  entryFormFor,
  withEntry,
  withoutEntry,
} from "@perch/core/entry-form.ts";
import { errorMessage } from "@perch/core/fs.ts";
import {
  type SettingsForm,
  type SettingsValues,
  settingsFormFor,
  withSettings,
} from "@perch/core/settings-form.ts";
import type { Item, Snapshot } from "@perch/core/snapshot.ts";
import {
  type Aviary,
  type Bird,
  deriveAviary,
  type LaunchAction,
  type SourceCard,
} from "@perch/core/viewmodel.ts";
import type { KeyFileSheet, PerchState } from "../shared/ipc.ts";
import type { ConfigEdit } from "./config-edit.ts";
import type { ConfigStore } from "./config-store.ts";

export interface AppStateDeps {
  /** The home directory, against which the settings page shows paths with ~. */
  home: string;
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
  /** Writes the starter config; rejects, writing nothing, when the file exists. */
  writeStarter: () => Promise<void>;
  /** Applies an edit to a fresh read of the config file; rejects, writing nothing, on failure. */
  editConfig: (edit: ConfigEdit) => Promise<void>;
  /** Asks for a scan now, or joins the one running, and settles when it has finished. */
  requestScan: () => Promise<void>;
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
  /**
   * Writes the starter config, then asks for a scan; a refusal becomes a problem until the next
   * attempt or scan.
   */
  writeStarterConfig(): Promise<void>;
  /** A bird's config entry and the form's choices; null for a bird the aviary does not hold. */
  entryForm(birdId: string): EntryForm | null;
  /**
   * Sets a bird's config entry, adopting it when it has none, then rereads the config and asks
   * for a scan; a failure writes nothing and becomes a problem until the next scan.
   */
  saveEntry(birdId: string, values: EntryValues): Promise<void>;
  /** Removes every config entry naming a bird, returning it to the fence, as saveEntry writes. */
  removeEntry(birdId: string): Promise<void>;
  /** Everything in config but the item entries, as the settings page edits it; null without config. */
  settingsForm(): SettingsForm | null;
  /**
   * Sets everything in config but the item entries, then rereads the config and asks for a scan;
   * a failure writes nothing and becomes a problem until the next scan.
   */
  saveSettings(values: SettingsValues): Promise<void>;
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
  let starterError: string | null = null;
  /** Why the latest config write wrote nothing, an entry's or the settings'. */
  let writeError: string | null = null;
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

  /** The latest snapshot's source cards; a snapshot cached before they existed has none. */
  function sourceCards(): SourceCard[] | null {
    if (deps.config.current().loaded === null) return null;
    return snapshot?.sourceCards ?? null;
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
    if (starterError !== null) list.push(starterError);
    if (writeError !== null) list.push(writeError);
    return list;
  }

  function state(): PerchState {
    return {
      noConfig: deps.config.current().missing,
      aviary: aviary(),
      sourceCards: sourceCards(),
      scanning,
      problems: problems(),
    };
  }

  function bird(birdId: string): Bird | undefined {
    const current = aviary();
    if (current === null) return undefined;
    return birdsOf(current).find((candidate) => candidate.id === birdId);
  }

  /** The snapshot item behind a bird the aviary holds. */
  function birdItem(birdId: string): Item | undefined {
    if (bird(birdId) === undefined) return undefined;
    return snapshot?.items.find((item) => item.id === birdId);
  }

  const publish = () => deps.publish(state());

  /** Writes an edit, then rereads the config, publishes and asks for a scan; a failure is a problem. */
  async function edit(change: ConfigEdit): Promise<void> {
    try {
      await deps.editConfig(change);
      writeError = null;
    } catch (error) {
      writeError = `The config was not changed: ${errorMessage(error)}`;
      publish();
      return;
    }
    await deps.config.reload();
    publish();
    await deps.requestScan();
  }

  async function editEntry(
    birdId: string,
    change: (config: Config, item: Item) => Config,
  ): Promise<void> {
    const item = birdItem(birdId);
    if (item === undefined) return;
    await edit((config) => change(config, item));
  }

  return {
    async start() {
      await deps.config.reload();
      snapshot = await deps.readCached();
    },
    state,
    async scan() {
      const { loaded } = await deps.config.reload();
      launchError = null;
      starterError = null;
      writeError = null;
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
    async writeStarterConfig() {
      try {
        await deps.writeStarter();
        starterError = null;
      } catch (error) {
        starterError = `The starter config was not written: ${errorMessage(error)}`;
      }
      publish();
      await deps.requestScan();
    },
    entryForm(birdId) {
      const item = birdItem(birdId);
      const config = deps.config.current().loaded?.config;
      if (item === undefined || config === undefined) return null;
      return entryFormFor(config, item);
    },
    saveEntry: (birdId, values) =>
      editEntry(birdId, (config, item) => withEntry(config, item, values)),
    removeEntry: (birdId) =>
      editEntry(birdId, (config, item) => withoutEntry(config, item)),
    settingsForm() {
      const config = deps.config.current().loaded?.config;
      if (config === undefined) return null;
      return settingsFormFor(config, deps.home);
    },
    saveSettings: (values) =>
      edit((config) => withSettings(config, values, deps.home)),
  };
}
