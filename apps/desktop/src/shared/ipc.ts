import type { Aviary, KeyFile, LaunchAction } from "@perch/core/viewmodel.ts";

/** What the window shows, pushed whenever it changes. */
export interface PerchState {
  /** No config file exists at ~/.config/perch/config.toml, so nothing scans until one does. */
  noConfig: boolean;
  /** The aviary from the latest snapshot; null until the first scan has finished, or without config. */
  aviary: Aviary | null;
  /** A scan is running. */
  scanning: boolean;
  /** What went wrong outside any one source: an unreadable config, a failed scan or launch. */
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
} as const satisfies Record<keyof PerchApi, string>;
