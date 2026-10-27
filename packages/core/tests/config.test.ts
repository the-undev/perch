import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type Config,
  loadConfig,
  parseConfig,
  resolveEntry,
  thresholdsFor,
  userConfigPath,
  wireFor,
  zellijSessionFor,
} from "../src/config.ts";
import { fixtureConfigText } from "./helpers/config.ts";

const examplePath = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "config.example.toml",
);
const home = "/home/test";

/** The entry config resolves for a local item with no forge presence. */
const entryOf = (config: Config, id: string) =>
  resolveEntry(config, id, [`local:${id}`]).entry;

async function exampleText(): Promise<string> {
  return readFile(examplePath, "utf8");
}

describe("example config", () => {
  it("parses with every path expanded against the home directory", async () => {
    const config = parseConfig(await exampleText(), home);

    expect(config.sources.local).toEqual([
      {
        include: ["/home/test/projects"],
        exclude: ["/home/test/projects/archive"],
      },
    ]);
    expect(config.joins).toEqual([]);
    expect(config.ignore).toEqual([]);
    expect(config.wires).toEqual({
      names: ["Home", "Projects"],
      default: "Projects",
    });
    expect(config.thresholds).toEqual({
      unsafe: { amberHours: 24, redHours: 72 },
      stalled: { amberDays: 7, redDays: 30 },
    });
    expect(config.items).toEqual({});
    expect(config.scan).toEqual({
      intervalMinutes: 15,
      finalisedCommits: 10,
    });
    expect(config.launch).toEqual({
      zellijSession: "main",
      zellijSessions: {},
      commands: {
        zellij: ["zellij"],
        terminal: [
          "alacritty",
          "--working-directory",
          "{cwd}",
          "-e",
          "zellij",
          "attach",
          "-c",
          "{session}",
        ],
        vscode: ["code", "{path}"],
        folder: ["dolphin", "{path}"],
        obsidian: ["xdg-open", "obsidian://open?vault={vault}"],
      },
    });
    expect(config.sources.github).toEqual([
      {
        account: "someone",
        key: "github-someone",
        hosts: ["github.com"],
        trackedForks: [],
      },
    ]);
    expect(config.sources.forgejo).toEqual([
      {
        account: "someone",
        key: "forgejo-someone",
        hosts: ["forge.example.lan"],
        trackedForks: [],
        baseUrl: "https://forge.example.lan",
      },
    ]);
    expect(config.sources.kuma).toEqual([]);
  });

  it("parses its commented kuma source once uncommented", async () => {
    const text = (await exampleText()).replace(
      /^# (\[\[sources\.kuma\]\]|name = |base_url = |status_page = )/gm,
      "$1",
    );

    expect(parseConfig(text, home).sources.kuma).toEqual([
      {
        name: "Server",
        baseUrl: "http://kuma.example.lan:3001",
        statusPage: "status",
      },
    ]);
  });

  it("gives every item the global thresholds when nothing is overridden", async () => {
    const config = parseConfig(await exampleText(), home);

    expect(thresholdsFor(config, entryOf(config, "projects/example"))).toEqual(
      config.thresholds,
    );
  });

  it("shows every entry field in its commented example, and each parses", async () => {
    const text = await exampleText();
    const lines = text.split("\n");
    const start = lines.indexOf('# [items."projects/example"]');
    const block = [];
    for (const line of lines.slice(start)) {
      if (!line.startsWith("# ")) break;
      block.push(line.slice(2));
    }
    const config = parseConfig(`${text}\n${block.join("\n")}\n`, home);

    expect(config.items["projects/example"]).toEqual({
      wire: "Projects",
      name: "Example",
      thresholds: {
        unsafe: { amberHours: 12, redHours: 48 },
        stalled: { amberDays: 14, redDays: 60 },
      },
      keyFiles: ["README.md", "docs/spec.md", "docs/roadmap.md"],
      roadmaps: ["docs/roadmap.md"],
      zellijSession: "main",
    });
  });

  it("names no real account, key or address", async () => {
    const config = parseConfig(await exampleText(), home);
    const forges = [...config.sources.github, ...config.sources.forgejo];

    expect(forges.map((source) => source.account)).toEqual([
      "someone",
      "someone",
    ]);
    expect(await exampleText()).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });
});

