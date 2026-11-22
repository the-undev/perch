import { join } from "node:path";
import { userConfigPath } from "@perch/core/config.ts";

/** Where the app keeps and finds its files. */
export interface AppPaths {
  /** Electron's userData, leaving ~/.config/perch to the stowed config alone. */
  userData: string;
  /** The raw files of the latest gather, one per source. */
  rawDir: string;
  /** The cached snapshot: the window renders from it at start, and it is the first-seen record. */
  snapshotPath: string;
  /** The owner's snoozes: local state, beside the scan. */
  snoozesPath: string;
  /** The owner's config. */
  userConfigPath: string;
}

/** The variables a run from source sets to keep its data and config apart from the installed app's. */
export interface PathEnv {
  PERCH_DATA_DIR?: string | undefined;
  PERCH_CONFIG?: string | undefined;
}

/** The app's paths: its data in PERCH_DATA_DIR, else ~/.local/share/perch, and its config in PERCH_CONFIG, else ~/.config/perch. */
export function appPaths(home: string, env: PathEnv): AppPaths {
  const userData = env.PERCH_DATA_DIR ?? join(home, ".local", "share", "perch");
  return {
    userData,
    rawDir: join(userData, "scan", "raw"),
    snapshotPath: join(userData, "scan", "snapshot.json"),
    snoozesPath: join(userData, "snoozes.json"),
    userConfigPath: env.PERCH_CONFIG ?? userConfigPath(home),
  };
}
