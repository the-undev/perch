import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  importanceFor,
  loadConfig,
  parseConfig,
  thresholdsFor,
  wireFor,
  zellijSessionFor,
} from "../src/config.ts";

const examplePath = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "config.example.toml",
);
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
    expect(config.wires).toEqual({
      names: ["Machine & Home", "Projects"],
      default: "Projects",
    });
    expect(config.thresholds).toEqual({
      unsafe: { amberHours: 24, redHours: 72 },
      stalled: { amberDays: 7, redDays: 30 },
      expectation: { amberDays: 7, redDays: 30 },
    });
    expect(config.importance.default).toBe("projects");
    expect(config.items["obsidian/Hothouse"]?.roadmaps).toEqual([
      "Tech/Tech Plans.md",
      "Garden/Garden Plans.md",
    ]);
    expect(config.forges.finalisedCommits).toBe(10);
    expect(config.scan).toEqual({
      intervalMinutes: 15,
      archivedIntervalHours: 24,
    });
    expect(config.launch).toEqual({
      zellijSession: "home",
      zellijSessions: { "/home/test/undev": "undev" },
    });
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
    expect(config.server).toBeNull();
  });

  it("parses the [server] section when it is present", async () => {
    const config = parseConfig(
      `${await exampleText()}\n[server]\nname = "Silo"\nkuma_base_url = "http://kuma.example.lan:3001"\nkuma_status_page = "perch"\n`,
      home,
    );

    expect(config.server).toEqual({
      name: "Silo",
      kumaBaseUrl: "http://kuma.example.lan:3001",
      kumaStatusPage: "perch",
    });
  });

  it("gives every item the default tier and global thresholds when nothing is overridden", async () => {
    const config = parseConfig(await exampleText(), home);

    expect(importanceFor(config, "dev/perch")).toBe("projects");
    expect(thresholdsFor(config, "dev/perch")).toEqual(config.thresholds);
  });

  it("shows every entry field in its commented example, and each parses", async () => {
    const text = await exampleText();
    const lines = text.split("\n");
    const start = lines.indexOf('# [items."dev/perch"]');
    const block = [];
    for (const line of lines.slice(start)) {
      if (!line.startsWith("# ")) break;
      block.push(line.slice(2));
    }
    const config = parseConfig(
      text.replace("[forges]\n", `${block.join("\n")}\n\n[forges]\n`),
      home,
    );

    expect(config.items["dev/perch"]).toEqual({
      wire: "Projects",
      name: "Perch",
      importance: "machine",
      thresholds: {
        unsafe: { amberHours: 12, redHours: 48 },
        stalled: { amberDays: 14, redDays: 60 },
        expectation: { amberDays: 3, redDays: 14 },
      },
      expect: ["ci", "tickets"],
      keyFiles: ["README.md", "docs/spec.md", "docs/roadmap.md"],
      roadmaps: ["docs/roadmap.md"],
      zellijSession: "home",
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

  it("apply importance and thresholds to the named item only", async () => {
    const text = await withOverrides(
      '[items.".dotfiles"]\nimportance = "machine"\nunsafe_amber_hours = 3\nstalled_red_days = 60\n',
    );
    const config = parseConfig(text, home);

    expect(importanceFor(config, ".dotfiles")).toBe("machine");
    expect(thresholdsFor(config, ".dotfiles")).toEqual({
      unsafe: { amberHours: 3, redHours: 72 },
      stalled: { amberDays: 7, redDays: 60 },
      expectation: { amberDays: 7, redDays: 30 },
    });
    expect(importanceFor(config, "dev/perch")).toBe("projects");
    expect(thresholdsFor(config, "dev/perch")).toEqual(config.thresholds);
  });

  it("put an adopted item on its wire, the default wire without one, and the rest on the fence", async () => {
    const text = await withOverrides(
      '[items.".dotfiles"]\nwire = "Machine & Home"\n\n[items."dev/perch"]\n',
    );
    const config = parseConfig(text, home);

    expect(wireFor(config, ".dotfiles")).toBe("Machine & Home");
    expect(wireFor(config, "dev/perch")).toBe("Projects");
    expect(wireFor(config, "dev/hello")).toBeNull();
  });

  it("choose the zellij session from the entry, then the longest root, then the default", async () => {
    const text = (
      await withOverrides('[items."undev/spool"]\nzellij_session = "spool"\n')
    ).replace(
      '"~/undev" = "undev"',
      '"~/undev" = "undev"\n"~/undev/tools" = "tools"',
    );
    const config = parseConfig(text, home);

    expect(
      zellijSessionFor(config, "undev/spool", "/home/test/undev/spool"),
    ).toBe("spool");
    expect(
      zellijSessionFor(config, "undev/x", "/home/test/undev/tools/x"),
    ).toBe("tools");
    expect(zellijSessionFor(config, "undev/y", "/home/test/undev/y")).toBe(
      "undev",
    );
    expect(zellijSessionFor(config, "undevx", "/home/test/undevx")).toBe(
      "home",
    );
  });

  it("reject a wire that is not in the wire list", async () => {
    const text = await withOverrides('[items."dev/perch"]\nwire = "Garden"\n');

    expect(() => parseConfig(text, home)).toThrow(/wire must be one of/);
  });

  it("reject an expectation perch cannot check", async () => {
    const text = await withOverrides(
      '[items."dev/perch"]\nexpect = ["docs"]\n',
    );

    expect(() => parseConfig(text, home)).toThrow(
      /expect must be one of ci, tickets/,
    );
  });

  it("reject an amber window that does not open before red, once merged with the globals", async () => {
    const text = await withOverrides(
      '[items."dev/perch"]\nunsafe_amber_hours = 72\n',
    );

    expect(() => parseConfig(text, home)).toThrow(
      /items."dev\/perch".unsafe amber threshold must be below its red threshold/,
    );
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

    files.set(
      userPath,
      example.replace("stalled_amber_days = 7", "stalled_amber_days = 5"),
    );
    const user = await loadConfig({ home, examplePath, readText });
    expect(user.path).toBe(userPath);
    expect(user.config.thresholds.stalled.amberDays).toBe(5);
  });
});
