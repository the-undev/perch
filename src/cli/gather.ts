// Entry point for `pnpm gather`: reads this machine and the forges, and writes raw facts, one
// file per source, to .scan/raw/. Nothing else is written.

import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../config.ts";
import { fileMtime, readTextIfExists } from "../fs.ts";
import { createRawStore, gather } from "../gather.ts";
import { createFetchJson } from "../http.ts";
import {
  createForgejoTokenLookup,
  createGithubTokenLookup,
} from "../secrets.ts";
import { createClaudeSessionsSource } from "../sources/claude-sessions.ts";
import {
  createForgeAccountsSource,
  createForgeSource,
} from "../sources/forge.ts";
import { createForgejoClient } from "../sources/forgejo.ts";
import { createGitRunner } from "../sources/git.ts";
import { createGithubClient } from "../sources/github.ts";
import { createKumaSource } from "../sources/kuma.ts";
import { createLocalSource } from "../sources/local.ts";
import { createRoadmapSource } from "../sources/roadmap.ts";
import { examplePath, rawDir } from "./paths.ts";

const home = homedir();
const { config } = await loadConfig({
  home,
  examplePath,
  readText: readTextIfExists,
});
const fetchJson = createFetchJson(10_000);
const github = createGithubClient({
  fetchJson,
  tokenFor: createGithubTokenLookup(home, process.env),
  finalisedCommits: config.forges.finalisedCommits,
});
const forgejo = createForgejoClient({
  fetchJson,
  token: createForgejoTokenLookup(home, process.env),
  baseUrl: config.forges.forgejo.baseUrl,
  finalisedCommits: config.forges.finalisedCommits,
});

const status = await gather({
  now: () => new Date(),
  store: createRawStore(rawDir),
  sources: {
    local: createLocalSource({
      home,
      include: config.local.include,
      ignore: config.local.ignore,
      runGit: createGitRunner(process.env),
      mtimeOf: fileMtime,
      concurrency: 8,
    }),
    githubAccounts: createForgeAccountsSource(
      "githubAccounts",
      github,
      config.forges.github,
    ),
    forgejoAccounts: createForgeAccountsSource(
      "forgejoAccounts",
      forgejo,
      config.forges.forgejo,
    ),
    kuma: createKumaSource({
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
    github: createForgeSource(
      "github",
      "githubAccounts",
      github,
      config.forges.github,
    ),
    forgejo: createForgeSource(
      "forgejo",
      "forgejoAccounts",
      forgejo,
      config.forges.forgejo,
    ),
  },
});

console.log(`gathered in ${status.durationMs} ms into ${rawDir}`);
for (const [name, source] of Object.entries(status.sources)) {
  const detail =
    source.state === "ok" ? "" : `: ${source.reason}: ${source.message}`;
  console.log(`${name}: ${source.state} (${source.durationMs} ms)${detail}`);
}
