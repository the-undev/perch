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
import type { UpdateState } from "@perch/core/update.ts";
import type {
  Aviary,
  KeyFile,
  LaunchAction,
  SourceCard,
} from "@perch/core/viewmodel.ts";

/** What the window shows, pushed whenever it changes. */
export interface PerchState {
  /** No config file exists at ~/.config/perch/config.toml, so nothing scans until one does. */
  noConfig: boolean;
  /** The aviary from the latest snapshot; null until the first scan has finished, or without config. */
  aviary: Aviary | null;
  /** Each configured source table's last scan, from the latest snapshot; null until one holds them, or without config. */
  sourceCards: SourceCard[] | null;
  /** A scan is running. */
  scanning: boolean;
  /**
   * What went wrong outside any one source: an unreadable config, a failed scan or launch, a
   * config entry or settings that were not written.
   */
  problems: string[];
  /** The running version, the release check's answers and the download, for the Updates page. */
  update: UpdateState;
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
  /** Performs a launch action a bird offers, commands and all; a failure arrives as a problem in the state. */
  launch(action: LaunchAction): Promise<void>;
  /**
   * Opens the config file by an action the main process picks from config's launch actions; a
   * failure arrives as a problem in the state.
   */
  openConfig(): Promise<void>;
  /**
   * Writes the default config (one wire, the default thresholds, no sources) to the
   * config path and starts a scan, resolving true once written; refuses, writing nothing, when
   * the file exists, resolving false, and the refusal arrives as a problem in the state.
   */
  writeStarterConfig(): Promise<boolean>;
  /** A bird's config entry and the choices its form offers; null for a bird the aviary does not hold. */
  entryForm(birdId: string): Promise<EntryForm | null>;
  /**
   * Sets a bird's config entry, adopting it when it has none, then scans; a failure writes
   * nothing and arrives as a problem in the state.
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
   * Sets everything in config but the item entries, then writes or removes the autostart entry,
   * then scans; a config that cannot be written writes nothing, and either failure arrives as a
   * problem in the state.
   */
  saveSettings(values: SettingsValues): Promise<void>;
  /**
   * Writes a pasted token into the keyring under service perch and the key; nothing ever reads
   * it back for the window.
   */
  storeToken(key: string, token: string): Promise<TokenStored>;
  /** Lists a forge card's repositories with the token its key holds, as its draft values say. */
  testSource(values: SourceTestValues): Promise<SourceTested>;
  /** Checks for a newer release now, whatever config says; the answer arrives in the state. */
  checkForUpdate(): Promise<void>;
  /** Calls back each time the main process asks for the Updates page, and returns the call that stops it. */
  onOpenUpdates(listener: () => void): () => void;
}

/** The calls the main process answers: everything but what it pushes. */
export type PerchCalls = Omit<PerchApi, "onState" | "onOpenUpdates">;

/** The IPC channel that carries each call, and the one the state is pushed on. */
export const channels = {
  state: "state:get",
  onState: "state:changed",
  rescan: "scan:request",
  keyFiles: "bird:key-files",
  launch: "bird:launch",
  openConfig: "config:open",
  writeStarterConfig: "config:write-starter",
  entryForm: "bird:entry-form",
  saveEntry: "bird:save-entry",
  removeEntry: "bird:remove-entry",
  settingsForm: "config:settings-form",
  saveSettings: "config:save-settings",
  storeToken: "keyring:store-token",
  testSource: "keyring:test-source",
  checkForUpdate: "update:check",
  onOpenUpdates: "update:open-page",
} as const satisfies Record<keyof PerchApi, string>;
