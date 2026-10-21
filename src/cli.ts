// Entry point for `pnpm scan`: runs every polled source against this machine and writes
// scan.local.json at the repository root. Nothing else is written.

import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { driftThresholdsFor, loadConfig } from "./config.ts";
import { discover } from "./discovery.ts";
import { fileMtime, readTextIfExists } from "./fs.ts";
import { createFetchJson } from "./http.ts";
import { type PolledSources, runScan } from "./scan.ts";
import {
  createForgejoTokenLookup,
  createGithubTokenLookup,
} from "./secrets.ts";
import type { Snapshot } from "./snapshot.ts";
import { createClaudeSessionsSource } from "./sources/claude-sessions.ts";
import { dockerContainersSource } from "./sources/docker-containers.ts";
import { createForgejoSource } from "./sources/forgejo.ts";
import { createGitRunner, createGitSource } from "./sources/git.ts";
import { createGithubSource } from "./sources/github.ts";
import { createKumaSource } from "./sources/kuma.ts";
import { createRoadmapSource } from "./sources/roadmap.ts";

const repoRoot = resolve(import.meta.dirname, "..");
const outputPath = join(repoRoot, "scan.local.json");
const home = homedir();
const now = () => new Date();

async function readPrevious(): Promise<Snapshot | null> {
  const text = await readTextIfExists(outputPath);
  if (text === null) return null;
  try {
    return JSON.parse(text) as Snapshot;
  } catch {
    return null;
  }
}

const { config, path: configPath } = await loadConfig({
  home,
  examplePath: join(repoRoot, "config.example.toml"),
  readText: readTextIfExists,
});
const fetchJson = createFetchJson(10_000);

const polledSources: PolledSources = {
  git: createGitSource({
    runGit: createGitRunner(process.env),
    mtimeOf: fileMtime,
    now,
    thresholdsFor: (itemId) => driftThresholdsFor(config, itemId),
    concurrency: 8,
  }),
  roadmap: createRoadmapSource({
    readText: readTextIfExists,
    vaultRoadmaps: new Map(
      config.roots
        .filter((root) => root.kind === "vault")
        .map((root) => [root.path, root.roadmaps]),
    ),
  }),
  claudeSessions: createClaudeSessionsSource(join(home, ".claude", "projects")),
  github: createGithubSource({
    fetchJson,
    tokenFor: createGithubTokenLookup(home, process.env),
    hostAccounts: config.github.hostAccounts,
  }),
  forgejo: createForgejoSource({
    fetchJson,
    token: createForgejoTokenLookup(home, process.env),
    baseUrl: config.forgejo.baseUrl,
    remoteHosts: config.forgejo.remoteHosts,
  }),
  kuma: createKumaSource({
    fetchJson,
    baseUrl: config.server.kumaBaseUrl,
    statusPage: config.server.kumaStatusPage,
  }),
};

const snapshot = await runScan(
  {
    config,
    configPath,
    home,
    discovery: await discover(config.roots, config.excludeSegments),
    previous: await readPrevious(),
  },
  { now, polledSources, liveSources: [dockerContainersSource] },
);
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(
  `${snapshot.items.length} items in ${snapshot.durationMs} ms, config ${configPath}`,
);
for (const warning of snapshot.warnings) console.log(`warning: ${warning}`);
for (const [name, status] of Object.entries(snapshot.sources)) {
  const detail = status.state === "ok" ? "" : `: ${status.error}`;
  console.log(`${name}: ${status.state} (${status.durationMs} ms)${detail}`);
}
console.log(`wrote ${outputPath}`);
