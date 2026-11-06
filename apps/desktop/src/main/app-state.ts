// The main process's one source of truth: the config, the latest snapshot and the aviary derived
// from them, what went wrong outside any one source, the release check, and the scan, launch,
// key-file reads, config entry edits and settings that act on them, the autostart entry among the
// settings. Electron stays outside: every effect is a dependency.

import {
  type Config,
  collapseHome,
  defaultUpdateCheck,
  defaultUpdateInstall,
  type LoadedConfig,
} from "@perch/core/config.ts";
import {
  type EntryForm,
  type EntryValues,
  entryFormFor,
  withEntry,
  withoutEntry,
} from "@perch/core/entry-form.ts";
import { errorMessage } from "@perch/core/fs.ts";
import type { FetchJson } from "@perch/core/http.ts";
import {
  type SettingsForm,
  type SettingsValues,
  settingsFormFor,
  withSettings,
} from "@perch/core/settings-form.ts";
import type { Item, Snapshot } from "@perch/core/snapshot.ts";
import { createReleaseChecker, type UpdateState } from "@perch/core/update.ts";
import {
  type Aviary,
  type Bird,
  deriveAviary,
  type LaunchAction,
  type SourceCard,
} from "@perch/core/viewmodel.ts";
import type { KeyFileSheet, PerchState } from "../shared/ipc.ts";
import type { Autostart } from "./autostart.ts";
import type { ConfigEdit } from "./config-edit.ts";
import type { ConfigStore } from "./config-store.ts";
import { configFileAction } from "./launch.ts";

export interface AppStateDeps {
  /** The home directory, against which the settings page shows paths with ~. */
  home: string;
  config: ConfigStore;
  /** The owner's config file, which the settings page's path opens. */
  configPath: string;
  /** The snapshot cached by the last scan, or null. */
  readCached: () => Promise<Snapshot | null>;
  /** Gathers every source into the raw directory. */
  gather: (config: Config) => Promise<void>;
  /** Aggregates the raw directory into a snapshot and caches it. */
  aggregate: (loaded: LoadedConfig) => Promise<Snapshot>;
  /** Performs a launch action with the commands it carries. */
  launch: (action: LaunchAction) => Promise<void>;
  /** Reads a file's text; rejects when it cannot. */
  readText: (path: string) => Promise<string>;
  /** Writes the starter config; rejects, writing nothing, when the file exists. */
  writeStarter: () => Promise<void>;
  /** Applies an edit to a fresh read of the config file; rejects, writing nothing, on failure. */
  editConfig: (edit: ConfigEdit) => Promise<void>;
  /** The autostart entry the settings page's login toggle reads and saving writes. */
  autostart: Autostart;
  /** The running AppImage, from APPIMAGE, which an install replaces; null when run from source. */
  image: string | null;
  /** The running version. */
  running: string;
  /** Answers the release check's request. */
  fetchRelease: FetchJson;
  /** The clock the release check's hour and answers are read from. */
  now: () => Date;
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
   * Performs a launch action when some bird in the aviary offers it, commands and all, else
   * nothing; a failure becomes a problem until the next scan.
   */
  launch(action: LaunchAction): Promise<void>;
  /**
   * Opens the config file by the action configFileAction picks from config's launch actions; a
   * failure becomes a problem until the next scan.
   */
  openConfig(): Promise<void>;
  /** A bird's key files with what was read from each; none for a bird the aviary does not hold. */
  keyFiles(birdId: string): Promise<KeyFileSheet[]>;
  /**
   * Writes the starter config and starts a scan, resolving whether it wrote before the scan
   * settles; a refusal becomes a problem until the next attempt or scan.
   */
  writeStarterConfig(): Promise<boolean>;
  /** A bird's config entry and the form's choices; null for a bird the aviary does not hold. */
  entryForm(birdId: string): EntryForm | null;
  /**
   * Sets a bird's config entry, adopting it when it has none, then rereads the config and asks
   * for a scan; a failure writes nothing and becomes a problem until the next scan.
   */
  saveEntry(birdId: string, values: EntryValues): Promise<void>;
  /** Removes every config entry naming a bird, returning it to the fence, as saveEntry writes. */
  removeEntry(birdId: string): Promise<void>;
  /**
   * Everything in config but the item entries, and the autostart entry, as the settings page edits
   * them; null without config.
   */
  settingsForm(): Promise<SettingsForm | null>;
  /**
   * Sets everything in config but the item entries, then the autostart entry, then rereads the
   * config and asks for a scan. A config that cannot be written writes nothing; either failure
   * becomes a problem until the next scan.
   */
  saveSettings(values: SettingsValues): Promise<void>;
  /** Checks for a newer release now, whatever config's switch and the hour say; joins one running. */
  checkForUpdate(): Promise<void>;
}

