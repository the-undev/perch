import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.ts";
import { readSnapshot, runAggregate, runGather } from "../src/scan.ts";
import {
  commit,
  initRepo,
  isolatedGitEnv,
  makeTempDir,
  removeDir,
} from "./helpers/git-fixture.ts";

// No forge accounts and no server, so the scan reads nothing beyond the fixture home.
const configText = `
joins = []
ignore = []
[wires]
names = ["Projects"]
default = "Projects"
[local]
include = ["~/dev"]
ignore = []
[thresholds]
unsafe_amber_hours = 24
unsafe_red_hours = 72
stalled_amber_days = 7
stalled_red_days = 30
expectation_amber_days = 7
expectation_red_days = 30
[importance]
tiers = ["projects"]
default = "projects"
[scan]
interval_minutes = 15
archived_interval_hours = 24
[launch]
zellij_session = "home"
[items."dev/kept"]
[forges]
finalised_commits = 10
[forges.github]
hosts = ["github.com"]
accounts = []
tracked_forks = []
[forges.forgejo]
base_url = "http://forgejo.invalid"
hosts = []
accounts = []
tracked_forks = []
`;

let home: string;
let dataDir: string;
beforeEach(() => {
  home = makeTempDir();
  dataDir = makeTempDir();
  const repo = initRepo(join(home, "dev", "kept"));
  commit(repo, "README.md", "Start", new Date("2026-10-20T09:00:00Z"));
});
afterEach(() => {
  removeDir(home);
  removeDir(dataDir);
});

const now = () => new Date("2026-10-22T09:00:00Z");

describe("the scan with its directories passed in", () => {
  it("gathers and aggregates into the directories given, and nowhere else", async () => {
    const config = parseConfig(configText, home);
    const rawDir = join(dataDir, "scan", "raw");
    const snapshotPath = join(dataDir, "scan", "snapshot.json");

    const status = await runGather({
      home,
      env: isolatedGitEnv,
      config,
      rawDir,
      now,
    });
    const snapshot = await runAggregate({
      config,
      configPath: "/configs/perch.toml",
      rawDir,
      snapshotPath,
      now,
    });

    expect(status.sources.local?.state).toBe("ok");
    expect(readdirSync(rawDir)).toContain("local.json");
    expect(snapshot.configPath).toBe("/configs/perch.toml");
    expect(snapshot.items.map((item) => item.id)).toEqual(["dev/kept"]);
    expect(await readSnapshot(snapshotPath)).toEqual(snapshot);
    expect(readdirSync(join(dataDir, "scan")).sort()).toEqual([
      "raw",
      "snapshot.json",
    ]);
    expect(existsSync(join(home, ".scan"))).toBe(false);
  });

  it("aggregates over an unreadable previous snapshot as if there were none", async () => {
    const config = parseConfig(configText, home);
    const rawDir = join(dataDir, "raw");
    const snapshotPath = join(dataDir, "snapshot.json");
    await runGather({ home, env: isolatedGitEnv, config, rawDir, now });
    writeFileSync(snapshotPath, "{ half a file");

    expect(await readSnapshot(snapshotPath)).toBeNull();
    const snapshot = await runAggregate({
      config,
      configPath: "/configs/perch.toml",
      rawDir,
      snapshotPath,
      now,
    });
    expect(snapshot.items).toHaveLength(1);
  });

  it("reads no snapshot where none was written", async () => {
    expect(await readSnapshot(join(dataDir, "absent.json"))).toBeNull();
  });
});
