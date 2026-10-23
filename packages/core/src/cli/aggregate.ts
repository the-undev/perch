// Entry point for `pnpm aggregate`: reads only the raw files, the config and the previous
// snapshot, derives every value, and writes .scan/snapshot.json. It does not read the machine.

import { runAggregate } from "../scan.ts";
import { cliConfig } from "./config.ts";
import { rawDir, snapshotPath } from "./paths.ts";

const { config, path: configPath } = await cliConfig();
const snapshot = await runAggregate({
  config,
  configPath,
  rawDir,
  snapshotPath,
  now: () => new Date(),
});

console.log(
  `${snapshot.items.length} items, config ${configPath}, wrote ${snapshotPath}`,
);
for (const warning of snapshot.warnings) console.log(`warning: ${warning}`);
