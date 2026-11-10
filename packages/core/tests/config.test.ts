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
  zellijActionOf,
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
    expect(config.launch.actions).toEqual([
      {
        kind: "zellij",
        verb: "Open the zellij tab",
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
        session: "main",
        sessions: { "/home/test/work": "work" },
      },
      { kind: "vscode", verb: "Open in VS Code", command: ["code", "{path}"] },
      {
        kind: "nvim",
        verb: "Open in nvim",
        command: [
          "alacritty",
          "--working-directory",
          "{path}",
          "-e",
          "nvim",
          ".",
        ],
      },
      {
        kind: "folder",
        verb: "Open the folder",
        command: ["xdg-open", "{path}"],
      },
    ]);
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
    expect(config.window).toEqual({ tray: true });
  });

  it("parses its commented window table once uncommented", async () => {
    const text = (await exampleText()).replace(
      /^# (\[window\]|tray = )/gm,
      "$1",
    );

    expect(parseConfig(text, home).window).toEqual({ tray: false });
  });

  it("parses its commented update table once uncommented", async () => {
    const text = (await exampleText()).replace(
      /^# (\[update\]|check = |install = )/gm,
      "$1",
    );

    expect(parseConfig(text, home).update).toEqual({
      check: false,
      install: true,
    });
  });

  it("parses its commented kuma source once uncommented", async () => {
    const text = (await exampleText()).replace(
      /^# (\[\[sources\.kuma\]\]|name = "Server"|base_url = |status_page = )/gm,
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

  it("parses its commented Obsidian and custom actions once uncommented, last on the bird", async () => {
    const text = (await exampleText()).replace(
      /^# (\[\[launch\.actions\]\]|kind = |verb = |command = |icon = )/gm,
      "$1",
    );

    expect(parseConfig(text, home).launch.actions.slice(-2)).toEqual([
      {
        kind: "obsidian",
        verb: "Open the Obsidian vault",
        command: ["obsidian", "obsidian://open?vault={obsidian}"],
      },
      {
        kind: "command",
        verb: "Follow the log",
        command: ["alacritty", "-e", "lnav", "{path}/logs"],
        icon: "terminal",
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

  it("choose the zellij session from the entry, then the action's longest root, then its default", async () => {
    const text = await withOverrides(
      '[items."undev/spool"]\nzellij_session = "spool"\n',
    );
    const config = parseConfig(text, home);
    const zellij = zellijActionOf(config);
    if (zellij === null) throw new Error("the fixture has no zellij action");
    const action = {
      ...zellij,
      sessions: {
        "/home/test/undev": "undev",
        "/home/test/undev/tools": "tools",
      },
    };

    expect(
      zellijSessionFor(
        action,
        entryOf(config, "undev/spool"),
        "/home/test/undev/spool",
      ),
    ).toBe("spool");
    expect(
      zellijSessionFor(
        action,
        entryOf(config, "undev/x"),
        "/home/test/undev/tools/x",
      ),
    ).toBe("tools");
    expect(
      zellijSessionFor(
        action,
        entryOf(config, "undev/y"),
        "/home/test/undev/y",
      ),
    ).toBe("undev");
    expect(
      zellijSessionFor(action, entryOf(config, "undevx"), "/home/test/undevx"),
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

describe("the window", () => {
  it("stays in the tray without a [window] table, and leaves it when tray is false", async () => {
    const absent = parseConfig(await fixtureConfigText(""), home);
    const off = parseConfig(
      await fixtureConfigText("[window]\ntray = false\n"),
      home,
    );

    expect(absent.window).toEqual({ tray: true });
    expect(off.window).toEqual({ tray: false });
  });

  it("names a key the [window] table may not hold, and wants tray true or false", async () => {
    const stray = await fixtureConfigText("[window]\nhidden = true\n");
    const word = await fixtureConfigText('[window]\ntray = "no"\n');

    expect(() => parseConfig(stray, home)).toThrow(
      "config: window.hidden is not a config key",
    );
    expect(() => parseConfig(word, home)).toThrow(
      "config: window.tray must be true or false",
    );
  });
});

describe("the update table", () => {
  it("checks and does not install without an [update] table", async () => {
    const absent = parseConfig(await fixtureConfigText(""), home);

    expect(absent.update).toEqual({ check: true, install: false });
  });

  it("reads check and install from an [update] table", async () => {
    const both = parseConfig(
      await fixtureConfigText("[update]\ncheck = false\ninstall = true\n"),
      home,
    );
    const one = parseConfig(
      await fixtureConfigText("[update]\ninstall = true\n"),
      home,
    );

    expect(both.update).toEqual({ check: false, install: true });
    expect(one.update).toEqual({ check: true, install: true });
  });

  it("names a key the [update] table may not hold, and wants each switch true or false", async () => {
    const stray = await fixtureConfigText('[update]\nchannel = "beta"\n');
    const word = await fixtureConfigText('[update]\ninstall = "yes"\n');

    expect(() => parseConfig(stray, home)).toThrow(
      "config: update.channel is not a config key",
    );
    expect(() => parseConfig(word, home)).toThrow(
      "config: update.install must be true or false",
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

/** The fixture config's text, its launch actions the last tables. */
const fixture = await fixtureConfigText("");

/** The fixture with its launch actions replaced. */
const withActions = (actions: string) =>
  `${fixture.slice(0, fixture.indexOf("[[launch.actions]]"))}${actions}\n`;

describe("launch actions", () => {
  it("read in order, a kind alone taking every default, and only what differs overriding them", () => {
    const config = parseConfig(
      withActions(
        '[[launch.actions]]\nkind = "folder"\n\n[[launch.actions]]\nkind = "zellij"\nterminal = ["kitty", "{cwd}", "{session}"]\n[launch.actions.sessions]\n"~/work" = "work"\n\n[[launch.actions]]\nkind = "nvim"\nverb = "Edit it"\n\n[[launch.actions]]\nkind = "folder"\ncommand = ["dolphin", "{path}"]',
      ),
      home,
    );

    expect(config.launch.actions).toEqual([
      {
        kind: "folder",
        verb: "Open the folder",
        command: ["xdg-open", "{path}"],
      },
      {
        kind: "zellij",
        verb: "Open the zellij tab",
        zellij: ["zellij"],
        terminal: ["kitty", "{cwd}", "{session}"],
        session: "main",
        sessions: { "/home/test/work": "work" },
      },
      {
        kind: "nvim",
        verb: "Edit it",
        command: [
          "alacritty",
          "--working-directory",
          "{path}",
          "-e",
          "nvim",
          ".",
        ],
      },
      {
        kind: "folder",
        verb: "Open the folder",
        command: ["dolphin", "{path}"],
      },
    ]);
  });

  it("read a custom command's verb, command and icon, the folder unless named", () => {
    const config = parseConfig(
      withActions(
        '[[launch.actions]]\nkind = "command"\nverb = "Follow the log"\ncommand = ["lnav", "{path}"]\nicon = "terminal"\n\n[[launch.actions]]\nkind = "command"\nverb = "Note it"\ncommand = ["notify-send", "{obsidian}"]',
      ),
      home,
    );

    expect(config.launch.actions).toEqual([
      {
        kind: "command",
        verb: "Follow the log",
        command: ["lnav", "{path}"],
        icon: "terminal",
      },
      {
        kind: "command",
        verb: "Note it",
        command: ["notify-send", "{obsidian}"],
        icon: "folder",
      },
    ]);
  });

  it("are none when config holds no launch table", () => {
    expect(parseConfig(withActions(""), home).launch).toEqual({
      actions: [],
    });
  });

  it("refuse a placeholder the kind may not use", () => {
    const cases: [string, string][] = [
      [
        '[[launch.actions]]\nkind = "vscode"\ncommand = ["code", "{obsidian}"]',
        "config: launch.actions[0].command has no placeholder {obsidian}; it may use {path}",
      ],
      [
        '[[launch.actions]]\nkind = "obsidian"\ncommand = ["code", "{worktree}"]',
        "config: launch.actions[0].command has no placeholder {worktree}; it may use {path} and {obsidian}",
      ],
      [
        '[[launch.actions]]\nkind = "command"\nverb = "Open"\ncommand = ["code", "{worktree}"]',
        "config: launch.actions[0].command has no placeholder {worktree}; it may use {path} and {obsidian}",
      ],
      [
        '[[launch.actions]]\nkind = "zellij"\nzellij = ["zellij", "{path}"]',
        "config: launch.actions[0].zellij has no placeholder {path}; it may use none",
      ],
      [
        '[[launch.actions]]\nkind = "zellij"\nterminal = ["kitty", "{path}"]',
        "config: launch.actions[0].terminal has no placeholder {path}; it may use {session} and {cwd}",
      ],
    ];

    for (const [actions, message] of cases) {
      expect(() => parseConfig(withActions(actions), home)).toThrow(message);
    }
  });

  it("refuse a command not naming a program first, a blank verb, and a custom command missing either", () => {
    const cases: [string, string][] = [
      [
        '[[launch.actions]]\nkind = "folder"\ncommand = []',
        "config: launch.actions[0].command must name a program first",
      ],
      [
        '[[launch.actions]]\nkind = "command"\nverb = "Open"\ncommand = ["", "lnav"]',
        "config: launch.actions[0].command must name a program first",
      ],
      [
        '[[launch.actions]]\nkind = "vscode"\nverb = " "',
        "config: launch.actions[0].verb must not be blank",
      ],
      [
        '[[launch.actions]]\nkind = "command"\ncommand = ["code"]',
        "config: launch.actions[0].verb must be a string",
      ],
      [
        '[[launch.actions]]\nkind = "command"\nverb = "Open"',
        "config: launch.actions[0].command must be an array of strings",
      ],
    ];

    for (const [actions, message] of cases) {
      expect(() => parseConfig(withActions(actions), home)).toThrow(message);
    }
  });

  it("refuse a second zellij action, a missing or unknown kind, an unknown icon, and a key the kind does not hold", () => {
    const cases: [string, string][] = [
      [
        '[[launch.actions]]\nkind = "zellij"\n\n[[launch.actions]]\nkind = "zellij"',
        "config: launch.actions holds two zellij actions; there may be one",
      ],
      [
        '[[launch.actions]]\nverb = "Run"\ncommand = ["code"]',
        "config: launch.actions[0].kind must be a string",
      ],
      [
        '[[launch.actions]]\nkind = "shell"',
        "config: launch.actions[0].kind must be one of vscode, zellij, nvim, folder, obsidian, command",
      ],
      [
        '[[launch.actions]]\nkind = "command"\nverb = "Run"\ncommand = ["code"]\nicon = "rocket"',
        "config: launch.actions[0].icon must be one of terminal, code, folder, forge, obsidian, adopt, edit",
      ],
      [
        '[[launch.actions]]\nkind = "vscode"\nicon = "code"',
        "config: launch.actions[0].icon is not a config key",
      ],
      [
        '[[launch.actions]]\nkind = "folder"\nsession = "main"',
        "config: launch.actions[0].session is not a config key",
      ],
    ];

    for (const [actions, message] of cases) {
      expect(() => parseConfig(withActions(actions), home)).toThrow(message);
    }
  });

  it("refuse the old [launch] keys", () => {
    const cases: [string, string][] = [
      ['[launch]\nzellij_session = "main"', "zellij_session"],
      ['[launch.commands]\nvscode = ["code", "{path}"]', "commands"],
    ];

    for (const [old, key] of cases) {
      expect(() => parseConfig(withActions(old), home)).toThrow(
        `config: launch.${key} is not a config key`,
      );
    }
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
