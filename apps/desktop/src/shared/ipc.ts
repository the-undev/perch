/** The calls the renderer can make of the main process, exposed on `window.perch` by the preload. */
export interface PerchApi {
  /** The application version, from the desktop package's manifest. */
  appVersion(): Promise<string>;
}

/** The IPC channel that carries each call. */
export const channels = {
  appVersion: "app:version",
} as const satisfies Record<keyof PerchApi, string>;
