// Entry point for `pnpm gather`: reads this machine and writes raw facts, one file per source,
// to .scan/raw/. Nothing else is written.

import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../config.ts";
import { discover, discoveryFile } from "../discovery.ts";
import { fileMtime, readTextIfExists } from "../fs.ts";
import { createRawStore, gather } from "../gather.ts";
import { createFetchJson } from "../http.ts";
import {
  createForgejoTokenLookup,
  createGithubTokenLookup,
} from "../secrets.ts";
import { createClaudeSessionsSource } from "../sources/claude-sessions.ts";
import { createForgejoSource } from "../sources/forgejo.ts";
import { createGitRunner, createGitSource } from "../sources/git.ts";
import { createGithubSource } from "../sources/github.ts";
import { createKumaSource } from "../sources/kuma.ts";
import { createRoadmapSource } from "../sources/roadmap.ts";
import { examplePath, rawDir } from "./paths.ts";

const home = homedir();
const now = () => new Date();
const { config } = await loadConfig({
  home,
  examplePath,
  readText: readTextIfExists,
});
const fetchJson = createFetchJson(10_000);

const status = await gather(
  discoveryFile(
    await discover(config.roots, config.excludeSegments),
    home,
    config.server.name,
    now(),
  ),
  {
    now,
    store: createRawStore(rawDir),
    sources: {
      git: createGitSource({
        runGit: createGitRunner(process.env),
        mtimeOf: fileMtime,
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
      claudeSessions: createClaudeSessionsSource(
        join(home, ".claude", "projects"),
      ),
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
    },
  },
);

console.log(`gathered in ${status.durationMs} ms into ${rawDir}`);
for (const [name, source] of Object.entries(status.sources)) {
  const detail =
    source.state === "ok" ? "" : `: ${source.reason}: ${source.message}`;
  console.log(`${name}: ${source.state} (${source.durationMs} ms)${detail}`);
}
