import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Config, parseConfig } from "../../src/config.ts";

/** The fixture config every scanner test starts from. */
export const fixtureConfigPath = join(
  import.meta.dirname,
  "..",
  "fixtures",
  "config.toml",
);

/** The fixture config's text with extra TOML, such as item entries, appended. */
export async function fixtureConfigText(extra: string): Promise<string> {
  return `${await readFile(fixtureConfigPath, "utf8")}\n${extra}\n`;
}

/** The fixture config with extra TOML appended, parsed against /home/test. */
export async function testConfig(extra: string): Promise<Config> {
  return parseConfig(await fixtureConfigText(extra), "/home/test");
}
