import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cliConfig } from "../src/cli/config.ts";
import { fixtureConfigText } from "./helpers/config.ts";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "perch-cli-config-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("the command line scanner's config", () => {
  it("reads a version 1 file migrated in memory and leaves the file unchanged", async () => {
    const userPath = join(dir, "config.toml");
    const version1 = (await fixtureConfigText('[papers."dev/perch"]\n'))
      .replace("version = 2\n", "")
      .replace("links = []", "joins = []")
      .replace("[papers.", "[items.");
    await writeFile(userPath, version1);

    const { config } = await cliConfig({ home: "/home/test", userPath });

    expect(Object.keys(config.items)).toEqual(["dev/perch"]);
    expect(await readFile(userPath, "utf8")).toBe(version1);
    expect(await readdir(dir)).toEqual(["config.toml"]);
  });
});
