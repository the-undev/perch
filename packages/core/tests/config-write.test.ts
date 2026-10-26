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
expectation_amber_days = 2
expectation_red_days = 9

[scan]
interval_minutes = 5
archived_interval_hours = 12
finalised_commits = 25

[launch]
zellij_session = "main"

[launch.zellij_sessions]
"~/undev/tools" = "tools"
"~/undev" = "undev"

[launch.commands]
terminal = ["konsole", "--workdir", "{cwd}", "-e", "zellij", "attach", "-c", "{session}"]
vscode = ["code", "{path}"]
obsidian = ["xdg-open", "obsidian://open?vault={vault}"]

[items."dev/perch"]
wire = "Projects"
name = "Perch"
expect = ["ci", "tickets"]
key_files = ["README.md", "docs/spec.md"]
roadmaps = ["docs/roadmap.md"]
zellij_session = "perch"
unsafe_amber_hours = 6
unsafe_red_hours = 30
stalled_amber_days = 2
stalled_red_days = 40
expectation_amber_days = 1
expectation_red_days = 3

[items."forgejo:finch/hollow"]
stalled_red_days = 90
key_files = []
roadmaps = []

[items.".dotfiles"]
`;

function roundTrip(config: Config): Config {
  return parseConfig(writeConfig(config, home), home);
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
    expect(config.launch.commands.zellij).toBeNull();
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
      ...config,
      items: Object.fromEntries(Object.entries(config.items).reverse()),
      launch: {
        ...config.launch,
        zellijSessions: Object.fromEntries(
          Object.entries(config.launch.zellijSessions).reverse(),
        ),
      },
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
    const config = parseConfig(maximalText, home);
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
      launch: {
        ...config.launch,
        zellijSessions: { [`${home}/undev`]: "undev", "/srv": "srv" },
      },
    };

    const document = parse(writeConfig(paths, home));

    expect((document.sources as Record<string, unknown>).local).toEqual([
      {
        include: ["~", "~/dev", "/srv/repos", "/home/test2/elsewhere"],
        exclude: ["~/dev/archived"],
      },
    ]);
    expect(
      (document.launch as Record<string, unknown>).zellij_sessions,
    ).toEqual({ "/srv": "srv", "~/undev": "undev" });
    expect(roundTrip(paths)).toEqual(paths);
  });

  it("leaves out empty item, zellij session and command tables", () => {
    const config = parseConfig(maximalText, home);
    const empty: Config = {
      ...config,
      items: {},
      launch: {
        ...config.launch,
        zellijSessions: {},
        commands: {
          zellij: null,
          terminal: null,
          vscode: null,
          folder: null,
          obsidian: null,
        },
      },
    };

    const text = writeConfig(empty, home);

    expect(text).not.toContain("[items]");
    expect(text).not.toContain("zellij_sessions");
    expect(text).not.toContain("[launch.commands]");
    expect(roundTrip(empty)).toEqual(empty);
  });

  it("writes no comments", async () => {
    const text = writeConfig(parseConfig(await exampleText(), home), home);

    expect(
      text.split("\n").some((line) => line.trimStart().startsWith("#")),
    ).toBe(false);
  });
});
