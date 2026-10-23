import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Config, parseConfig } from "../src/config.ts";
import { writeConfig } from "../src/config-write.ts";

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

[local]
include = ["~/dev", "/srv/repos"]
ignore = ["~/dev/archived"]

[thresholds]
unsafe_amber_hours = 12
unsafe_red_hours = 48
stalled_amber_days = 5
stalled_red_days = 20
expectation_amber_days = 2
expectation_red_days = 9

[importance]
tiers = ["server", "machine", "projects"]
default = "machine"

[scan]
interval_minutes = 5
archived_interval_hours = 12

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
importance = "server"
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

[forges]
finalised_commits = 25

[forges.github]
hosts = ["github.com", "github-work"]
accounts = [
  { account = "finch", key = "github-finch" },
  { account = "the-undev", key = "github-the-undev" },
]
tracked_forks = ["someone/fork"]

[forges.forgejo]
base_url = "http://forgejo.invalid:3000"
hosts = ["forgejo"]
accounts = []
tracked_forks = []

[server]
name = "Silo"
kuma_base_url = "http://kuma.invalid:3001"
kuma_status_page = "perch"
`;

function roundTrip(config: Config): Config {
  return parseConfig(writeConfig(config), home);
}

describe("writeConfig", () => {
  it("writes the example config back to an equal config", async () => {
    const config = parseConfig(await exampleText(), home);

    expect(roundTrip(config)).toEqual(config);
  });

  it("writes every field back to an equal config", () => {
    const config = parseConfig(maximalText, home);

    expect(config.server).not.toBeNull();
    expect(config.items["forgejo:finch/hollow"]?.keyFiles).toEqual([]);
    expect(config.launch.commands.zellij).toBeNull();
    expect(roundTrip(config)).toEqual(config);
  });

  it("leaves the [server] section out when there is no server", () => {
    const config: Config = { ...parseConfig(maximalText, home), server: null };

    const text = writeConfig(config);

    expect(text).not.toContain("[server]");
    expect(roundTrip(config)).toEqual(config);
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

    const text = writeConfig(config);

    expect(writeConfig(config)).toBe(text);
    expect(writeConfig(roundTrip(config))).toBe(text);
    expect(writeConfig(reordered)).toBe(text);
  });

  it("writes no comments", async () => {
    const text = writeConfig(parseConfig(await exampleText(), home));

    expect(
      text.split("\n").some((line) => line.trimStart().startsWith("#")),
    ).toBe(false);
  });
});