describe("item overrides", () => {
  const withOverrides = fixtureConfigText;

  it("apply thresholds to the named item only", async () => {
    const text = await withOverrides(
      '[items.".dotfiles"]\nunsafe_amber_hours = 3\nstalled_red_days = 60\n',
    );
    const config = parseConfig(text, home);

    expect(thresholdsFor(config, entryOf(config, ".dotfiles"))).toEqual({
      unsafe: { amberHours: 3, redHours: 72 },
      stalled: { amberDays: 7, redDays: 60 },
    });
    expect(thresholdsFor(config, entryOf(config, "dev/perch"))).toEqual(
      config.thresholds,
    );
  });

  it("put an adopted item on its wire, the default wire without one, and the rest on the fence", async () => {
    const text = await withOverrides(
      '[items.".dotfiles"]\nwire = "Machine & Home"\n\n[items."dev/perch"]\n',
    );
    const config = parseConfig(text, home);

    expect(wireFor(config, entryOf(config, ".dotfiles"))).toBe(
      "Machine & Home",
    );
    expect(wireFor(config, entryOf(config, "dev/perch"))).toBe("Projects");
    expect(wireFor(config, entryOf(config, "dev/hello"))).toBeNull();
  });

  it("choose the zellij session from the entry, then the longest root, then the default", async () => {
    const text = await withOverrides(
      '[items."undev/spool"]\nzellij_session = "spool"\n\n[launch.zellij_sessions]\n"~/undev" = "undev"\n"~/undev/tools" = "tools"\n',
    );
    const config = parseConfig(text, home);

    expect(
      zellijSessionFor(
        config,
        entryOf(config, "undev/spool"),
        "/home/test/undev/spool",
      ),
    ).toBe("spool");
    expect(
      zellijSessionFor(
        config,
        entryOf(config, "undev/x"),
        "/home/test/undev/tools/x",
      ),
    ).toBe("tools");
    expect(
      zellijSessionFor(
        config,
        entryOf(config, "undev/y"),
        "/home/test/undev/y",
      ),
    ).toBe("undev");
    expect(
      zellijSessionFor(config, entryOf(config, "undevx"), "/home/test/undevx"),
    ).toBe("home");
  });

  it("reject a wire that is not in the wire list", async () => {
    const text = await withOverrides('[items."dev/perch"]\nwire = "Garden"\n');

    expect(() => parseConfig(text, home)).toThrow(/wire must be one of/);
  });

  it("reject an amber window that does not open before red, once merged with the globals", async () => {
    const text = await withOverrides(
      '[items."dev/perch"]\nunsafe_amber_hours = 72\n',
    );

    expect(() => parseConfig(text, home)).toThrow(
      /items."dev\/perch".unsafe amber threshold must be below its red threshold/,
    );
  });

  it("name a key an entry may not hold", async () => {
    const text = await withOverrides('[items."dev/perch"]\ncolour = "red"\n');

    expect(() => parseConfig(text, home)).toThrow(
      'config: items."dev/perch".colour is not a config key',
    );
  });
});

describe("removed keys", () => {
  it("refuses the [importance] table by name", async () => {
    const text = await fixtureConfigText(
      '[importance]\ntiers = ["server", "projects"]\ndefault = "projects"\n',
    );

    expect(() => parseConfig(text, home)).toThrow(
      "config: importance is not a config key",
    );
  });

  it("refuses an entry's importance by name", async () => {
    const text = await fixtureConfigText(
      '[items."dev/perch"]\nimportance = "machine"\n',
    );

    expect(() => parseConfig(text, home)).toThrow(
      'config: items."dev/perch".importance is not a config key',
    );
  });

  it("refuses an entry's expect by name", async () => {
    const text = await fixtureConfigText(
      '[items."dev/perch"]\nexpect = ["ci"]\n',
    );

    expect(() => parseConfig(text, home)).toThrow(
      'config: items."dev/perch".expect is not a config key',
    );
  });

  it("refuses the archived scan interval by name", async () => {
    const text = (await fixtureConfigText("")).replace(
      "[scan]\n",
      "[scan]\narchived_interval_hours = 24\n",
    );

    expect(() => parseConfig(text, home)).toThrow(
      "config: scan.archived_interval_hours is not a config key",
    );
  });

  it("refuses the expectation thresholds by name", async () => {
    const text = await fixtureConfigText("");
    const withKey = (key: string) =>
      text.replace("[thresholds]\n", `[thresholds]\n${key} = 7\n`);

    expect(() => parseConfig(withKey("expectation_amber_days"), home)).toThrow(
      "config: thresholds.expectation_amber_days is not a config key",
    );
    expect(() => parseConfig(withKey("expectation_red_days"), home)).toThrow(
      "config: thresholds.expectation_red_days is not a config key",
    );
  });

  it("refuses an entry's expectation thresholds by name", async () => {
    const text = await fixtureConfigText(
      '[items."dev/perch"]\nexpectation_amber_days = 3\n',
    );

    expect(() => parseConfig(text, home)).toThrow(
      'config: items."dev/perch".expectation_amber_days is not a config key',
    );
  });
});

