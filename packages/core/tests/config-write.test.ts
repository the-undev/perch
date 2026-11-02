import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { type Config, parseConfig } from "../src/config.ts";
import { writeConfig } from "../src/config-write.ts";
import { fixtureConfigText } from "./helpers/config.ts";

const home = "/home/test";

async function exampleText(): Promise<string> {
  return readFile(
    join(import.meta.dirname, "..", "..", "..", "config.example.toml"),
    "utf8",
  );
}

/** Every field config can hold, each set away from its default. */
const maximalText = `
joins = [["github:finch/notes", "forgejo:finch/notes"], ["local:dev/a", "github:finch/a"]]
ignore = ["github:finch/scratch", "forgejo:the-undev/old"]

[wires]
names = ["Machine & Home", "Projects", "Someday"]
default = "Someday"

[[sources.local]]
include = ["~/dev", "/srv/repos"]
exclude = ["~/dev/archived"]

[[sources.local]]
include = ["~/work"]
exclude = []

[[sources.github]]
account = "the-undev"
key = "github-the-undev"
hosts = ["github.com", "github-work"]
tracked_forks = []

[[sources.github]]
account = "finch"
key = "github-finch"
hosts = ["github.com"]
tracked_forks = ["someone/fork"]

[[sources.forgejo]]
base_url = "http://forgejo.invalid:3000"
account = "finch"
key = "forgejo-finch"
hosts = ["forgejo"]
tracked_forks = []

[[sources.kuma]]
name = "Silo"
base_url = "http://kuma.invalid:3001"
status_page = "perch"

[[sources.kuma]]
name = "Box"
base_url = "http://kuma.invalid:3002"
status_page = "box"

[thresholds]
unsafe_amber_hours = 12
unsafe_red_hours = 48
stalled_amber_days = 5
stalled_red_days = 20

[scan]
interval_minutes = 5
finalised_commits = 25

[[launch.actions]]
kind = "vscode"

[[launch.actions]]
kind = "zellij"
verb = "Open the tab"
terminal = ["konsole", "--workdir", "{cwd}", "-e", "zellij", "attach", "-c", "{session}"]
session = "work"

[launch.actions.sessions]
"~/undev/tools" = "tools"
"~/undev" = "undev"

[[launch.actions]]
kind = "command"
verb = "Note the Obsidian vault"
command = ["notify-send", "{obsidian}"]
icon = "obsidian"

[items."dev/perch"]
wire = "Projects"
name = "Perch"
key_files = ["README.md", "docs/spec.md"]
roadmaps = ["docs/roadmap.md"]
zellij_session = "perch"
unsafe_amber_hours = 6
unsafe_red_hours = 30
stalled_amber_days = 2
stalled_red_days = 40

[items."forgejo:finch/hollow"]
stalled_red_days = 90
key_files = []
roadmaps = []

[items.".dotfiles"]
`;

function roundTrip(config: Config): Config {
  return parseConfig(writeConfig(config, home), home);
}

/** The config with its zellij action's sessions replaced. */
function withSessions(
  config: Config,
  sessions: Record<string, string>,
): Config {
  return {
    ...config,
    launch: {
      actions: config.launch.actions.map((action) =>
        action.kind === "zellij" ? { ...action, sessions } : action,
      ),
    },
  };
}

/** The zellij action's sessions in a written document. */
function writtenSessions(document: Record<string, unknown>): unknown {
  const launch = document.launch as { actions: Record<string, unknown>[] };
  return launch.actions.find((action) => action.kind === "zellij")?.sessions;
}

