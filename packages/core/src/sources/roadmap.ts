import { join } from "node:path";
import { SourceFailure } from "../failure.ts";
import { errorMessage } from "../fs.ts";
import type {
  Entry,
  RawData,
  RawFiles,
  RawRoadmap,
  RawRoadmapFile,
} from "../raw.ts";
import { sortedRecord } from "../records.ts";
import { readRoadmapStructure } from "../roadmap-parser.ts";
import type { PolledSource } from "./source.ts";

/** Roadmap file names for a repository, in order of preference; the first that exists is detected, not parsed. */
export const repoRoadmapCandidates = [
  "docs/roadmap.md",
  "ROADMAP.md",
  "Roadmap.md",
  "TODO.md",
];

type RoadmapEntry = Entry<RawRoadmap, "no-roadmap-file">;

export interface RoadmapSourceDeps {
  readText: (path: string) => Promise<string | null>;
  /**
   * Roadmap files the entry lists for each local presence, relative to it, or null or empty for
   * none (a standard-named file is then only detected); built once per gather from the earlier rounds' files.
   */
  roadmapsFor: (
    earlier: Partial<RawFiles>,
  ) => (localId: string) => readonly string[] | null;
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

async function detectedRoadmap(
  root: string,
  deps: RoadmapSourceDeps,
): Promise<RoadmapEntry> {
  for (const candidate of repoRoadmapCandidates) {
    const text = await deps.readText(join(root, candidate));
    if (text !== null) {
      return {
        state: "observed",
        value: { files: [], detectedPath: candidate },
      };
    }
  }
  return { state: "absent", reason: "no-roadmap-file" };
}

async function configuredRoadmap(
  root: string,
  paths: readonly string[],
  deps: RoadmapSourceDeps,
): Promise<RoadmapEntry> {
  const files = await Promise.all(
    paths.map((path) => readFile(root, path, deps)),
  );
  return { state: "observed", value: { files, detectedPath: null } };
}

/** Enricher: reads the roadmap structure of every local presence. */
export function createRoadmapSource(
  deps: RoadmapSourceDeps,
): PolledSource<"roadmap"> {
  return {
    name: "roadmap",
    async gather(earlier) {
      const local = earlier.local;
      if (local === undefined) {
        throw new SourceFailure(
          "unexpected",
          "no local presences to read roadmaps for",
        );
      }
      const roadmapsFor = deps.roadmapsFor(earlier);
      const entries: RawData["roadmap"] = {};
      for (const [id, presence] of Object.entries(local.data.presences)) {
        try {
          const configured = roadmapsFor(id);
          entries[id] =
            configured === null || configured.length === 0
              ? await detectedRoadmap(presence.path, deps)
              : await configuredRoadmap(presence.path, configured, deps);
        } catch (error) {
          entries[id] = { state: "error", error: errorMessage(error) };
        }
      }
      return sortedRecord(entries);
    },
  };
}