/** Two launch actions are the same when they serialise alike: they are plain data, commands and all. */
function sameAction(a: LaunchAction, b: LaunchAction): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
      derived = {
        snapshot,
        config,
        aviary: deriveAviary(snapshot, config, deps.home),
      };
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

  /** Config's [update] table, its defaults without a config. */
  function updateConfig(): Config["update"] {
    return (
      deps.config.current().loaded?.config.update ?? {
        check: defaultUpdateCheck,
        install: defaultUpdateInstall,
      }
    );
  }

  function updateState(): UpdateState {
    const update = updateConfig();
    return {
      ...releases.state(),
      running: deps.running,
      checkOn: update.check,
      installs: update.install && deps.image !== null,
      image: deps.image === null ? null : collapseHome(deps.image, deps.home),
      download: { state: "none" },
    };
  }

  function state(): PerchState {
    return {
      noConfig: deps.config.current().missing,
      aviary: aviary(),
      sourceCards: sourceCards(),
      scanning,
      problems: problems(),
      update: updateState(),
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

  const releases = createReleaseChecker({
    fetchJson: deps.fetchRelease,
    running: deps.running,
    now: deps.now,
    onChange: publish,
  });

  /** Performs a launch action; a failure is a problem until the next scan. */
  async function perform(action: LaunchAction): Promise<void> {
    try {
      await deps.launch(action);
    } catch (error) {
      launchError = `${action.verb} failed: ${errorMessage(error)}`;
      publish();
    }
  }

  /**
   * Writes an edit and then the step after it, then rereads the config, publishes and asks for a
   * scan. A failed edit is a problem and stops there; a failed step after is a problem too.
   */
  async function edit(
    change: ConfigEdit,
    after: () => Promise<string | null>,
  ): Promise<void> {
    try {
      await deps.editConfig(change);
      writeError = null;
    } catch (error) {
      writeError = `The config was not changed: ${errorMessage(error)}`;
      publish();
      return;
    }
    writeError = await after();
    await deps.config.reload();
    publish();
    await deps.requestScan();
  }

  /** Nothing follows an entry's edit. */
  const nothingAfter = async () => null;

  /** Writes or removes the autostart entry as the login toggle says; why it was not, or null. */
  async function saveLogin(window: SettingsValues["window"]) {
    try {
      await deps.autostart.save(window);
      return null;
    } catch (error) {
      return `The login entry was not changed: ${errorMessage(error)}`;
    }
  }

  async function editEntry(
    birdId: string,
    change: (config: Config, item: Item) => Config,
  ): Promise<void> {
    const item = birdItem(birdId);
    if (item === undefined) return;
    await edit((config) => change(config, item), nothingAfter);
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
      // The check rides the scan cycle but never holds the scan up.
      if (loaded.config.update.check) void releases.checkIfDue();
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
      if (action === undefined) return;
      await perform(action);
    },
    openConfig() {
      const actions = deps.config.current().loaded?.config.launch.actions ?? [];
      return perform(configFileAction(actions, deps.configPath));
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
      let written = true;
      try {
        await deps.writeStarter();
        starterError = null;
      } catch (error) {
        written = false;
        starterError = `The config file was not created: ${errorMessage(error)}`;
      }
      publish();
      // A file already there is read by the scan, which leaves the welcome as a new one does.
      void deps.requestScan();
      return written;
    },
    entryForm(birdId) {
      const item = birdItem(birdId);
      const config = deps.config.current().loaded?.config;
      if (item === undefined || config === undefined) return null;
      return entryFormFor(config, item, deps.home);
    },
    saveEntry: (birdId, values) =>
      editEntry(birdId, (config, item) => withEntry(config, item, values)),
    removeEntry: (birdId) =>
      editEntry(birdId, (config, item) => withoutEntry(config, item)),
    async settingsForm() {
      const config = deps.config.current().loaded?.config;
      if (config === undefined) return null;
      return settingsFormFor(
        config,
        deps.home,
        await deps.autostart.read(),
        deps.image,
      );
    },
    saveSettings: (values) =>
      edit(
        (config) => withSettings(config, values, deps.home),
        () => saveLogin(values.window),
      ),
    checkForUpdate: () => releases.checkNow(),
  };
}
