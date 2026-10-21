import { join } from "node:path";
import { errorMessage } from "../fs.ts";
import type { RawEntries, RawRoadmapFile } from "../raw.ts";
import { readRoadmapStructure } from "../roadmap-parser.ts";
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

async function readFile(
  root: string,
  path: string,
  deps: RoadmapSourceDeps,
): Promise<RawRoadmapFile> {
  const text = await deps.readText(join(root, path));
  return {
    path,
    structure:
      text === null
        ? { state: "absent", reason: "file-not-found" }
        : { state: "observed", value: readRoadmapStructure(text) },
  };
}

async function repoRoadmap(
  root: string,
  deps: RoadmapSourceDeps,
): Promise<RawEntries["roadmap"]> {
  for (const candidate of repoRoadmapCandidates) {
    const file = await readFile(root, candidate, deps);
    if (file.structure.state === "observed") {
      return { state: "observed", value: { files: [file] } };
    }
  }
  return { state: "absent", reason: "no-roadmap-file" };
}

async function vaultRoadmap(
  root: string,
  deps: RoadmapSourceDeps,
): Promise<RawEntries["roadmap"]> {
  const paths = deps.vaultRoadmaps.get(root) ?? [];
  if (paths.length === 0) return { state: "absent", reason: "no-roadmap-file" };
  const files = await Promise.all(
    paths.map((path) => readFile(root, path, deps)),
  );
  return { state: "observed", value: { files } };
}

/** Reads the structure of each repository's roadmap file and each vault's configured roadmaps. */
export function createRoadmapSource(
  deps: RoadmapSourceDeps,
): PolledSource<"roadmap"> {
  return {
    name: "roadmap",
    async gather(items) {
      const entries: Record<string, RawEntries["roadmap"]> = {};
      for (const item of items) {
        if (item.kind === "server") continue;
        try {
          entries[item.id] =
            item.kind === "vault"
              ? await vaultRoadmap(item.path, deps)
              : await repoRoadmap(item.path, deps);
        } catch (error) {
          entries[item.id] = { state: "error", error: errorMessage(error) };
        }
      }
      return entries;
    },
  };
}
