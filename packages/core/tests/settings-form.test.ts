import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { type Config, parseConfig } from "../src/config.ts";
import { writeConfig } from "../src/config-write.ts";
import { mockConfig } from "../src/mock.ts";
import {
  listLine,
  parseListLine,
  type SettingsValues,
  settingsFormFor,
  settingsProblems,
  settingsWarnings,
  withSettings,
} from "../src/settings-form.ts";

const home = "/home/owner";

async function starterText(): Promise<string> {
  return readFile(
    join(import.meta.dirname, "..", "..", "..", "config.example.toml"),
    "utf8",
  );
}

const mockValues = () => settingsFormFor(mockConfig, home).values;

/** The mock's values with a change; the change replaces whole groups. */
const changed = (change: Partial<SettingsValues>): SettingsValues => ({
  ...mockValues(),
  ...change,
});

describe("the settings form", () => {
  it("reads config into values and puts them back unchanged", async () => {
    const starter = parseConfig(await starterText(), home);

    for (const config of [mockConfig, starter]) {
      const { values } = settingsFormFor(config, home);
      expect(settingsProblems(values)).toEqual([]);
      expect(withSettings(config, values, home)).toEqual(config);
    }
  });

  it("saves the starter unchanged as the same TOML document", async () => {
    const text = await starterText();
    const config = parseConfig(text, home);

    const saved = writeConfig(
      withSettings(config, settingsFormFor(config, home).values, home),
      home,
    );

    expect(parse(saved)).toEqual(parse(text));
  });

  it("shows include paths as typed with ~, and keeps ~ entries added beside them", async () => {
    const config = parseConfig(await starterText(), home);
    const { values } = settingsFormFor(config, home);

    expect(values.local.include).toEqual(["~/dev", "~/.dotfiles"]);
    const next = withSettings(
      config,
      {
        ...values,
        local: {
          ...values.local,
          include: [
            ...values.local.include,
            "~/undev",
            "~/obsidian/Hothouse",
            "~/obsidian/Pocket",
          ],
        },
      },
      home,
    );

    expect(next.local.include).toEqual([
      `${home}/dev`,
      `${home}/.dotfiles`,
      `${home}/undev`,
      `${home}/obsidian/Hothouse`,
      `${home}/obsidian/Pocket`,
    ]);
    const written = writeConfig(next, home);
    expect(written).toContain(
      'include = [ "~/dev", "~/.dotfiles", "~/undev", "~/obsidian/Hothouse", "~/obsidian/Pocket" ]',
    );
    expect(
      settingsFormFor(parseConfig(written, home), home).values.local,
    ).toEqual({
      include: [
        "~/dev",
        "~/.dotfiles",
        "~/undev",
        "~/obsidian/Hothouse",
        "~/obsidian/Pocket",
      ],
      ignore: values.local.ignore,
    });
  });

  it("refuses a path that is neither absolute nor under ~", () => {
    expect(
      settingsProblems(
        changed({ local: { include: ["undev"], ignore: ["./archived"] } }),
      ),
    ).toEqual([
      "Include paths: each must start with / or ~",
      "Ignore paths: each must start with / or ~",
    ]);
  });
});

describe("launch commands as list lines", () => {
  it("shows a command in the config file's own quoting, and reads it back", () => {
    const argv = [
      "konsole",
      "--title",
      'perch "{session}"',
      "-e",
      "a\\b",
      "{session}",
    ];

    const line = listLine(argv);

    expect(line).toBe(
      '["konsole", "--title", "perch \\"{session}\\"", "-e", "a\\\\b", "{session}"]',
    );
    expect(parseListLine(line)).toEqual({ list: argv });
  });

  it("keeps an argument with spaces whole, never splitting on spaces", () => {
    const values = mockValues();
    const next = withSettings(
      mockConfig,
      {
        ...values,
        launch: {
          ...values.launch,
          commands: {
            ...values.launch.commands,
            folder: '["dolphin", "--new-window", "{path}", "with a space"]',
          },
        },
      },
      home,
    );

    expect(next.launch.commands.folder).toEqual([
      "dolphin",
      "--new-window",
      "{path}",
      "with a space",
    ]);
  });

  it("removes the action of a command emptied", () => {
    const values = mockValues();
    const next = withSettings(
      mockConfig,
      {
        ...values,
        launch: {
          ...values.launch,
          commands: { ...values.launch.commands, vscode: "  " },
        },
      },
      home,
    );

    expect(next.launch.commands.vscode).toBeNull();
    expect(writeConfig(next, home)).not.toContain("vscode");
  });

  it("names each malformed command", () => {
    const values = mockValues();
    const problems = settingsProblems({
      ...values,
      launch: {
        ...values.launch,
        commands: {
          zellij: "zellij",
          terminal: '["alacritty", 3]',
          vscode: "[]",
          folder: '["dolphin", "{cwd}"]',
          obsidian: "['xdg-open']",
        },
      },
    });

    expect(problems).toEqual([
      'Launch command zellij: must be a list in brackets of strings in double quotes, such as ["code", "{path}"]',
      'Launch command terminal: must be a list in brackets of strings in double quotes, such as ["code", "{path}"]',
      "Launch command vscode: must name a program first; empty the field to remove the action",
      "Launch command folder: has no placeholder {cwd}; it may use {path}",
      'Launch command obsidian: must be a list in brackets of strings in double quotes, such as ["code", "{path}"]',
    ]);
  });
});

