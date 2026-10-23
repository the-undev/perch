import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeConfig } from "@perch/core/config-write.ts";
import { readTextIfExists } from "@perch/core/fs.ts";
import { mockConfig } from "@perch/core/mock.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editConfigFile, writeTextAtomic } from "./config-edit.ts";

let dir: string;
let configPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "perch-edit-"));
  configPath = join(dir, "config.toml");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const deps = () => ({
  home: "/home/owner",
  path: configPath,
  readText: readTextIfExists,
  writeText: writeTextAtomic,
});

describe("writing the config", () => {
  it("replaces the file in one rename, leaving no part file and keeping its mode", async () => {
    await writeFile(configPath, "old\n");
    await chmod(configPath, 0o600);

    await writeTextAtomic(configPath, "new\n");

    expect(await readFile(configPath, "utf8")).toBe("new\n");
    expect((await stat(configPath)).mode & 0o777).toBe(0o600);
    expect(await readdir(dir)).toEqual(["config.toml"]);
  });

  it("writes through a symlink to the file it names, so a stowed config stays stowed", async () => {
    const stowed = join(dir, "dotfiles", "perch", "config.toml");
    await mkdir(join(dir, "dotfiles", "perch"), { recursive: true });
    await writeFile(stowed, "old\n");
    await symlink(stowed, configPath);

    await writeTextAtomic(configPath, "new\n");

    expect((await lstat(configPath)).isSymbolicLink()).toBe(true);
    expect(await readFile(stowed, "utf8")).toBe("new\n");
  });

  it("applies an edit to a fresh read and writes what reads back", async () => {
    await writeFile(configPath, writeConfig(mockConfig, "/home/owner"));

    await editConfigFile(deps(), (config) => ({
      ...config,
      scan: { ...config.scan, intervalMinutes: 30 },
    }));

    expect(await readFile(configPath, "utf8")).toContain(
      "interval_minutes = 30",
    );
  });

  it("refuses, writing nothing, when the file is missing or does not parse", async () => {
    await expect(editConfigFile(deps(), (config) => config)).rejects.toThrow(
      `${configPath} does not exist`,
    );
    expect(await readdir(dir)).toEqual([]);

    await writeFile(configPath, "[wires]\nnames = 3\n");
    await expect(editConfigFile(deps(), (config) => config)).rejects.toThrow(
      "config: wires.names must be an array of strings",
    );
    expect(await readFile(configPath, "utf8")).toBe("[wires]\nnames = 3\n");
  });

  it("refuses, writing nothing, an edit that would not read back", async () => {
    const before = writeConfig(mockConfig, "/home/owner");
    await writeFile(configPath, before);

    await expect(
      editConfigFile(deps(), (config) => ({
        ...config,
        thresholds: {
          ...config.thresholds,
          stalled: { amberDays: 30, redDays: 7 },
        },
      })),
    ).rejects.toThrow("stalled amber threshold must be below its red");
    expect(await readFile(configPath, "utf8")).toBe(before);
  });
});
