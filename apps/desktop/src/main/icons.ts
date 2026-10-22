// Where the app icon and the tray icon live: rendered from resources/icon.svg and
// resources/tray.svg by scripts/render-icons.ts, and shipped among the AppImage's resources.

import { join, resolve } from "node:path";

/** The sizes of the app icon's PNGs in resources/icons, named as electron-builder reads them. */
export const appIconSizes = [16, 24, 32, 48, 64, 128, 256, 512] as const;

/** The tray icon at Plasma's tray size and at twice it; Electron picks the @2x file on a scaled display. */
export const trayIconFiles = [
  { file: "tray.png", size: 22 },
  { file: "tray@2x.png", size: 44 },
] as const;

/** The icon files the window and the tray are given. */
export interface IconPaths {
  window: string;
  tray: string;
}

/**
 * The resources folder: the AppImage's resources when packaged, else apps/desktop/resources,
 * found from the built main process in apps/desktop/out/main.
 */
export function resourceDirFor(
  packaged: boolean,
  resourcesPath: string,
  mainDir: string,
): string {
  if (packaged) return resourcesPath;
  return resolve(mainDir, "..", "..", "resources");
}

/** The window's and the tray's icons in a resources folder. */
export function iconPaths(resourceDir: string): IconPaths {
  return {
    window: join(resourceDir, "icons", "256x256.png"),
    tray: join(resourceDir, "tray.png"),
  };
}
