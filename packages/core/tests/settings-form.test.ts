import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { type Config, parseConfig } from "../src/config.ts";
import { defaultConfig } from "../src/config-default.ts";
import { writeConfig } from "../src/config-write.ts";
import {
  type LaunchActionValues,
  launchPresets,
  launchProblems,
  presetOf,
  presetTaken,
  withPresetAdded,
} from "../src/launch-form.ts";
import { listLine, parseListLine } from "../src/list-line.ts";
import { mockConfig } from "../src/mock.ts";
import {
  type SettingsValues,
  settingsFormFor,
  settingsProblems,
  wireWarnings,
  withSettings,
} from "../src/settings-form.ts";

const home = "/home/owner";

/** The starter config file the app writes: the default config. */
const starterText = () => writeConfig(defaultConfig(), home);

async function exampleText(): Promise<string> {
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

/** The mock's values with its launch actions replaced. */
const withActions = (actions: LaunchActionValues[]): SettingsValues =>
  changed({ launch: { actions } });

/** The mock's launch actions as the settings page shows them. */
const mockActions = () => mockValues().launch.actions;

/** The mock's zellij action's card, and where it sits. */
function mockZellij() {
  const actions = mockActions();
  const index = actions.findIndex((action) => action.kind === "zellij");
  const action = actions[index];
  if (action?.kind !== "zellij") throw new Error("the mock has no zellij");
  return { actions, index, action };
}

describe("the settings form", () => {
  it("reads config into values and puts them back unchanged", async () => {
    const starter = parseConfig(starterText(), home);
    const example = parseConfig(await exampleText(), home);

    for (const config of [mockConfig, starter, example]) {
      const { values } = settingsFormFor(config, home);
      expect(settingsProblems(values)).toEqual([]);
      expect(withSettings(config, values, home)).toEqual(config);
    }
  });

  it("saves the starter unchanged as the same bytes, and the example as the same TOML document", async () => {
    const save = (text: string) => {
      const config = parseConfig(text, home);
      return writeConfig(
        withSettings(config, settingsFormFor(config, home).values, home),
        home,
      );
    };
    const example = await exampleText();

    expect(save(starterText())).toBe(starterText());
    expect(parse(save(example))).toEqual(parse(example));
  });

  it("shows zellij session roots as typed with ~, and keeps ~ entries added beside them", () => {
    const { actions, index, action } = mockZellij();
    expect(action.sessions).toEqual([{ root: "~/undev", session: "undev" }]);
    const next = withSettings(
      mockConfig,
      withActions(
        actions.with(index, {
          ...action,
          sessions: [...action.sessions, { root: "~/work", session: "work" }],
        }),
      ),
      home,
    );

    const written = writeConfig(next, home);
    expect(written).toContain('"~/work" = "work"');
    expect(
      settingsFormFor(parseConfig(written, home), home).values.launch.actions[
        index
      ],
    ).toMatchObject({
      sessions: [
        { root: "~/undev", session: "undev" },
        { root: "~/work", session: "work" },
      ],
    });
  });

  it("edits finalised commits in the scan group and leaves the sources alone", () => {
    const values = mockValues();
    const next = withSettings(
      mockConfig,
      { ...values, scan: { ...values.scan, finalisedCommits: 4 } },
      home,
    );

    expect(next.scan.finalisedCommits).toBe(4);
    expect(next.sources).toEqual(mockConfig.sources);
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
    const next = withSettings(
      mockConfig,
      withActions([
        {
          kind: "command",
          verb: "Open the folder",
          command: '["dolphin", "--new-window", "{path}", "with a space"]',
        },
      ]),
      home,
    );

    expect(next.launch.actions).toEqual([
      {
        kind: "command",
        verb: "Open the folder",
        command: ["dolphin", "--new-window", "{path}", "with a space"],
      },
    ]);
  });
});

describe("launch actions on the settings page", () => {
  it("shows each action as a card in config order, and saves the cards in their order", () => {
    const actions = mockActions();
    const reversed = [...actions].reverse();

    expect(actions.map((action) => action.verb)).toEqual([
      "Open in Obsidian",
      "Open the zellij tab",
      "Open in VS Code",
      "Open the folder",
    ]);
    expect(
      withSettings(mockConfig, withActions(reversed), home).launch.actions.map(
        (action) => action.verb,
      ),
    ).toEqual([
      "Open the folder",
      "Open in VS Code",
      "Open the zellij tab",
      "Open in Obsidian",
    ]);
  });

  it("removes an action by removing its card, and writes no launch table without any", () => {
    const actions = mockActions().filter(
      (action) => action.verb !== "Open in VS Code",
    );

    const fewer = withSettings(mockConfig, withActions(actions), home);
    const none = withSettings(mockConfig, withActions([]), home);

    expect(fewer.launch.actions.map((action) => action.verb)).toEqual([
      "Open in Obsidian",
      "Open the zellij tab",
      "Open the folder",
    ]);
    expect(writeConfig(none, home)).not.toContain("launch");
  });

  it("offers the presets filled in, as the round drew them", () => {
    expect(
      launchPresets.map(({ name, needs, values }) => [
        name,
        needs,
        values.verb,
        values.kind === "command" ? values.command : values.terminal,
      ]),
    ).toEqual([
      ["VS Code", "filled in", "Open in VS Code", '["code", "{path}"]'],
      [
        "zellij tab",
        "filled in · once",
        "Open the zellij tab",
        '["alacritty", "--working-directory", "{cwd}", "-e", "zellij", "attach", "-c", "{session}"]',
      ],
      [
        "nvim",
        "filled in",
        "Open in nvim",
        '["alacritty", "--working-directory", "{path}", "-e", "nvim", "."]',
      ],
      ["Folder", "filled in", "Open the folder", '["xdg-open", "{path}"]'],
      [
        "Obsidian",
        "Obsidian only",
        "Open in Obsidian",
        '["xdg-open", "obsidian://open?vault={obsidian}"]',
      ],
      ["Custom command", "you write it", "", ""],
    ]);
    expect(launchPresets[1]?.values).toMatchObject({
      zellij: '["zellij"]',
      session: "main",
      sessions: [],
    });
  });

  it("adds a preset's card at the end, filled in, each a copy, and every preset but the custom one saves as added", () => {
    const zellij = launchPresets[1];
    if (zellij === undefined) throw new Error("no zellij preset");

    const [first, second] = withPresetAdded(
      withPresetAdded([], zellij),
      zellij,
    );
    if (first?.kind !== "zellij") throw new Error("not added");
    first.sessions.push({ root: "~", session: "x" });

    expect(second).toEqual(zellij.values);
    expect(zellij.values).toMatchObject({ sessions: [] });
    for (const preset of launchPresets.slice(0, -1)) {
      expect(launchProblems([preset.values]), preset.name).toEqual([]);
    }
  });

  it("names a card by the preset running its command, zellij's for the zellij action, and custom otherwise", () => {
    const names = mockActions().map((action) => presetOf(action).name);
    const edited = presetOf({
      kind: "command",
      verb: "Code it",
      command: '[ "code","{path}" ]',
    });

    expect(names).toEqual([
      "Obsidian",
      "zellij tab",
      "VS Code",
      "Custom command",
    ]);
    expect(edited.name).toBe("VS Code");
  });

  it("holds the zellij preset back once a zellij action exists, and no other", () => {
    const actions = mockActions();
    const withoutZellij = actions.filter((action) => action.kind !== "zellij");

    expect(
      launchPresets
        .filter((preset) => presetTaken(actions, preset))
        .map((preset) => preset.name),
    ).toEqual(["zellij tab"]);
    expect(
      launchPresets.filter((preset) => presetTaken(withoutZellij, preset)),
    ).toEqual([]);
  });

  it("refuses a blank verb, a command not naming a program first, and a placeholder the action may not use", () => {
    const { action: zellij } = mockZellij();
    const problems = settingsProblems(
      withActions([
        { kind: "command", verb: " ", command: '["code", "{path}"]' },
        {
          kind: "command",
          verb: "Open the logs",
          command: '["", "lnav", "{path}/logs"]',
        },
        {
          kind: "command",
          verb: "Open the worktree",
          command: '["code", "{worktree}"]',
        },
        { kind: "command", verb: "Run", command: "" },
        { kind: "command", verb: "Run", command: "code {path}" },
        {
          ...zellij,
          zellij: '["zellij", "{session}"]',
          terminal: '["kitty", "{path}"]',
        },
      ]),
    );

    expect(problems).toEqual([
      "Launch action 1, action: needs words for the bird's page",
      "Launch action 2, command: must name a program first",
      "Launch action 3, command: has no placeholder {worktree}; it may use {path} and {obsidian}",
      "Launch action 4, command: needs a command",
      'Launch action 5, command: must be a list in brackets of strings in double quotes, such as ["code", "{path}"]',
      "Launch action 6, zellij command: has no placeholder {session}; it may use none",
      "Launch action 6, terminal command: has no placeholder {path}; it may use {session} and {cwd}",
    ]);
  });

  it("refuses a second zellij action, as the config parser does", () => {
    const { action } = mockZellij();

    expect(launchProblems([action, action])).toEqual([
      {
        index: 1,
        field: "zellij",
        problem: "a second zellij action; there may be one",
      },
    ]);
  });
});

describe("what the settings cannot be", () => {
  it("holds the thresholds to the adoption papers' rule", () => {
    const values = mockValues();

    expect(
      settingsProblems({
        ...values,
        thresholds: {
          ...values.thresholds,
          unsafe_amber_hours: 0,
          stalled_red_days: 1.5,
        },
      }),
    ).toEqual([
      "Unsafe work: thresholds must be whole hours above zero",
      "Stalled flight: thresholds must be whole days above zero",
    ]);
  });

  it("wants wires named, each name once, the default among them", () => {
    expect(
      settingsProblems(
        changed({
          wires: {
            rows: [
              { from: "Projects", name: "Projects" },
              { from: null, name: " " },
              { from: null, name: "Projects" },
            ],
            defaultRow: 3,
          },
        }),
      ),
    ).toEqual([
      "Wires: every wire needs a name",
      "Wires: two wires are named Projects; each name may appear once",
      "Wires: the default wire must be one of the wires",
    ]);
    expect(
      settingsProblems(changed({ wires: { rows: [], defaultRow: 0 } })),
    ).toEqual([
      "Wires: name at least one wire",
      "Wires: the default wire must be one of the wires",
    ]);
  });

  it("refuses an empty name, even on a renamed wire", () => {
    expect(
      settingsProblems(
        changed({
          wires: {
            rows: [
              { from: "Machine & Home", name: "" },
              { from: "Projects", name: "Projects" },
            ],
            defaultRow: 1,
          },
        }),
      ),
    ).toEqual(["Wires: every wire needs a name"]);
  });

  it("refuses two rows starting as one wire", () => {
    expect(
      settingsProblems(
        changed({
          wires: {
            rows: [
              { from: "Projects", name: "Projects" },
              { from: "Projects", name: "Work" },
            ],
            defaultRow: 1,
          },
        }),
      ),
    ).toEqual(["Wires: two wires both start as Projects"]);
  });

  it("wants whole intervals and counts above zero", () => {
    const values = mockValues();

    expect(
      settingsProblems({
        ...values,
        scan: {
          intervalMinutes: 0,
          finalisedCommits: 2.5,
        },
      }),
    ).toEqual([
      "Scan interval: must be whole minutes above zero",
      "Finalised commits: must be a whole number above zero",
    ]);
  });

  it("wants zellij sessions and joins filled in", () => {
    const { actions, index, action } = mockZellij();
    const unnamed = (sessions: typeof action.sessions) =>
      launchProblems(
        actions.with(index, { ...action, session: "", sessions }),
      ).map((problem) => problem.problem);

    expect(unnamed([{ root: "undev", session: "undev" }])).toEqual([
      "needs a session name",
      "each root must start with / or ~",
    ]);
    expect(unnamed([{ root: "~/undev", session: "" }])).toEqual([
      "needs a session name",
      "every root needs a session name",
    ]);
    expect(
      unnamed([
        { root: "~/undev", session: "a" },
        { root: "~/undev", session: "b" },
      ]),
    ).toEqual(["needs a session name", "each root once"]);
    expect(
      settingsProblems({
        ...mockValues(),
        joins: ['["github:finch/notes"]', "github:a/b forgejo:a/b"],
        ignore: [""],
      }),
    ).toEqual([
      "Joins: each join names two references or more",
      'Joins: each join must be a list in brackets of strings in double quotes, such as ["code", "{path}"]',
      "Ignored presences: a reference cannot be empty",
    ]);
  });

  it("refuses to make a config from values with problems", () => {
    expect(() =>
      withSettings(
        mockConfig,
        changed({
          scan: {
            intervalMinutes: 0,
            finalisedCommits: 10,
          },
        }),
        home,
      ),
    ).toThrow("Scan interval: must be whole minutes above zero");
  });
});

/** The mock config with Perch's entry naming Projects, so both wires have an entry naming them. */
const bothNamed: Config = {
  ...mockConfig,
  items: Object.fromEntries(
    Object.entries(mockConfig.items).map(([key, entry]) => [
      key,
      key === "dev/perch" ? { ...entry, wire: "Projects" } : entry,
    ]),
  ),
};

/** The values for a config with its wires set to rows and a default. */
const wiresOf = (
  config: Config,
  rows: SettingsValues["wires"]["rows"],
  defaultRow: number,
): SettingsValues => ({
  ...settingsFormFor(config, home).values,
  wires: { rows, defaultRow },
});

/** Each entry key and the wire it names, null for the default. */
const wiresByEntry = (config: Config) =>
  Object.fromEntries(
    Object.entries(config.items).map(([key, entry]) => [key, entry.wire]),
  );

const homeEntries = [".dotfiles", "obsidian/Hothouse", "obsidian/Pocket"];

/** The saved config, read back from the bytes written, so the writer agrees. */
function saved(config: Config, values: SettingsValues): Config {
  expect(settingsProblems(values)).toEqual([]);
  const next = withSettings(config, values, home);
  expect(parseConfig(writeConfig(next, home), home)).toEqual(next);
  return next;
}

describe("renaming, removing and adding wires", () => {
  it("names the entries on each wire", () => {
    const { named } = settingsFormFor(mockConfig, home);

    expect(named).toEqual({ wires: { "Machine & Home": homeEntries } });
  });

  it("starts each row as the config wire it is", () => {
    expect(settingsFormFor(mockConfig, home).values.wires).toEqual({
      rows: [
        { from: "Machine & Home", name: "Machine & Home" },
        { from: "Projects", name: "Projects" },
      ],
      defaultRow: 1,
    });
  });

  it("carries a renamed wire's entries to the new name and keeps the order", () => {
    const values = wiresOf(
      mockConfig,
      [
        { from: "Machine & Home", name: "Home" },
        { from: "Projects", name: "Projects" },
      ],
      1,
    );

    expect(
      wireWarnings(settingsFormFor(mockConfig, home).named.wires, values.wires),
    ).toEqual([]);
    const next = saved(mockConfig, values);

    expect(next.wires).toEqual({
      names: ["Home", "Projects"],
      default: "Projects",
    });
    for (const key of homeEntries) expect(next.items[key]?.wire).toBe("Home");
    expect(next.items["undev/spool"]?.wire).toBeNull();
    expect(next.items[".dotfiles"]?.name).toBe("Dotfiles");
  });

  it("keeps a renamed default the default, its entries following", () => {
    const next = saved(
      bothNamed,
      wiresOf(
        bothNamed,
        [
          { from: "Machine & Home", name: "Machine & Home" },
          { from: "Projects", name: "Work" },
        ],
        1,
      ),
    );

    expect(next.wires).toEqual({
      names: ["Machine & Home", "Work"],
      default: "Work",
    });
    expect(next.items["dev/perch"]?.wire).toBe("Work");
    expect(next.items["undev/spool"]?.wire).toBeNull();
  });

  it("swaps two wires' entries when their names are swapped, the default staying with its row", () => {
    const next = saved(
      bothNamed,
      wiresOf(
        bothNamed,
        [
          { from: "Machine & Home", name: "Projects" },
          { from: "Projects", name: "Machine & Home" },
        ],
        1,
      ),
    );

    expect(next.wires).toEqual({
      names: ["Projects", "Machine & Home"],
      default: "Machine & Home",
    });
    for (const key of homeEntries)
      expect(next.items[key]?.wire).toBe("Projects");
    expect(next.items["dev/perch"]?.wire).toBe("Machine & Home");
    expect(next.items["undev/spool"]?.wire).toBeNull();
  });

  it("moves a removed wire's entries to the default, warning first", () => {
    const form = settingsFormFor(mockConfig, home);
    const values = wiresOf(
      mockConfig,
      [{ from: "Projects", name: "Projects" }],
      0,
    );

    expect(wireWarnings(form.named.wires, values.wires)).toEqual([
      ".dotfiles, obsidian/Hothouse and obsidian/Pocket sit on Machine & Home, which is removed: saving moves them to the default wire, Projects.",
    ]);
    expect(wireWarnings(form.named.wires, form.values.wires)).toEqual([]);
    const next = saved(mockConfig, values);

    expect(next.wires.names).toEqual(["Projects"]);
    for (const key of homeEntries) expect(next.items[key]?.wire).toBeNull();
    expect(next.items["obsidian/Pocket"]?.roadmaps).toEqual(
      mockConfig.items["obsidian/Pocket"]?.roadmaps,
    );
  });

  it("removes a wire no entry names without touching any entry", () => {
    const values = wiresOf(
      mockConfig,
      [
        { from: "Machine & Home", name: "Machine & Home" },
        { from: "Projects", name: "Projects" },
        { from: null, name: "Someday" },
      ],
      1,
    );
    const withSomeday = saved(mockConfig, values);
    const form = settingsFormFor(withSomeday, home);
    const removed = {
      ...form.values,
      wires: { ...form.values.wires, rows: form.values.wires.rows.slice(0, 2) },
    };

    expect(wireWarnings(form.named.wires, removed.wires)).toEqual([]);
    expect(saved(withSomeday, removed)).toEqual(mockConfig);
  });

  it("adds a wire, which may be the default, its entries unmoved", () => {
    const next = saved(
      mockConfig,
      wiresOf(
        mockConfig,
        [
          { from: "Machine & Home", name: "Machine & Home" },
          { from: null, name: "Someday" },
          { from: "Projects", name: "Projects" },
        ],
        1,
      ),
    );

    expect(next.wires).toEqual({
      names: ["Machine & Home", "Someday", "Projects"],
      default: "Someday",
    });
    expect(wiresByEntry(next)).toEqual(wiresByEntry(mockConfig));
  });

  it("reorders wires, every entry staying on its wire", () => {
    const next = saved(
      bothNamed,
      wiresOf(
        bothNamed,
        [
          { from: "Projects", name: "Projects" },
          { from: "Machine & Home", name: "Machine & Home" },
        ],
        0,
      ),
    );

    expect(next.wires.names).toEqual(["Projects", "Machine & Home"]);
    expect(wiresByEntry(next)).toEqual(wiresByEntry(bothNamed));
  });

  it("treats a row whose wire the config no longer holds as one added", () => {
    const values = wiresOf(
      mockConfig,
      [
        { from: "Machine & Home", name: "Machine & Home" },
        { from: "Projects", name: "Projects" },
        { from: "Someday", name: "Later" },
      ],
      1,
    );

    const next = saved(mockConfig, values);

    expect(next.wires.names).toEqual(["Machine & Home", "Projects", "Later"]);
    expect(wiresByEntry(next)).toEqual(wiresByEntry(mockConfig));
  });

  it("leaves an added row named as a removed wire an add: the removed wire's entries still move", () => {
    const next = saved(
      mockConfig,
      wiresOf(
        mockConfig,
        [
          { from: null, name: "Machine & Home" },
          { from: "Projects", name: "Projects" },
        ],
        1,
      ),
    );

    for (const key of homeEntries) expect(next.items[key]?.wire).toBeNull();
  });
});
