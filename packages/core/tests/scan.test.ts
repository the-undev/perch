import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
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
import { snapshotVersion } from "../src/snapshot.ts";
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
[scan]
interval_minutes = 15
finalised_commits = 10
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
    expect(JSON.parse(readFileSync(snapshotPath, "utf8")).version).toBe(
      snapshotVersion,
    );
    expect(snapshot.entities.map((entity) => entity.id)).toEqual(["dev/kept"]);
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
    expect(snapshot.entities).toHaveLength(1);
  });

  it("reads no snapshot where none was written", async () => {
    expect(await readSnapshot(join(dataDir, "absent.json"))).toBeNull();
  });
});

describe("a snapshot cached by an earlier perch", () => {
  const version1Fixture = join(
    import.meta.dirname,
    "fixtures",
    "snapshots",
    "version1.json",
  );

  it("reads a version 1 snapshot as version 2, with the new words and no server entity or Kuma card", async () => {
    const snapshotPath = join(dataDir, "snapshot.json");
    copyFileSync(version1Fixture, snapshotPath);

    const snapshot = await readSnapshot(snapshotPath);

    expect(snapshot?.version).toBe(snapshotVersion);
    expect(snapshot && "items" in snapshot).toBe(false);
    expect(snapshot?.entities.map((entity) => entity.id)).toEqual([
      "dev/nest",
      "dev/shed",
    ]);
    const [nest, shed] = snapshot?.entities ?? [];
    expect(nest && "presences" in nest).toBe(false);
    expect(nest && "liveSources" in nest).toBe(false);
    expect(nest?.repositories.local).toEqual({
      ref: "local:dev/nest",
      path: "/home/owner/dev/nest",
    });
    expect(nest?.repositories.forges.map((forge) => forge.ref)).toEqual([
      "github:finch/nest",
    ]);
    expect(nest?.flags.map((flag) => flag.flag)).toEqual([
      "remote-linked-elsewhere",
    ]);
    const git = nest?.sources.git;
    if (!git || "error" in git) throw new Error("expected git data");
    expect(git.backup).toBe("linked");
    expect(git.workState).toBe("uncommitted");
    expect(git.unsafeWork.uncommitted?.hours).toBe(21);
    expect("activity" in git || "drift" in git).toBe(false);
    const roadmap = nest?.sources.roadmap;
    if (!roadmap || "error" in roadmap) throw new Error("expected roadmap");
    const [file] = roadmap.files;
    expect(file?.workItems.map((item) => item.text)).toEqual(["Top task"]);
    expect(file?.groups[0]?.workItems).toEqual([]);
    expect(
      file?.groups[0]?.groups[0]?.workItems.map((item) => item.text),
    ).toEqual(["Nested task"]);
    expect(JSON.stringify(file)).not.toContain('"items"');
    expect(shed?.sources.git).toEqual({ error: "git status failed" });
    expect(snapshot?.forges.github.active).toEqual([
      {
        ref: "github:finch/nest",
        fullName: "finch/nest",
        url: "https://github.com/finch/nest",
        entityId: "dev/nest",
        ignored: false,
      },
      {
        ref: "github:finch/loose",
        fullName: "finch/loose",
        url: "https://github.com/finch/loose",
        entityId: null,
        ignored: false,
      },
    ]);
    expect(Object.keys(snapshot?.sources ?? {})).toEqual(["local"]);
    expect(snapshot?.sourceCards.map((card) => card.id)).toEqual([
      "local:~/dev",
    ]);
    expect(readFileSync(snapshotPath, "utf8")).toBe(
      readFileSync(version1Fixture, "utf8"),
    );
  });

  it("reads a snapshot from a newer perch as no cache, and leaves it as it was", async () => {
    const snapshotPath = join(dataDir, "snapshot.json");
    const newer = `${JSON.stringify({ version: 3, entities: [] })}\n`;
    writeFileSync(snapshotPath, newer);

    expect(await readSnapshot(snapshotPath)).toBeNull();
    expect(readFileSync(snapshotPath, "utf8")).toBe(newer);
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

    expect(Object.keys(data)).toEqual(["github-one", "github-two"]);
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

  it("gathers nothing from a config with no sources", async () => {
    const { requests, fetchJson } = emptyForges();
    const config = parseConfig(
      configText.replace('[[sources.local]]\ninclude = ["~/dev"]\n', ""),
      home,
    );
    const sources = gatherSources(config, io(fetchJson));

    expect(await sources.local.gather({})).toEqual({
      includes: {},
      repositories: {},
    });
    expect(await sources.githubAccounts.gather({})).toEqual({});
    expect(await sources.forgejoAccounts.gather({})).toEqual({});
    expect(requests).toEqual([]);
  });
});