describe("thresholds", () => {
  it("name a key the [thresholds] table may not hold", async () => {
    const text = (await fixtureConfigText("")).replace(
      "[thresholds]\n",
      "[thresholds]\nstalled_amber_hours = 12\n",
    );

    expect(() => parseConfig(text, home)).toThrow(
      "config: thresholds.stalled_amber_hours is not a config key",
    );
  });
});

describe("sources", () => {
  /** The fixture's scalar tables only, with these source tables. */
  async function withSources(sources: string): Promise<string> {
    const text = await fixtureConfigText("");
    const start = text.indexOf("[[sources.local]]");
    const end = text.indexOf("[thresholds]");
    return `${text.slice(0, start)}${sources}\n${text.slice(end)}`;
  }

  it("parses each kind's tables in order, paths expanded", async () => {
    const config = parseConfig(
      await withSources(`
[[sources.local]]
include = ["~/one"]

[[sources.local]]
include = ["/srv/two"]
exclude = ["/srv/two/old"]

[[sources.github]]
account = "someone"
key = "github-someone"
hosts = ["github.com"]
tracked_forks = ["someone/fork"]

[[sources.forgejo]]
base_url = "https://forge.example.lan"
account = "someone"
key = "forgejo-someone"
hosts = ["forge.example.lan"]

[[sources.kuma]]
name = "Box"
base_url = "http://kuma.example.lan"
status_page = "box"
`),
      home,
    );

    expect(config.sources).toEqual({
      local: [
        { include: ["/home/test/one"], exclude: [] },
        { include: ["/srv/two"], exclude: ["/srv/two/old"] },
      ],
      github: [
        {
          account: "someone",
          key: "github-someone",
          hosts: ["github.com"],
          trackedForks: ["someone/fork"],
        },
      ],
      forgejo: [
        {
          account: "someone",
          key: "forgejo-someone",
          hosts: ["forge.example.lan"],
          trackedForks: [],
          baseUrl: "https://forge.example.lan",
        },
      ],
      kuma: [
        {
          name: "Box",
          baseUrl: "http://kuma.example.lan",
          statusPage: "box",
        },
      ],
    });
  });

  it("reads a config with no sources as declaring none", async () => {
    const config = parseConfig(await withSources(""), home);

    expect(config.sources).toEqual({
      local: [],
      github: [],
      forgejo: [],
      kuma: [],
    });
  });

  it("refuses two github tables for one account, whatever its case", async () => {
    const text = await withSources(`
[[sources.github]]
account = "Someone"
key = "a"
hosts = ["github.com"]

[[sources.github]]
account = "someone"
key = "b"
hosts = ["github-alias"]
`);

    expect(() => parseConfig(text, home)).toThrow(
      "config: two sources.github tables name account someone; each may appear once",
    );
  });

  it("refuses two forgejo tables for one account at one address, and allows it at two", async () => {
    const card = (url: string) =>
      `[[sources.forgejo]]\nbase_url = "${url}"\naccount = "someone"\nkey = "${url}"\nhosts = []\n`;

    const twice = await withSources(
      card("https://a.lan") + card("https://a.lan"),
    );

    expect(() => parseConfig(twice, home)).toThrow(
      "config: two sources.forgejo tables name account someone at https://a.lan; each may appear once",
    );
    expect(
      parseConfig(
        await withSources(card("https://a.lan") + card("https://b.lan")),
        home,
      ).sources.forgejo,
    ).toHaveLength(2);
  });

  it("refuses one keyring key on two tables of one kind", async () => {
    const card = (kind: string, account: string, extra: string) =>
      `[[sources.${kind}]]\naccount = "${account}"\nkey = "shared"\nhosts = []\n${extra}`;

    const forgejo = await withSources(
      card("forgejo", "one", 'base_url = "https://a.lan"\n') +
        card("forgejo", "two", 'base_url = "https://a.lan"\n'),
    );

    const github = await withSources(
      card("github", "one", "") + card("github", "two", ""),
    );

    expect(() => parseConfig(forgejo, home)).toThrow(
      "config: two sources.forgejo tables name keyring key shared; each may appear once",
    );
    expect(() => parseConfig(github, home)).toThrow(
      "config: two sources.github tables name keyring key shared; each may appear once",
    );
  });

  it("refuses two kuma tables with one name", async () => {
    const card =
      '[[sources.kuma]]\nname = "Box"\nbase_url = "http://k.lan"\nstatus_page = "p"\n';

    const text = await withSources(card + card);

    expect(() => parseConfig(text, home)).toThrow(
      "config: two sources.kuma tables name name Box; each may appear once",
    );
  });

  it("names a key a source table may not hold", async () => {
    const text = await withSources(
      '[[sources.local]]\ninclude = ["~/dev"]\nignore = ["~/dev/old"]\n',
    );

    expect(() => parseConfig(text, home)).toThrow(
      "config: sources.local[0].ignore is not a config key",
    );
  });

  it("wants finalised commits under [scan]", async () => {
    const text = (await fixtureConfigText("")).replace(
      "finalised_commits = 10\n",
      "",
    );

    expect(() => parseConfig(text, home)).toThrow(
      "config: scan.finalised_commits must be a positive integer",
    );
  });

  it("refuses the [local], [forges] and [server] tables", async () => {
    for (const table of [
      '[local]\ninclude = ["~/dev"]\nignore = []\n',
      "[forges]\nfinalised_commits = 10\n",
      '[server]\nname = "Silo"\n',
    ]) {
      const text = await fixtureConfigText(table);
      const name = table.slice(1, table.indexOf("]"));

      expect(() => parseConfig(text, home)).toThrow(
        `config: ${name} is not a config key`,
      );
    }
  });
});

