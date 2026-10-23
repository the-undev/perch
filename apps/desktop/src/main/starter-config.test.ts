import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeStarterConfig } from "./starter-config.ts";

let dir: string;
let examplePath: string;
let configPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "perch-starter-"));
  examplePath = join(dir, "config.example.toml");
  configPath = join(dir, "home", ".config", "perch", "config.toml");
  await writeFile(examplePath, "# the example\n");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("the starter config", () => {
  it("copies the example to the config path, creating its directory", async () => {
    await writeStarterConfig(examplePath, configPath);

    expect(await readFile(configPath, "utf8")).toBe("# the example\n");
  });

  it("refuses when the file exists, and writes nothing", async () => {
    await mkdir(join(dir, "home", ".config", "perch"), { recursive: true });
    await writeFile(configPath, "# the owner's own\n");

    await expect(writeStarterConfig(examplePath, configPath)).rejects.toThrow(
      `${configPath} already exists`,
    );
    expect(await readFile(configPath, "utf8")).toBe("# the owner's own\n");
  });
});
