import { join, resolve } from "node:path";

/** The repository root, which holds the example config and the gitignored .scan directory. */
export const repoRoot = resolve(import.meta.dirname, "..", "..");
export const examplePath = join(repoRoot, "config.example.toml");
export const rawDir = join(repoRoot, ".scan", "raw");
export const snapshotPath = join(repoRoot, ".scan", "snapshot.json");
