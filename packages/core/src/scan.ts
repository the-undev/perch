// The scanner composed: the sources config asks for, gathered into a raw directory, and the
// snapshot aggregated from those files. Every directory and the config are the caller's: the CLI
// keeps them under the repository, the desktop app under its data directory.

import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { aggregate, localPapers, readRawBundle } from "./aggregate.ts";
import type { Config } from "./config.ts";
import { fileMtime, readTextIfExists } from "./fs.ts";
import { createRawStore, gather, type PolledSources } from "./gather.ts";
import { createFetchJson, type FetchJson } from "./http.ts";
import type { StatusFile } from "./raw.ts";
import { createKeyringTokenLookup, type TokenLookup } from "./secrets.ts";
import type { Snapshot } from "./snapshot.ts";
import { migrateSnapshot } from "./snapshot-migration.ts";
import {
  createForgeAccountsSource,
  createForgeSource,
} from "./sources/forge.ts";
import { createForgejoClient } from "./sources/forgejo.ts";
import { createGitRunner } from "./sources/git.ts";
import { createGithubClient } from "./sources/github.ts";
import { createLocalSource } from "./sources/local.ts";
import { createRoadmapSource } from "./sources/roadmap.ts";

export interface GatherRun {
  /** The home directory: git runs from it. */
  home: string;
  env: NodeJS.ProcessEnv;
  config: Config;
  /** Where the raw files go, one per source, created on first write. */
  rawDir: string;
  now: () => Date;
}

/** What the sources reach the outside world through. */
export interface SourceIo {
  /** The home directory: git runs from it. */
  home: string;
  env: NodeJS.ProcessEnv;
  fetchJson: FetchJson;
  tokenFor: TokenLookup;
}

/**
 * The polled sources config declares: one local source over every local table's paths, one
 * client per forge account.
 */
export function gatherSources(config: Config, io: SourceIo): PolledSources {
  const { home, fetchJson, tokenFor } = io;
  const { sources, scan } = config;
  const github = {
    cards: sources.github.map((card) => ({
      ...card,
      client: createGithubClient({
        fetchJson,
        finalisedCommits: scan.finalisedCommits,
      }),
    })),
    tokenFor,
  };
  const forgejo = {
    cards: sources.forgejo.map((card) => ({
      ...card,
      client: createForgejoClient({
        fetchJson,
        baseUrl: card.baseUrl,
        finalisedCommits: scan.finalisedCommits,
      }),
    })),
    tokenFor,
  };
  return {
    local: createLocalSource({
      home,
      include: [...new Set(sources.local.flatMap((card) => card.include))],
      ignore: [...new Set(sources.local.flatMap((card) => card.exclude))],
      runGit: createGitRunner(io.env),
      mtimeOf: fileMtime,
      finalisedCommits: scan.finalisedCommits,
      concurrency: 8,
    }),
    githubAccounts: createForgeAccountsSource("githubAccounts", github),
    forgejoAccounts: createForgeAccountsSource("forgejoAccounts", forgejo),
    roadmap: createRoadmapSource({
      readText: readTextIfExists,
      roadmapsFor: (earlier) => {
        const papersByLocalId = localPapers(earlier, config);
        return (localId) => papersByLocalId.get(localId)?.roadmaps ?? null;
      },
    }),
    github: createForgeSource("github", "githubAccounts", github),
    forgejo: createForgeSource("forgejo", "forgejoAccounts", forgejo),
  };
}

/** Gathers every source config declares into the raw directory, and returns the gather's status. */
export async function runGather(run: GatherRun): Promise<StatusFile> {
  const { home, env } = run;
  return gather({
    now: run.now,
    store: createRawStore(run.rawDir),
    sources: gatherSources(run.config, {
      home,
      env,
      fetchJson: createFetchJson(10_000),
      tokenFor: createKeyringTokenLookup(home, env),
    }),
  });
}

/**
 * The snapshot at a path migrated to this perch's version, or null when there is none, it cannot
 * be parsed or it is newer: it is a cache, and losing it only forgets each source card's last read.
 */
export async function readSnapshot(path: string): Promise<Snapshot | null> {
  const text = await readTextIfExists(path);
  if (text === null) return null;
  try {
    return migrateSnapshot(JSON.parse(text));
  } catch {
    return null;
  }
}

export interface AggregateRun {
  config: Config;
  /** The config file the config was read from, recorded in the snapshot. */
  configPath: string;
  /** The home directory, written as ~ in the source cards' paths. */
  home: string;
  rawDir: string;
  /** The snapshot to read first, for its first-seen record, and then replace. */
  snapshotPath: string;
  now: () => Date;
}

/**
 * Aggregates the raw directory into a snapshot and writes it, replacing the previous one in one
 * rename so a reader never sees half a file.
 */
export async function runAggregate(run: AggregateRun): Promise<Snapshot> {
  const previous = await readSnapshot(run.snapshotPath);
  const snapshot = aggregate(
    await readRawBundle(createRawStore(run.rawDir)),
    {
      config: run.config,
      configPath: run.configPath,
      home: run.home,
      previous,
    },
    run.now(),
  );
  await mkdir(dirname(run.snapshotPath), { recursive: true });
  const partPath = `${run.snapshotPath}.part`;
  await writeFile(partPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  await rename(partPath, run.snapshotPath);
  return snapshot;
}