describe("what the settings cannot be", () => {
  it("holds the thresholds to the entry forms' rule", () => {
    const values = mockValues();

    expect(
      settingsProblems({
        ...values,
        thresholds: {
          ...values.thresholds,
          unsafe_amber_hours: 0,
          stalled_amber_days: 40,
          expectation_red_days: 1.5,
        },
      }),
    ).toEqual([
      "Unsafe work: thresholds must be whole hours above zero",
      "Stalled flight: amber must come before red",
      "Unmet expectation: thresholds must be whole days above zero",
    ]);
  });

  it("wants wires and tiers named, each once, the default among them", () => {
    expect(
      settingsProblems(
        changed({
          wires: { names: ["Projects", " ", "Projects"], default: "Someday" },
          importance: { tiers: [], default: "projects" },
        }),
      ),
    ).toEqual([
      "Wires: every wire needs a name",
      "Wires: each wire once",
      "Wires: the default wire must be one of the wires",
      "Importance: name at least one tier",
      "Importance: the default tier must be one of the tiers",
    ]);
  });

  it("wants whole intervals and counts above zero", () => {
    const values = mockValues();

    expect(
      settingsProblems({
        ...values,
        scan: { intervalMinutes: 0, archivedIntervalHours: Number.NaN },
        forges: { ...values.forges, finalisedCommits: 2.5 },
      }),
    ).toEqual([
      "Scan interval: must be whole minutes above zero",
      "Archived scan interval: must be whole hours above zero",
      "Finalised commits: must be a whole number above zero",
    ]);
  });

  it("wants zellij sessions, forge accounts, joins and a server filled in", () => {
    const values = mockValues();

    expect(
      settingsProblems({
        ...values,
        launch: {
          ...values.launch,
          zellijSession: "",
          zellijSessions: [
            { root: "undev", session: "" },
            { root: "undev", session: "undev" },
          ],
        },
        forges: {
          ...values.forges,
          github: {
            ...values.forges.github,
            accounts: [{ account: "finch", key: "" }],
            trackedForks: ["someone"],
          },
          forgejo: { ...values.forges.forgejo, hosts: [""], baseUrl: "" },
        },
        server: { name: "Silo", kumaBaseUrl: "", kumaStatusPage: "perch" },
        joins: ['["github:finch/notes"]', "github:a/b forgejo:a/b"],
        ignore: [""],
      }),
    ).toEqual([
      "Launch: the zellij session needs a name",
      "Zellij sessions: each root must start with / or ~",
      "Zellij sessions: every root needs a session name",
      "Zellij sessions: each root once",
      "GitHub: every account needs a name and a keyring key",
      "GitHub: tracked forks are written owner/name",
      "Forgejo: every host needs a name",
      "Forgejo: the address cannot be empty",
      "Server: the name, the Uptime Kuma address and the status page each need a value",
      "Joins: each join names two references or more",
      'Joins: each join must be a list in brackets of strings in double quotes, such as ["code", "{path}"]',
      "Ignored presences: a reference cannot be empty",
    ]);
  });

  it("refuses to make a config from values with problems", () => {
    expect(() =>
      withSettings(
        mockConfig,
        changed({ scan: { intervalMinutes: 0, archivedIntervalHours: 24 } }),
        home,
      ),
    ).toThrow("Scan interval: must be whole minutes above zero");
  });
});

describe("removing a wire or tier entries name", () => {
  it("names the entries on each wire and tier", () => {
    const { named } = settingsFormFor(mockConfig, home);

    expect(named.wires).toEqual({
      "Machine & Home": [
        ".dotfiles",
        "obsidian/Hothouse",
        "obsidian/Pocket",
      ],
    });
    expect(named.tiers).toEqual({
      machine: [".dotfiles", "obsidian/Hothouse"],
    });
  });

  it("warns before saving, then moves those entries to the defaults", () => {
    const form = settingsFormFor(mockConfig, home);
    const values: SettingsValues = {
      ...form.values,
      wires: { names: ["Projects"], default: "Projects" },
      importance: { tiers: ["server", "projects"], default: "projects" },
    };

    expect(settingsProblems(values)).toEqual([]);
    expect(settingsWarnings(form.named, values)).toEqual([
      ".dotfiles, obsidian/Hothouse and obsidian/Pocket sit on Machine & Home, which is removed: saving moves them to the default wire, Projects.",
      ".dotfiles and obsidian/Hothouse have importance machine, which is removed: saving gives them the default tier, projects.",
    ]);
    expect(settingsWarnings(form.named, form.values)).toEqual([]);

    const next = withSettings(mockConfig, values, home);

    expect(next.items[".dotfiles"]).toMatchObject({
      wire: null,
      importance: null,
      name: "Dotfiles",
    });
    expect(next.items["obsidian/Pocket"]?.roadmaps).toEqual(
      mockConfig.items["obsidian/Pocket"]?.roadmaps,
    );
    expect(parseConfig(writeConfig(next, home), home)).toEqual(next);
  });
});

describe("the server", () => {
  it("turns monitoring off, leaving the [server] section out", () => {
    const next = withSettings(mockConfig, changed({ server: null }), home);

    expect(next.server).toBeNull();
    expect(writeConfig(next, home)).not.toContain("[server]");
  });

  it("turns monitoring on with its three fields", () => {
    const off: Config = { ...mockConfig, server: null };
    const server = {
      name: "Silo",
      kumaBaseUrl: "http://kuma.invalid:3001",
      kumaStatusPage: "perch",
    };

    expect(settingsFormFor(off, home).values.server).toBeNull();
    const next = withSettings(
      off,
      { ...settingsFormFor(off, home).values, server },
      home,
    );

    expect(next.server).toEqual(server);
    expect(parseConfig(writeConfig(next, home), home).server).toEqual(server);
  });
});