describe("writeConfig", () => {
  it("writes the example config back to an equal config", async () => {
    const config = parseConfig(await exampleText(), home);

    expect(roundTrip(config)).toEqual(config);
  });

  it("writes every field back to an equal config", () => {
    const config = parseConfig(maximalText, home);

    expect(config.sources.kuma).toHaveLength(2);
    expect(config.items["forgejo:finch/hollow"]?.keyFiles).toEqual([]);
    expect(config.launch.actions.map((action) => action.kind)).toEqual([
      "vscode",
      "zellij",
      "command",
    ]);
    expect(roundTrip(config)).toEqual(config);
  });

  it("leaves out a source kind with no tables, and the sources table with none at all", () => {
    const config = parseConfig(maximalText, home);
    const noKuma: Config = {
      ...config,
      sources: { ...config.sources, kuma: [] },
    };
    const none: Config = {
      ...config,
      sources: { local: [], github: [], forgejo: [], kuma: [] },
    };

    expect(writeConfig(noKuma, home)).not.toContain("sources.kuma");
    expect(roundTrip(noKuma)).toEqual(noKuma);
    expect(writeConfig(none, home)).not.toContain("sources");
    expect(roundTrip(none)).toEqual(none);
  });

  it("keeps each kind's tables in the order configured", () => {
    const config = parseConfig(maximalText, home);
    const reversed: Config = {
      ...config,
      sources: {
        ...config.sources,
        github: [...config.sources.github].reverse(),
      },
    };

    const text = writeConfig(reversed, home);

    expect(text.indexOf('account = "finch"')).toBeLessThan(
      text.indexOf('account = "the-undev"'),
    );
    expect(text).toContain(
      '[[sources.kuma]]\nname = "Silo"\nbase_url = "http://kuma.invalid:3001"\nstatus_page = "perch"\n\n[[sources.kuma]]\nname = "Box"',
    );
    expect(roundTrip(reversed)).toEqual(reversed);
  });

  it("writes a config with no item entries", async () => {
    const config: Config = {
      ...parseConfig(await exampleText(), home),
      items: {},
    };

    expect(roundTrip(config)).toEqual(config);
  });

  it("writes the same bytes every time, whatever order entries were added in", () => {
    const config = parseConfig(maximalText, home);
    const reordered: Config = {
      ...withSessions(config, {
        [`${home}/undev`]: "undev",
        [`${home}/undev/tools`]: "tools",
      }),
      items: Object.fromEntries(Object.entries(config.items).reverse()),
    };

    const text = writeConfig(config, home);

    expect(writeConfig(config, home)).toBe(text);
    expect(writeConfig(roundTrip(config), home)).toBe(text);
    expect(writeConfig(reordered, home)).toBe(text);
  });

  it("writes the example back as the same TOML document", async () => {
    const text = await exampleText();

    const written = writeConfig(parseConfig(text, home), home);

    expect(parse(written)).toEqual(parse(text));
  });

  it("writes the fixture back as the same TOML document, its ~ paths as they were typed", async () => {
    const text = await fixtureConfigText("");

    const written = writeConfig(parseConfig(text, home), home);

    expect(parse(written)).toEqual(parse(text));
    expect(written).toContain('include = [ "~/dev", "~/.dotfiles" ]');
  });

  it("writes paths at or under the home directory with ~, and any other path as it is", () => {
    const config = withSessions(parseConfig(maximalText, home), {
      [`${home}/undev`]: "undev",
      "/srv": "srv",
    });
    const paths: Config = {
      ...config,
      sources: {
        ...config.sources,
        local: [
          {
            include: [home, `${home}/dev`, "/srv/repos", `${home}2/elsewhere`],
            exclude: [`${home}/dev/archived`],
          },
        ],
      },
    };

    const document = parse(writeConfig(paths, home));

    expect((document.sources as Record<string, unknown>).local).toEqual([
      {
        include: ["~", "~/dev", "/srv/repos", "/home/test2/elsewhere"],
        exclude: ["~/dev/archived"],
      },
    ]);
    expect(writtenSessions(document)).toEqual({
      "/srv": "srv",
      "~/undev": "undev",
    });
    expect(roundTrip(paths)).toEqual(paths);
  });

  it("leaves out empty item and session tables, and the launch table with no actions", () => {
    const config = parseConfig(maximalText, home);
    const noSessions: Config = { ...withSessions(config, {}), items: {} };
    const noActions: Config = { ...config, launch: { actions: [] } };

    const text = writeConfig(noSessions, home);

    expect(text).not.toContain("[items]");
    expect(text).not.toContain("sessions");
    expect(roundTrip(noSessions)).toEqual(noSessions);
    expect(writeConfig(noActions, home)).not.toContain("launch");
    expect(roundTrip(noActions)).toEqual(noActions);
  });

  it("writes one table per launch action in order, each naming its kind", () => {
    const config = parseConfig(maximalText, home);
    const reversed: Config = {
      ...config,
      launch: { actions: [...config.launch.actions].reverse() },
    };

    const document = parse(writeConfig(reversed, home));

    expect(
      (document.launch as { actions: Record<string, unknown>[] }).actions.map(
        (action) => [action.kind, action.verb],
      ),
    ).toEqual([
      ["command", "Note the Obsidian vault"],
      ["zellij", "Open the tab"],
      ["vscode", undefined],
    ]);
    expect(roundTrip(reversed)).toEqual(reversed);
  });

  it("writes only what differs from a kind's defaults, and a custom command's icon unless it is the folder", () => {
    const config: Config = {
      ...parseConfig(maximalText, home),
      launch: {
        actions: [
          {
            kind: "nvim",
            verb: "Open in nvim",
            command: ["kitty", "{path}", "nvim"],
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
          {
            kind: "obsidian",
            verb: "Open the Obsidian vault",
            command: ["xdg-open", "obsidian://open?vault={obsidian}"],
          },
          {
            kind: "command",
            verb: "Run",
            command: ["make", "-C", "{path}"],
            icon: "folder",
          },
        ],
      },
    };

    const document = parse(writeConfig(config, home));

    expect((document.launch as { actions: unknown[] }).actions).toEqual([
      { kind: "nvim", command: ["kitty", "{path}", "nvim"] },
      { kind: "zellij" },
      { kind: "obsidian", verb: "Open the Obsidian vault" },
      { kind: "command", verb: "Run", command: ["make", "-C", "{path}"] },
    ]);
    expect(roundTrip(config)).toEqual(config);
  });

  it("writes no comments", async () => {
    const text = writeConfig(parseConfig(await exampleText(), home), home);

    expect(
      text.split("\n").some((line) => line.trimStart().startsWith("#")),
    ).toBe(false);
  });
});
