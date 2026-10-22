// The scanner composed: the sources config asks for, gathered into a raw directory, and the
// snapshot aggregated from those files. Every directory and the config are the caller's: the CLI
// keeps them under the repository, the desktop app under its data directory.

import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { aggregate, readRawBundle } from "./aggregate.ts";
import type { Config } from "./config.ts";
import { fileMtime, readTextIfExists } from "./fs.ts";
import { createRawStore, gather } from "./gather.ts";
import { createFetchJson } from "./http.ts";
import type { StatusFile } from "./raw.ts";
import { createKeyringTokenLookup } from "./secrets.ts";
import type { Snapshot } from "./snapshot.ts";
import { createClaudeSessionsSource } from "./sources/claude-sessions.ts";
import { dockerContainersSource } from "./sources/docker-containers.ts";
import {
  createForgeAccountsSource,
  createForgeSource,
} from "./sources/forge.ts";
import { createForgejoClient } from "./sources/forgejo.ts";
import { createGitRunner } from "./sources/git.ts";
import { createGithubClient } from "./sources/github.ts";
import { createKumaSource } from "./sources/kuma.ts";
import { createLocalSource } from "./sources/local.ts";
import { createRoadmapSource } from "./sources/roadmap.ts";

export interface GatherRun {
  /** The home directory: Claude Code's sessions live under it and git runs from it. */
  home: string;
  env: NodeJS.ProcessEnv;
  config: Config;
  /** Where the raw files go, one per source, created on first write. */
  rawDir: string;
  now: () => Date;
}

/** Gathers every source config asks for into the raw directory, and returns the gather's status. */
export async function runGather(run: GatherRun): Promise<StatusFile> {
  const { config, home, env } = run;
  const fetchJson = createFetchJson(10_000);
  const tokenFor = createKeyringTokenLookup(home, env);
  const github = {
    client: createGithubClient({
      fetchJson,
      finalisedCommits: config.forges.finalisedCommits,
    }),
    forge: config.forges.github,
    tokenFor,
  };
  const forgejo = {
    client: createForgejoClient({
      fetchJson,
      baseUrl: config.forges.forgejo.baseUrl,
      finalisedCommits: config.forges.finalisedCommits,
    }),
    forge: config.forges.forgejo,
    tokenFor,
  };
  return gather({
    now: run.now,
    store: createRawStore(run.rawDir),
    sources: {
      local: createLocalSource({
        home,
        include: config.local.include,
        ignore: config.local.ignore,
        runGit: createGitRunner(env),
        mtimeOf: fileMtime,
        concurrency: 8,
      }),
      githubAccounts: createForgeAccountsSource("githubAccounts", github),
      forgejoAccounts: createForgeAccountsSource("forgejoAccounts", forgejo),
      kuma:
        config.server === null
          ? null
          : createKumaSource({
              fetchJson,
              baseUrl: config.server.kumaBaseUrl,
              statusPage: config.server.kumaStatusPage,
            }),
      roadmap: createRoadmapSource({
        readText: readTextIfExists,
        roadmapsFor: (itemId) => config.items[itemId]?.roadmaps ?? null,
      }),
      claudeSessions: createClaudeSessionsSource(
        join(home, ".claude", "projects"),
      ),
      github: createForgeSource("github", "githubAccounts", github),
      forgejo: createForgeSource("forgejo", "forgejoAccounts", forgejo),
    },
  });
}

/**
 * The snapshot at a path, or null when there is none or it cannot be parsed: it is a cache and a
 * first-seen record, and losing it only restarts the expectation clocks.
 */
export async function readSnapshot(path: string): Promise<Snapshot | null> {
  const text = await readTextIfExists(path);
  if (text === null) return null;
  try {
    return JSON.parse(text) as Snapshot;
  } catch {
    return null;
  }
}

export interface AggregateRun {
  config: Config;
  /** The config file the config was read from, recorded in the snapshot. */
  configPath: string;
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
      liveSources: [dockerContainersSource],
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
