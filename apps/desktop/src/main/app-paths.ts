import { join, resolve } from "node:path";
import { userConfigPath } from "@perch/core/config.ts";

/** Where the app keeps and finds its files. */
export interface AppPaths {
  /** Electron's userData, leaving ~/.config/perch to the stowed config alone. */
  userData: string;
  /** The raw files of the latest gather, one per source. */
  rawDir: string;
  /** The cached snapshot: the window renders from it at start, and it is the first-seen record. */
  snapshotPath: string;
  /** The owner's config. */
  userConfigPath: string;
  /** The example config, read when the owner's does not exist. */
  examplePath: string;
}

/** The app's paths under a home directory: its data in ~/.local/share/perch. */
export function appPaths(home: string, examplePath: string): AppPaths {
  const userData = join(home, ".local", "share", "perch");
  return {
    userData,
    rawDir: join(userData, "scan", "raw"),
    snapshotPath: join(userData, "scan", "snapshot.json"),
    userConfigPath: userConfigPath(home),
    examplePath,
  };
}

/**
 * The example config: shipped among the AppImage's resources, else the repository's, found from
 * the built main process in apps/desktop/out/main.
 */
export function examplePathFor(
  packaged: boolean,
  resourcesPath: string,
  mainDir: string,
): string {
  if (packaged) return join(resourcesPath, "config.example.toml");
  return resolve(mainDir, "..", "..", "..", "..", "config.example.toml");
}
