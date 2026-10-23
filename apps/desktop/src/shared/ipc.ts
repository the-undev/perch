import type { EntryForm, EntryValues } from "@perch/core/entry-form.ts";
import type {
  SettingsForm,
  SettingsValues,
} from "@perch/core/settings-form.ts";
import type { Aviary, KeyFile, LaunchAction } from "@perch/core/viewmodel.ts";

/** What the window shows, pushed whenever it changes. */
export interface PerchState {
  /** No config file exists at ~/.config/perch/config.toml, so nothing scans until one does. */
  noConfig: boolean;
  /** The aviary from the latest snapshot; null until the first scan has finished, or without config. */
  aviary: Aviary | null;
  /** A scan is running. */
  scanning: boolean;
  /**
   * What went wrong outside any one source: an unreadable config, a failed scan or launch, a
   * config entry or settings that were not written.
   */
  problems: string[];
}

/** One key file and what was read from it; null when it could not be read. */
export interface KeyFileSheet {
  file: KeyFile;
  markdown: string | null;
}

/** The calls the renderer can make of the main process, exposed on `window.perch` by the preload. */
export interface PerchApi {
  /** The state now: the cached aviary at start, the latest after every scan. */
  state(): Promise<PerchState>;
  /** Calls back with every new state, and returns the call that stops it. */
  onState(listener: (state: PerchState) => void): () => void;
  /** Scans now, or joins the scan running; without config, reads the config path again first. */
  rescan(): Promise<void>;
  /** A bird's key files, read by the main process; none for a bird the aviary does not hold. */
  keyFiles(birdId: string): Promise<KeyFileSheet[]>;
  /** Performs a launch action a bird offers; a failure arrives as a problem in the state. */
  launch(action: LaunchAction): Promise<void>;
  /**
   * Copies the shipped example to the config path, then reads it and scans; refuses, writing
   * nothing, when the file exists, and the refusal arrives as a problem in the state.
   */
  writeStarterConfig(): Promise<void>;
  /** A bird's config entry and the choices its form offers; null for a bird the aviary does not hold. */
  entryForm(birdId: string): Promise<EntryForm | null>;
  /**
   * Sets a bird's config entry, adopting it when it has none, then scans; a failure writes
   * nothing and arrives as a problem in the state.
   */
  saveEntry(birdId: string, values: EntryValues): Promise<void>;
  /** Removes every config entry naming a bird, returning it to the fence, as saveEntry writes. */
  removeEntry(birdId: string): Promise<void>;
  /** Everything in config but the item entries, as the settings page edits it; null without config. */
  settingsForm(): Promise<SettingsForm | null>;
  /**
   * Sets everything in config but the item entries, then scans; a failure writes nothing and
   * arrives as a problem in the state.
   */
  saveSettings(values: SettingsValues): Promise<void>;
}

/** The calls the main process answers: everything but the pushed state. */
export type PerchCalls = Omit<PerchApi, "onState">;

/** The IPC channel that carries each call, and the one the state is pushed on. */
export const channels = {
  state: "state:get",
  onState: "state:changed",
  rescan: "scan:request",
  keyFiles: "bird:key-files",
  launch: "bird:launch",
  writeStarterConfig: "config:write-starter",
  entryForm: "bird:entry-form",
  saveEntry: "bird:save-entry",
  removeEntry: "bird:remove-entry",
  settingsForm: "config:settings-form",
  saveSettings: "config:save-settings",
} as const satisfies Record<keyof PerchApi, string>;
