import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.ts";
import type { FetchJson } from "../src/http.ts";
import {
  gatherSources,
  readSnapshot,
  runAggregate,
  runGather,
} from "../src/scan.ts";
import {
  commit,
  initRepo,
  isolatedGitEnv,
  makeTempDir,
  removeDir,
} from "./helpers/git-fixture.ts";

// Only a local source, so the scan reads nothing beyond the fixture home.
const configText = `
joins = []
ignore = []
[wires]
names = ["Projects"]
default = "Projects"
[[sources.local]]
include = ["~/dev"]
[thresholds]
unsafe_amber_hours = 24
unsafe_red_hours = 72
stalled_amber_days = 7
stalled_red_days = 30
expectation_amber_days = 7
expectation_red_days = 30
[scan]
interval_minutes = 15
finalised_commits = 10
[launch]
zellij_session = "home"
[items."dev/kept"]
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
      home,
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
      home,
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

describe("the sources config declares", () => {
  /** Every request answered with an empty list, each recorded with its token. */
  function emptyForges() {
    const requests: string[] = [];
    const fetchJson: FetchJson = async (url, headers) => {
      requests.push(`${url} ${headers.Authorization ?? ""}`);
      return [];
    };
    return { requests, fetchJson };
  }

  const io = (fetchJson: FetchJson) => ({
    home,
    env: isolatedGitEnv,
    fetchJson,
    tokenFor: async (key: string) => `token-of-${key}`,
  });

  const withSources = (sources: string) =>
    parseConfig(
      configText.replace("[thresholds]", `${sources}\n[thresholds]`),
      home,
    );

  it("lists every github account, each with its own key's token", async () => {
    const { requests, fetchJson } = emptyForges();
    const config = withSources(`
[[sources.github]]
account = "one"
key = "github-one"
hosts = ["github.com"]
[[sources.github]]
account = "two"
key = "github-two"
hosts = ["github.com"]
`);

    const data = await gatherSources(
      config,
      io(fetchJson),
    ).githubAccounts.gather({});

    expect(Object.keys(data)).toEqual(["one", "two"]);
    expect(requests.map((request) => request.split(" ").at(-1))).toEqual([
      "token-of-github-one",
      "token-of-github-two",
    ]);
  });

  it("reads each forgejo account at its own base URL", async () => {
    const { requests, fetchJson } = emptyForges();
    const config = withSources(`
[[sources.forgejo]]
base_url = "https://a.example.lan"
account = "someone"
key = "forgejo-a"
hosts = ["a.example.lan"]
[[sources.forgejo]]
base_url = "https://b.example.lan"
account = "another"
key = "forgejo-b"
hosts = ["b.example.lan"]
`);

    await gatherSources(config, io(fetchJson)).forgejoAccounts.gather({});

    expect(requests).toEqual([
      "https://a.example.lan/api/v1/user/repos?limit=50&page=1 token token-of-forgejo-a",
      "https://b.example.lan/api/v1/user/repos?limit=50&page=1 token token-of-forgejo-b",
    ]);
  });

  it("runs no kuma source without a kuma table, and one over every table declared", async () => {
    const { fetchJson } = emptyForges();
    const kuma = (name: string) =>
      `[[sources.kuma]]\nname = "${name}"\nbase_url = "http://kuma.invalid"\nstatus_page = "${name}"\n`;

    expect(gatherSources(withSources(""), io(fetchJson)).kuma).toBeNull();
    const data = await gatherSources(
      withSources(kuma("one") + kuma("two")),
      io(fetchJson),
    ).kuma?.gather({});
    expect(Object.keys(data ?? {})).toEqual(["one", "two"]);
  });

  it("gathers nothing from a config with no sources", async () => {
    const { requests, fetchJson } = emptyForges();
    const config = parseConfig(
      configText.replace('[[sources.local]]\ninclude = ["~/dev"]\n', ""),
      home,
    );
    const sources = gatherSources(config, io(fetchJson));

    expect(await sources.local.gather({})).toEqual({
      includes: {},
      presences: {},
    });
    expect(await sources.githubAccounts.gather({})).toEqual({});
    expect(await sources.forgejoAccounts.gather({})).toEqual({});
    expect(requests).toEqual([]);
  });
});
