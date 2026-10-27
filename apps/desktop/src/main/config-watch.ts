import { type FSWatcher, watch } from "node:fs";
import { realpath } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { errorMessage } from "@perch/core/fs.ts";

export interface ConfigWatchDeps {
  /** The owner's config file, which may be a symlink and may not exist yet. */
  path: string;
  /** How long the file must stay quiet before a change is told, in milliseconds. */
  quietMs: number;
  /** Told once a burst of changes to the file has settled. */
  onChange: () => void;
  /** Told when a directory cannot be watched; the app carries on without it. */
  onError: (message: string) => void;
}

export interface ConfigWatch {
  /**
   * Watches the config's directory and, for a symlink, the directory of the file it names, so an
   * edit to a stowed config is seen; does nothing while already watching.
   */
  start(): Promise<void>;
  stop(): void;
}

/** Watches the config file for edits made outside the app, by hand or by another tool. */
export function createConfigWatch(deps: ConfigWatchDeps): ConfigWatch {
  let watchers: FSWatcher[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(deps.onChange, deps.quietMs);
  };

  function watchDirectory(directory: string, names: Set<string>): void {
    try {
      const watcher = watch(directory, (_event, filename) => {
        if (filename === null || names.has(filename)) changed();
      });
      watcher.on("error", (error) =>
        deps.onError(`The config file is not watched: ${errorMessage(error)}`),
      );
      watchers.push(watcher);
    } catch (error) {
      deps.onError(`The config file is not watched: ${errorMessage(error)}`);
    }
  }

  return {
    async start() {
      if (watchers.length > 0) return;
      const target = await realpath(deps.path).catch(() => deps.path);
      const directories = new Map<string, Set<string>>();
      for (const file of [deps.path, target]) {
        const names = directories.get(dirname(file)) ?? new Set<string>();
        names.add(basename(file));
        directories.set(dirname(file), names);
      }
      for (const [directory, names] of directories) {
        watchDirectory(directory, names);
      }
    },
    stop() {
      clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      watchers = [];
    },
  };
}

/** The reaction to a hand edit: reread the config and show it, then scan, as a save from the settings page does. */
export function rescanOnConfigChange(deps: {
  recheck: () => Promise<void>;
  requestScan: () => Promise<void>;
}): () => void {
  return () => void deps.recheck().then(deps.requestScan);
}
