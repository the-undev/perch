import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  driftThresholdsFor,
  importanceFor,
  loadConfig,
  parseConfig,
} from "../src/config.ts";

const examplePath = join(import.meta.dirname, "..", "config.example.toml");
const home = "/home/test";

async function exampleText(): Promise<string> {
  return readFile(examplePath, "utf8");
}

describe("example config", () => {
  it("parses with every path expanded against the home directory", async () => {
    const config = parseConfig(await exampleText(), home);

    expect(config.local.include).toEqual([
      "/home/test/dev",
      "/home/test/undev",
      "/home/test/.dotfiles",
      "/home/test/obsidian/Hothouse",
      "/home/test/obsidian/Pocket",
    ]);
    expect(config.local.ignore).toEqual([
      "/home/test/dev/archived",
      "/home/test/dev/third-party",
      "/home/test/dev/all/delete",
    ]);
    expect(config.joins).toEqual([]);
    expect(config.ignore).toEqual([]);
    expect(config.drift).toEqual({ amberDays: 7, redDays: 30 });
    expect(config.importance.default).toBe("projects");
    expect(config.items["obsidian/Hothouse"]?.roadmaps).toEqual([
      "Tech/Tech Plans.md",
      "Garden/Garden Plans.md",
    ]);
    expect(config.forges.finalisedCommits).toBe(10);
    expect(config.forges.archivedIntervalHours).toBe(24);
    expect(config.forges.github.trackedForks).toEqual([]);
    expect(config.forges.github.hosts).toEqual(["github.com", "github-work"]);
    expect(config.forges.github.accounts).toEqual([
      { account: "finch", key: "github-finch" },
      { account: "the-undev", key: "github-the-undev" },
      { account: "skiff-app", key: "github-skiff-app" },
    ]);
    expect(config.forges.forgejo.accounts.map((entry) => entry.key)).toEqual([
      "forgejo-finch",
      "forgejo-the-undev",
    ]);
    expect(config.forges.forgejo.baseUrl).toBe("http://forge.example.lan:3000");
    expect(config.server.kumaStatusPage).toBe("perch");
  });

  it("gives every item the default tier and global thresholds when nothing is overridden", async () => {
    const config = parseConfig(await exampleText(), home);

    expect(importanceFor(config, "dev/perch")).toBe("projects");
    expect(driftThresholdsFor(config, "dev/perch")).toEqual({
      amberDays: 7,
      redDays: 30,
    });
  });
});

describe("item overrides", () => {
  async function withOverrides(overrides: string): Promise<string> {
    return (await exampleText()).replace(
      "[forges]\n",
      `${overrides}\n[forges]\n`,
    );
  }

  it("apply importance and drift thresholds to the named item only", async () => {
    const text = await withOverrides(
      '[items.".dotfiles"]\nimportance = "machine"\ndrift_amber_days = 3\n',
    );
    const config = parseConfig(text, home);

    expect(importanceFor(config, ".dotfiles")).toBe("machine");
    expect(driftThresholdsFor(config, ".dotfiles")).toEqual({
      amberDays: 3,
      redDays: 30,
    });
    expect(importanceFor(config, "dev/perch")).toBe("projects");
  });

  it("reject a tier that is not in the tier list", async () => {
    const text = await withOverrides(
      '[items."dev/perch"]\nimportance = "urgent"\n',
    );

    expect(() => parseConfig(text, home)).toThrow(/importance must be one of/);
  });
});

describe("loadConfig", () => {
  it("prefers the user config and falls back to the example", async () => {
    const userPath = join(home, ".config", "perch", "config.toml");
    const example = await exampleText();
    const files = new Map([[examplePath, example]]);
    const readText = async (path: string) => files.get(path) ?? null;

    const fallback = await loadConfig({ home, examplePath, readText });
    expect(fallback.path).toBe(examplePath);

    files.set(userPath, example.replace("amber_days = 7", "amber_days = 5"));
    const user = await loadConfig({ home, examplePath, readText });
    expect(user.path).toBe(userPath);
    expect(user.config.drift.amberDays).toBe(5);
  });
});
