// Entry point for `pnpm gather`: reads this machine and the forges, and writes raw facts, one
// file per source, to .scan/raw/. Nothing else is written.

import { runGather } from "../scan.ts";
import { cliConfig } from "./config.ts";
import { home, rawDir } from "./paths.ts";

const { config } = await cliConfig();
const status = await runGather({
  home,
  env: process.env,
  config,
  rawDir,
  now: () => new Date(),
});

console.log(`gathered in ${status.durationMs} ms into ${rawDir}`);
for (const [name, source] of Object.entries(status.sources)) {
  const detail =
    source.state === "ok" ? "" : `: ${source.reason}: ${source.message}`;
  console.log(`${name}: ${source.state} (${source.durationMs} ms)${detail}`);
}
