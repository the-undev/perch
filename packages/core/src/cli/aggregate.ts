// Entry point for `pnpm aggregate`: reads only the raw files and the config, derives every value,
// and writes .scan/snapshot.json. It does not read the machine.

import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { aggregate, readRawBundle } from "../aggregate.ts";
import { loadConfig } from "../config.ts";
import { readTextIfExists } from "../fs.ts";
import { createRawStore } from "../gather.ts";
import { dockerContainersSource } from "../sources/docker-containers.ts";
import { examplePath, rawDir, snapshotPath } from "./paths.ts";

const { config, path: configPath } = await loadConfig({
  home: homedir(),
  examplePath,
  readText: readTextIfExists,
});
const snapshot = aggregate(
  await readRawBundle(createRawStore(rawDir)),
  { config, configPath, liveSources: [dockerContainersSource] },
  new Date(),
);
await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(
  `${snapshot.items.length} items, config ${configPath}, wrote ${snapshotPath}`,
);
for (const warning of snapshot.warnings) console.log(`warning: ${warning}`);
