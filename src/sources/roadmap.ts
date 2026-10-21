import { join } from "node:path";
import { countOpenItems, deriveRoadmapFile } from "../derivations.ts";
import { errorMessage } from "../fs.ts";
import { readRoadmapStructure } from "../roadmap-parser.ts";
import type { Item, ItemError, RoadmapData, RoadmapFile } from "../snapshot.ts";
import type { PolledSource } from "./source.ts";

/** Roadmap file names for a repository, in order of preference; the first that exists is read. */
export const repoRoadmapCandidates = [
  "docs/roadmap.md",
  "ROADMAP.md",
  "Roadmap.md",
  "TODO.md",
];

export interface RoadmapSourceDeps {
  readText: (path: string) => Promise<string | null>;
  /** Roadmap files per vault, keyed by the vault's absolute path, relative to it. */
  vaultRoadmaps: ReadonlyMap<string, readonly string[]>;
}

async function repoRoadmap(
  root: string,
  deps: RoadmapSourceDeps,
): Promise<RoadmapFile[]> {
  for (const candidate of repoRoadmapCandidates) {
    const text = await deps.readText(join(root, candidate));
    if (text !== null)
      return [deriveRoadmapFile(candidate, readRoadmapStructure(text))];
  }
  return [];
}

async function vaultRoadmap(
  root: string,
  files: readonly string[],
  deps: RoadmapSourceDeps,
): Promise<RoadmapFile[]> {
  const parsed: RoadmapFile[] = [];
  for (const file of files) {
    const text = await deps.readText(join(root, file));
    if (text === null) throw new Error(`roadmap file not found: ${file}`);
    parsed.push(deriveRoadmapFile(file, readRoadmapStructure(text)));
  }
  return parsed;
}

async function roadmapFor(
  item: Item & { path: string },
  deps: RoadmapSourceDeps,
): Promise<RoadmapData | ItemError> {
  try {
    const files =
      item.kind === "vault"
        ? await vaultRoadmap(
            item.path,
            deps.vaultRoadmaps.get(item.path) ?? [],
            deps,
          )
        : await repoRoadmap(item.path, deps);
    return { counts: countOpenItems(files), files };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

/** Parses each repository's roadmap file and each vault's configured roadmaps into work items. */
export function createRoadmapSource(
  deps: RoadmapSourceDeps,
): PolledSource<"roadmap"> {
  return {
    name: "roadmap",
    async scan(items) {
      const results = new Map<string, RoadmapData | ItemError>();
      for (const item of items) {
        if (item.path === null) continue;
        results.set(
          item.id,
          await roadmapFor({ ...item, path: item.path }, deps),
        );
      }
      return results;
    },
  };
}
