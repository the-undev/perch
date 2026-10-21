import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, sep } from "node:path";
import type { RootConfig, RootKind } from "./config.ts";
import { nullIfMissing } from "./fs.ts";

export interface DiscoveredPath {
  path: string;
  kind: RootKind;
}

export interface Discovery {
  found: DiscoveredPath[];
  warnings: string[];
}

/** How far below a repo root the search for repositories goes. */
const maxDepth = 5;

function hasExcludedSegment(
  path: string,
  excludeSegments: readonly string[],
): boolean {
  return path.split(sep).some((segment) => excludeSegments.includes(segment));
}

async function findRepositories(
  directory: string,
  depth: number,
  excludeSegments: readonly string[],
): Promise<string[]> {
  if (hasExcludedSegment(directory, excludeSegments)) return [];
  const entries: Dirent[] =
    (await nullIfMissing(() => readdir(directory, { withFileTypes: true }))) ??
    [];
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
      findRepositories(join(directory, entry.name), depth + 1, excludeSegments),
    ),
  );
  return nested.flat().sort();
}

async function exists(path: string): Promise<boolean> {
  return (await nullIfMissing(() => readdir(path))) !== null;
}

/**
 * Finds the items under the configured roots: every git repository below a repo root, and each
 * vault root itself. Repositories with an excluded path segment are skipped entirely.
 */
export async function discover(
  roots: readonly RootConfig[],
  excludeSegments: readonly string[],
): Promise<Discovery> {
  const found: DiscoveredPath[] = [];
  const warnings: string[] = [];
  for (const root of roots) {
    if (!(await exists(root.path))) {
      warnings.push(`root not found: ${root.path}`);
      continue;
    }
    if (root.kind === "vault") {
      found.push({ path: root.path, kind: "vault" });
      continue;
    }
    const repositories = await findRepositories(root.path, 0, excludeSegments);
    for (const path of repositories) found.push({ path, kind: "repo" });
  }
  return { found, warnings };
}
