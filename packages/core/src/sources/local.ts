import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { mapWithLimit } from "../exec.ts";
import { errorMessage, nullIfMissing } from "../fs.ts";
import type {
  IncludeKind,
  Observed,
  RawLocalPresence,
  RawObsidian,
} from "../raw.ts";
import { sortedRecord } from "../records.ts";
import { type GitReadDeps, readRepository } from "./git.ts";
import type { PolledSource } from "./source.ts";

export interface LocalSourceDeps extends GitReadDeps {
  home: string;
  include: readonly string[];
  ignore: readonly string[];
  concurrency: number;
}

/** How far below an include directory the search for repositories goes. */
const maxDepth = 5;

/** A local presence's id: its path relative to the home directory, or the absolute path outside it. */
export function localIdFor(path: string, home: string): string {
  const fromHome = relative(home, path);
  if (fromHome === "" || fromHome.startsWith("..")) return path;
  return fromHome.split(sep).join("/");
}

function isIgnored(path: string, ignore: readonly string[]): boolean {
  return ignore.some(
    (ignored) => path === ignored || path.startsWith(`${ignored}${sep}`),
  );
}

async function isDirectory(path: string): Promise<boolean> {
  const stats = await nullIfMissing(() => stat(path));
  return stats?.isDirectory() ?? false;
}

async function entriesOf(directory: string): Promise<Dirent[]> {
  return (
    (await nullIfMissing(() => readdir(directory, { withFileTypes: true }))) ??
    []
  );
}

async function findRepositories(
  directory: string,
  depth: number,
  ignore: readonly string[],
): Promise<string[]> {
  if (isIgnored(directory, ignore)) return [];
  const entries = await entriesOf(directory);
  if (entries.some((entry) => entry.name === ".git")) return [directory];
  if (depth >= maxDepth) return [];
  const children = entries.filter(
    (entry) =>
      entry.isDirectory() &&
      !entry.name.startsWith(".") &&
      entry.name !== "node_modules",
  );
  const nested = await Promise.all(
    children.map((entry) =>
      findRepositories(join(directory, entry.name), depth + 1, ignore),
    ),
  );
  return nested.flat().sort();
}

/** Whether a repository holds an Obsidian vault, and whether that vault has the LiveSync plugin. */
export async function readObsidian(path: string): Promise<RawObsidian> {
  return {
    folder: await isDirectory(join(path, ".obsidian")),
    livesyncPlugin: await isDirectory(
      join(path, ".obsidian", "plugins", "obsidian-livesync"),
    ),
  };
}

/**
 * The root collector for local clones. Each include path is a repository or a directory searched
 * for repositories; ignore paths are never entered. Kind and LiveSync are observed, not configured.
 */
export function createLocalSource(
  deps: LocalSourceDeps,
): PolledSource<"local"> {
  return {
    name: "local",
    async gather() {
      const includes: Record<
        string,
        Observed<IncludeKind, "path-not-found">
      > = {};
      const found = new Map<string, string>();
      for (const include of deps.include) {
        if (!(await isDirectory(include))) {
          includes[include] = { state: "absent", reason: "path-not-found" };
          continue;
        }
        const isRepo = (await entriesOf(include)).some(
          (entry) => entry.name === ".git",
        );
        includes[include] = {
          state: "observed",
          value: isRepo ? "repo" : "directory",
        };
        const repositories = isRepo
          ? [include]
          : await findRepositories(include, 0, deps.ignore);
        for (const path of repositories)
          if (!found.has(path)) found.set(path, include);
      }
      const presences: Record<string, RawLocalPresence> = {};
      await mapWithLimit(
        [...found],
        deps.concurrency,
        async ([path, include]) => {
          let git: RawLocalPresence["git"];
          try {
            git = {
              state: "observed",
              value: await readRepository(path, deps),
            };
          } catch (error) {
            git = { state: "error", error: errorMessage(error) };
          }
          presences[localIdFor(path, deps.home)] = {
            path,
            include,
            obsidian: await readObsidian(path),
            git,
          };
        },
      );
      return { includes, presences: sortedRecord(presences) };
    },
  };
}