describe("launch commands", () => {
  /** The fixture with its launch commands, its last table, replaced. */
  async function withCommands(commands: string): Promise<string> {
    const text = await fixtureConfigText("");
    const start = text.indexOf("[launch.commands]");
    return `${text.slice(0, start)}[launch.commands]\n${commands}\n`;
  }

  it("leave a command out as null", async () => {
    const config = parseConfig(
      await withCommands('folder = ["xdg-open", "{path}"]'),
      home,
    );

    expect(config.launch.commands).toEqual({
      zellij: null,
      terminal: null,
      vscode: null,
      folder: ["xdg-open", "{path}"],
      obsidian: null,
    });
  });

  it("reject a placeholder the command cannot fill", async () => {
    const text = await withCommands('vscode = ["code", "{vault}"]');

    expect(() => parseConfig(text, home)).toThrow(
      "config: launch.commands.vscode has no placeholder {vault}; it may use {path}",
    );
  });

  it("reject a command with no program", async () => {
    const text = await withCommands("folder = []");

    expect(() => parseConfig(text, home)).toThrow(
      "config: launch.commands.folder must name a program",
    );
  });
});

describe("loadConfig", () => {
  it("reads the owner's config, and nothing when there is none", async () => {
    const userPath = "/elsewhere/perch.toml";
    const files = new Map<string, string>();
    const readText = async (path: string) => files.get(path) ?? null;
    const deps = { home, userPath, readText };

    expect(await loadConfig(deps)).toBeNull();

    files.set(userPath, await fixtureConfigText(""));
    const user = await loadConfig(deps);
    expect(user?.path).toBe(userPath);
    expect(user?.config.wires.default).toBe("Projects");
  });

  it("finds the owner's config under ~/.config/perch", () => {
    expect(userConfigPath(home)).toBe("/home/test/.config/perch/config.toml");
  });
});
