import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { type Config, parseConfig } from "../src/config.ts";
import { defaultConfig } from "../src/config-default.ts";
import { writeConfig } from "../src/config-write.ts";
import {
  cardIcon,
  cardObsidianOnly,
  cardVerb,
  kindTaken,
  type LaunchActionValues,
  launchDefaults,
  launchProblems,
  newCard,
  withKindAdded,
} from "../src/launch-form.ts";
import { launchKinds } from "../src/launch-kinds.ts";
import { listLine, parseListLine } from "../src/list-line.ts";
import { mockConfig, mockLogin } from "../src/mock.ts";
import {
  type LoginEntry,
  loginEntryLine,
  loginSentence,
  type SettingsValues,
  settingsFormFor,
  settingsProblems,
  sourceRunHeld,
  traySentence,
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

const mockValues = () => settingsFormFor(mockConfig, home, mockLogin).values;

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
      const { values } = settingsFormFor(config, home, mockLogin);
      expect(settingsProblems(values)).toEqual([]);
      expect(withSettings(config, values, home)).toEqual(config);
    }
  });

  it("saves the starter unchanged as the same bytes, and the example as the same TOML document", async () => {
    const save = (text: string) => {
      const config = parseConfig(text, home);
      return writeConfig(
        withSettings(
          config,
          settingsFormFor(config, home, mockLogin).values,
          home,
        ),
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
      settingsFormFor(parseConfig(written, home), home, mockLogin).values.launch
        .actions[index],
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

describe("the Window page", () => {
  /** An autostart entry that exists and runs an image under the home directory. */
  const loginOn: LoginEntry = {
    on: true,
    held: null,
    path: `${home}/.config/autostart/perch.desktop`,
    target: `${home}/Applications/perch-0.2.0-x86_64.AppImage`,
  };

  it("reads the tray from config and the login toggle from the entry, paths shown with ~", () => {
    const off = settingsFormFor(mockConfig, home, mockLogin);
    const on = settingsFormFor(
      { ...mockConfig, window: { tray: false } },
      home,
      { ...loginOn, held: sourceRunHeld },
    );

    expect(off.values.window).toEqual({ tray: true, login: false });
    expect(off.login).toEqual({
      held: null,
      path: "~/.config/autostart/perch.desktop",
      target: null,
    });
    expect(on.values.window).toEqual({ tray: false, login: true });
    expect(on.login).toEqual({
      held: sourceRunHeld,
      path: "~/.config/autostart/perch.desktop",
      target: "~/Applications/perch-0.2.0-x86_64.AppImage",
    });
  });

  it("saves the tray to config, written only when off, and leaves the login toggle to the caller", () => {
    const values = mockValues();

    const off = withSettings(
      mockConfig,
      { ...values, window: { tray: false, login: true } },
      home,
    );
    const on = withSettings(
      mockConfig,
      { ...values, window: { tray: true, login: true } },
      home,
    );

    expect(off.window).toEqual({ tray: false });
    expect(parse(writeConfig(off, home)).window).toEqual({ tray: false });
    expect(on).toEqual(mockConfig);
  });

  it("says what the tray does, on and off", () => {
    expect(traySentence(true)).toBe(
      "Closing the window hides it. The tray icon shows it, rescans and quits; clicking the icon toggles the window.",
    );
    expect(traySentence(false)).toBe(
      "Off. No tray icon; closing the window quits perch.",
    );
  });

  it("says what starting at login does, following the tray beside it", () => {
    expect(loginSentence(false, true)).toBe(
      "Off. Turned on, perch starts when you log in, hidden in the tray.",
    );
    expect(loginSentence(true, true)).toBe(
      "perch starts when you log in, hidden in the tray.",
    );
    expect(loginSentence(true, false)).toBe(
      "perch starts when you log in, with the window open.",
    );
    expect(loginSentence(false, false)).toBe(
      "Off. Turned on, perch starts when you log in, with the window open.",
    );
  });

  it("names the entry and the program it runs only while on and the entry exists", () => {
    const on = settingsFormFor(mockConfig, home, loginOn).login;
    const none = settingsFormFor(mockConfig, home, mockLogin).login;

    expect(loginEntryLine(on, true)).toBe(
      "~/.config/autostart/perch.desktop → ~/Applications/perch-0.2.0-x86_64.AppImage",
    );
    expect(loginEntryLine(on, false)).toBeNull();
    expect(loginEntryLine(none, true)).toBeNull();
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
          kind: "folder",
          verb: "",
          command: '["dolphin", "--new-window", "{path}", "with a space"]',
        },
      ]),
      home,
    );

    expect(next.launch.actions).toEqual([
      {
        kind: "folder",
        verb: "Open the folder",
        command: ["dolphin", "--new-window", "{path}", "with a space"],
      },
    ]);
  });
});

