import type { Aviary, KeyFile } from "@perch/core/viewmodel.ts";

/** What the window shows, pushed whenever it changes. */
export interface PerchState {
  /** The aviary from the latest snapshot; null until the first scan has finished. */
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
  /** The application version, from the desktop package's manifest. */
  appVersion(): Promise<string>;
}

/** The IPC channel that carries each call. */
export const channels = {
  appVersion: "app:version",
} as const satisfies Record<keyof PerchApi, string>;
