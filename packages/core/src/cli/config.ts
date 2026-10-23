import { type LoadedConfig, loadConfig } from "../config.ts";
import { defaultConfig } from "../config-default.ts";
import { readTextIfExists } from "../fs.ts";
import { home, userPath } from "./paths.ts";

/** The owner's config, or the defaults when there is none, saying so. */
export async function cliConfig(): Promise<LoadedConfig> {
  const loaded = await loadConfig({
    home,
    userPath,
    readText: readTextIfExists,
  });
  if (loaded !== null) return loaded;
  console.log(`no config at ${userPath}; scanning with the defaults`);
  return { config: defaultConfig(), path: "defaults" };
}
