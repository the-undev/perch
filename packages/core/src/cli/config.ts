import { type LoadedConfig, loadConfig } from "../config.ts";
import { defaultConfig } from "../config-default.ts";
import { readTextIfExists } from "../fs.ts";

/**
 * The owner's config, or the defaults when there is none, saying so. An older version is migrated
 * in memory; the file is never written.
 */
export async function cliConfig(paths: {
  home: string;
  userPath: string;
}): Promise<LoadedConfig> {
  const { home, userPath } = paths;
  const loaded = await loadConfig({
    home,
    userPath,
    readText: readTextIfExists,
  });
  if (loaded !== null) return loaded;
  console.log(`no config at ${userPath}; scanning with the defaults`);
  return { config: defaultConfig(), path: "defaults" };
}
