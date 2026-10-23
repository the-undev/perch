import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseConfig } from "@perch/core/config.ts";
import { defaultConfig } from "@perch/core/config-default.ts";
import { writeConfig } from "@perch/core/config-write.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeStarterConfig } from "./starter-config.ts";

let dir: string;
let home: string;
let configPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "perch-starter-"));
  home = join(dir, "home");
  configPath = join(home, ".config", "perch", "config.toml");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("the starter config", () => {
  it("writes the default config to the config path, creating its directory", async () => {
    await writeStarterConfig(configPath, home);

    const text = await readFile(configPath, "utf8");
    expect(text).toBe(writeConfig(defaultConfig(), home));
    expect(parseConfig(text, home)).toEqual(defaultConfig());
  });

  it("refuses when the file exists, and writes nothing", async () => {
    await mkdir(join(home, ".config", "perch"), { recursive: true });
    await writeFile(configPath, "# the owner's own\n");

    await expect(writeStarterConfig(configPath, home)).rejects.toThrow(
      `${configPath} already exists`,
    );
    expect(await readFile(configPath, "utf8")).toBe("# the owner's own\n");
  });
});