describe("launch actions on the settings page", () => {
  it("shows each action as a card of its kind in config order, empty where it holds the kind's default", () => {
    expect(mockActions()).toEqual([
      { kind: "obsidian", verb: "", command: "" },
      {
        kind: "zellij",
        verb: "",
        zellij: "",
        terminal: '["alacritty", "-e", "zellij", "attach", "-c", "{session}"]',
        session: "home",
        sessions: [{ root: "~/undev", session: "undev" }],
      },
      { kind: "vscode", verb: "", command: "" },
      { kind: "folder", verb: "", command: '["dolphin", "{path}"]' },
      { kind: "nvim", verb: "", command: "" },
      {
        kind: "command",
        verb: "Follow the log",
        command: '["alacritty", "-e", "lnav", "{path}/logs"]',
        icon: "terminal",
      },
    ]);
  });

  it("saves the cards in their order, and writes no launch table without any", () => {
    const reversed = [...mockActions()].reverse();

    const next = withSettings(mockConfig, withActions(reversed), home);
    const none = withSettings(mockConfig, withActions([]), home);

    expect(next.launch.actions.map((action) => action.kind)).toEqual([
      "command",
      "nvim",
      "folder",
      "vscode",
      "zellij",
      "obsidian",
    ]);
    expect(writeConfig(none, home)).not.toContain("launch");
  });

  it("adds a kind's card holding just its kind, which saves as the kind alone, and a custom command blank", () => {
    const actions = launchKinds.reduce<LaunchActionValues[]>(
      (cards, kind) => withKindAdded(cards, kind),
      [],
    );
    const saved = withSettings(
      defaultConfig(),
      {
        ...settingsFormFor(defaultConfig(), home, mockLogin).values,
        launch: { actions: actions.slice(0, -1) },
      },
      home,
    );

    expect(actions.at(-1)).toEqual({
      kind: "command",
      verb: "",
      command: "",
      icon: "folder",
    });
    expect(
      (parse(writeConfig(saved, home)).launch as { actions: unknown[] })
        .actions,
    ).toEqual([
      { kind: "vscode" },
      { kind: "zellij" },
      { kind: "nvim" },
      { kind: "folder" },
      { kind: "obsidian" },
    ]);
  });

  it("takes an emptied field back to its kind's default", () => {
    const next = withSettings(
      mockConfig,
      withActions([
        { kind: "folder", verb: " ", command: "" },
        {
          kind: "zellij",
          verb: "",
          zellij: "",
          terminal: "",
          session: "",
          sessions: [],
        },
      ]),
      home,
    );

    expect(next.launch.actions).toEqual([
      {
        kind: "folder",
        verb: "Open the folder",
        command: ["xdg-open", "{path}"],
      },
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
        sessions: {},
      },
    ]);
  });

  it("shows each kind's defaults, which a custom command has none of", () => {
    expect(launchDefaults("vscode")).toMatchObject({
      verb: "Open in VS Code",
      command: '["code", "{path}"]',
    });
    expect(launchDefaults("zellij")).toMatchObject({
      verb: "Open the zellij tab",
      zellij: '["zellij"]',
      session: "main",
    });
    expect(launchDefaults("command")).toEqual({
      verb: "",
      command: "",
      zellij: "",
      terminal: "",
      session: "",
    });
  });

  it("gives a card its own verb and icon, else its kind's, and says which are for Obsidian birds only", () => {
    const actions = [
      ...mockActions(),
      {
        kind: "command" as const,
        verb: "Note it",
        command: '["notify-send", "{obsidian}"]',
        icon: "obsidian" as const,
      },
    ];

    expect(
      actions.map((action) => [
        cardIcon(action),
        cardVerb(action),
        cardObsidianOnly(action),
      ]),
    ).toEqual([
      ["obsidian", "Open in Obsidian", true],
      ["terminal", "Open the zellij tab", false],
      ["code", "Open in VS Code", false],
      ["folder", "Open the folder", false],
      ["edit", "Open in nvim", false],
      ["terminal", "Follow the log", false],
      ["obsidian", "Note it", true],
    ]);
  });

  it("holds zellij back once a zellij action exists, and no other kind", () => {
    const actions = mockActions();
    const withoutZellij = actions.filter((action) => action.kind !== "zellij");

    expect(launchKinds.filter((kind) => kindTaken(actions, kind))).toEqual([
      "zellij",
    ]);
    expect(
      launchKinds.filter((kind) => kindTaken(withoutZellij, kind)),
    ).toEqual([]);
  });

  it("refuses a custom command without words or a command, a command not naming a program first, and a placeholder the kind may not use", () => {
    const problems = settingsProblems(
      withActions([
        {
          kind: "command",
          verb: "",
          command: '["code", "{path}"]',
          icon: "folder",
        },
        { kind: "command", verb: "Run", command: "", icon: "folder" },
        { kind: "folder", verb: "", command: '["", "lnav", "{path}/logs"]' },
        { kind: "vscode", verb: "", command: '["code", "{obsidian}"]' },
        {
          kind: "command",
          verb: "Open the worktree",
          command: '["code", "{worktree}"]',
          icon: "code",
        },
        { kind: "nvim", verb: "", command: "nvim {path}" },
        {
          kind: "zellij",
          verb: "",
          zellij: '["zellij", "{session}"]',
          terminal: '["kitty", "{path}"]',
          session: "",
          sessions: [],
        },
      ]),
    );

    expect(problems).toEqual([
      "Launch action 1, action: needs words for the bird's page",
      "Launch action 2, command: needs a command",
      "Launch action 3, command: must name a program first",
      "Launch action 4, command: has no placeholder {obsidian}; it may use {path}",
      "Launch action 5, command: has no placeholder {worktree}; it may use {path} and {obsidian}",
      'Launch action 6, command: must be a list in brackets of strings in double quotes, such as ["code", "{path}"]',
      "Launch action 7, zellij command: has no placeholder {session}; it may use none",
      "Launch action 7, terminal command: has no placeholder {path}; it may use {session} and {cwd}",
    ]);
  });

  it("refuses a second zellij action, as the config parser does", () => {
    const zellij = newCard("zellij");

    expect(launchProblems([zellij, zellij])).toEqual([
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
      "each root must start with / or ~",
    ]);
    expect(unnamed([{ root: "~/undev", session: "" }])).toEqual([
      "every root needs a session name",
    ]);
    expect(
      unnamed([
        { root: "~/undev", session: "a" },
        { root: "~/undev", session: "b" },
      ]),
    ).toEqual(["each root once"]);
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
  ...settingsFormFor(config, home, mockLogin).values,
  wires: { rows, defaultRow },
});

/** Each entry key and the wire it names, null for the default. */
const wiresByEntry = (config: Config) =>
  Object.fromEntries(
    Object.entries(config.items).map(([key, entry]) => [key, entry.wire]),
  );

const homeEntries = [
  ".dotfiles",
  "obsidian/Hothouse",
  "obsidian/Pocket",
  "forgejo:finch/field-notes",
];

/** The saved config, read back from the bytes written, so the writer agrees. */
function saved(config: Config, values: SettingsValues): Config {
  expect(settingsProblems(values)).toEqual([]);
  const next = withSettings(config, values, home);
  expect(parseConfig(writeConfig(next, home), home)).toEqual(next);
  return next;
}

describe("renaming, removing and adding wires", () => {
  it("names the entries on each wire", () => {
    const { named } = settingsFormFor(mockConfig, home, mockLogin);

    expect(named).toEqual({ wires: { "Machine & Home": homeEntries } });
  });

  it("starts each row as the config wire it is", () => {
    expect(settingsFormFor(mockConfig, home, mockLogin).values.wires).toEqual({
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
      wireWarnings(
        settingsFormFor(mockConfig, home, mockLogin).named.wires,
        values.wires,
      ),
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
    const form = settingsFormFor(mockConfig, home, mockLogin);
    const values = wiresOf(
      mockConfig,
      [{ from: "Projects", name: "Projects" }],
      0,
    );

    expect(wireWarnings(form.named.wires, values.wires)).toEqual([
      ".dotfiles, obsidian/Hothouse, obsidian/Pocket and forgejo:finch/field-notes sit on Machine & Home, which is removed: saving moves them to the default wire, Projects.",
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
    const form = settingsFormFor(withSomeday, home, mockLogin);
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
