import { describe, expect, it } from "vitest";
import { type Config, parseConfig, type SourcesConfig } from "../src/config.ts";
import { writeConfig } from "../src/config-write.ts";
import { configuredCards } from "../src/derivations.ts";
import { mockConfig } from "../src/mock.ts";
import {
  type SettingsValues,
  settingsFormFor,
  settingsProblems,
  withSettings,
} from "../src/settings-form.ts";
import {
  sourceCardId,
  sourceCardsOf,
  sourceHeading,
  sourceProblems,
  withSourceAdded,
  withSourceCard,
  withSourceRemoved,
} from "../src/sources-form.ts";

const home = "/home/owner";

const mockValues = () => settingsFormFor(mockConfig, home).values;

const withSources = (sources: SourcesConfig): SettingsValues => ({
  ...mockValues(),
  sources,
});

const none: SourcesConfig = { local: [], github: [], forgejo: [], kuma: [] };

const github = (account: string) => ({
  account,
  key: `github-${account}`,
  hosts: ["github.com"],
  trackedForks: [],
});

const forgejo = (account: string, baseUrl: string) => ({
  ...github(account),
  key: `forgejo-${account}`,
  baseUrl,
});

const kuma = (name: string) => ({
  name,
  baseUrl: "http://forge.example.lan:3001",
  statusPage: "perch",
});

/** The config as written and read back. */
const reread = (config: Config) => parseConfig(writeConfig(config, home), home);

describe("the sources in the settings form", () => {
  it("reads every source table into values with ~ and puts them back unchanged", () => {
    const { sources } = mockValues();

    expect(sources.local[0]?.include).toEqual([
      "~/dev",
      "~/undev",
      "~/.dotfiles",
      "~/obsidian/Hothouse",
      "~/obsidian/Pocket",
      "~/work",
    ]);
    expect(sources.local[0]?.exclude).toEqual([
      "~/dev/archived",
      "~/dev/third-party",
    ]);
    expect(sources.github.map((source) => source.account)).toEqual([
      "finch",
      "the-undev",
      "skiff-app",
    ]);
    expect(withSettings(mockConfig, mockValues(), home).sources).toEqual(
      mockConfig.sources,
    );
  });

  it("writes an edited set of sources that the config file reads back as typed", () => {
    const sources: SourcesConfig = {
      local: [{ include: ["~/dev", "/srv/repos"], exclude: ["~/dev/old"] }],
      github: [github("someone"), github("someone-else")],
      forgejo: [forgejo("someone", "https://forge.example.lan")],
      kuma: [kuma("Server")],
    };
    const config = withSettings(mockConfig, withSources(sources), home);

    expect(config.sources.local[0]?.include).toEqual([
      `${home}/dev`,
      "/srv/repos",
    ]);
    expect(reread(config)).toEqual(config);
    expect(settingsFormFor(reread(config), home).values.sources).toEqual(
      sources,
    );
  });

  it("writes a config with no sources, which reads back with none", () => {
    const config = withSettings(mockConfig, withSources(none), home);

    expect(reread(config).sources).toEqual(none);
  });

  it("adds a card of each kind with its fields empty after its kind's last, and removes one", () => {
    let sources = withSourceAdded(mockValues().sources, "github");
    sources = withSourceAdded(sources, "forgejo");
    sources = withSourceAdded(sources, "kuma");
    sources = withSourceAdded(sources, "local");

    expect(sources.github.at(-1)).toEqual({
      account: "",
      key: "",
      hosts: [],
      trackedForks: [],
    });
    expect(sources.forgejo.at(-1)).toEqual({
      account: "",
      key: "",
      hosts: [],
      trackedForks: [],
      baseUrl: "",
    });
    expect(sources.kuma.at(-1)).toEqual({
      name: "",
      baseUrl: "",
      statusPage: "",
    });
    expect(sources.local.at(-1)).toEqual({ include: [], exclude: [] });
    expect(sources.github).toHaveLength(4);

    const removed = withSourceRemoved(sources, "github", 1);
    expect(removed.github.map((source) => source.account)).toEqual([
      "finch",
      "skiff-app",
      "",
    ]);
    expect(removed.forgejo).toEqual(sources.forgejo);
  });

  it("lists the cards in config order and sets one card's values", () => {
    const sources = mockValues().sources;
    const cards = sourceCardsOf(sources);

    expect(cards.map((card) => `${card.kind}${card.index}`)).toEqual([
      "local0",
      "github0",
      "github1",
      "github2",
      "forgejo0",
      "forgejo1",
      "kuma0",
    ]);
    const next = withSourceCard(sources, {
      kind: "kuma",
      index: 0,
      source: kuma("Server"),
    });
    expect(next.kuma).toEqual([kuma("Server")]);
    expect(next.github).toEqual(sources.github);
  });

  it("matches each card to its scan record by the id the snapshot gives it", () => {
    const cards = sourceCardsOf(mockValues().sources);

    expect(cards.map(sourceCardId)).toEqual(
      configuredCards(mockConfig.sources, home).map((card) => card.id),
    );
  });

  it("heads each card with its kind, then its account, host or name", () => {
    const sources: SourcesConfig = {
      local: [{ include: ["~/dev"], exclude: [] }],
      github: [github("someone"), github("")],
      forgejo: [forgejo("someone", "https://forge.example.lan")],
      kuma: [kuma("Server")],
    };

    expect(sourceCardsOf(sources).map(sourceHeading)).toEqual([
      "Local folders",
      "GitHub · someone",
      "GitHub",
      "Forgejo · forge.example.lan",
      "Uptime Kuma · Server",
    ]);
  });
});

describe("what the sources cannot be", () => {
  it("names each empty required field of a new card, and refuses to write them", () => {
    let sources = none;
    for (const kind of ["local", "github", "forgejo", "kuma"] as const) {
      sources = withSourceAdded(sources, kind);
    }

    expect(sourceProblems(sources)).toEqual([
      {
        kind: "local",
        index: 0,
        field: "include",
        problem: "name at least one folder",
      },
      {
        kind: "github",
        index: 0,
        field: "account",
        problem: "needs an account",
      },
      {
        kind: "github",
        index: 0,
        field: "key",
        problem: "needs the keyring key holding the token",
      },
      {
        kind: "forgejo",
        index: 0,
        field: "baseUrl",
        problem: "needs an address",
      },
      {
        kind: "forgejo",
        index: 0,
        field: "account",
        problem: "needs an account",
      },
      {
        kind: "forgejo",
        index: 0,
        field: "key",
        problem: "needs the keyring key holding the token",
      },
      { kind: "kuma", index: 0, field: "name", problem: "needs a name" },
      { kind: "kuma", index: 0, field: "baseUrl", problem: "needs an address" },
      {
        kind: "kuma",
        index: 0,
        field: "statusPage",
        problem: "needs the status page's slug",
      },
    ]);
    expect(settingsProblems(withSources(sources))).toContain(
      "GitHub source 1, account: needs an account",
    );
    expect(() => withSettings(mockConfig, withSources(sources), home)).toThrow(
      "Uptime Kuma source 1, status page: needs the status page's slug",
    );
  });

  it("wants folders that start with / or ~, none empty, and lists without blanks", () => {
    const sources: SourcesConfig = {
      ...none,
      local: [{ include: ["dev", "~/ok"], exclude: [" "] }],
      github: [{ ...github("someone"), hosts: [""], trackedForks: [" "] }],
      kuma: [{ ...kuma("Server"), baseUrl: "forge.example.lan:3001" }],
    };

    expect(
      sourceProblems(sources).map(
        ({ kind, field, problem }) => `${kind} ${field}: ${problem}`,
      ),
    ).toEqual([
      "local include: each folder must start with / or ~",
      "local exclude: a folder cannot be empty",
      "github hosts: a host cannot be empty",
      "github trackedForks: a fork cannot be empty",
      "kuma baseUrl: must start with http:// or https://",
    ]);
  });

  it("refuses a GitHub account twice, in any case, as the config file does", () => {
    const sources = {
      ...none,
      github: [github("someone"), github("other"), github("SomeOne")],
    };

    expect(sourceProblems(sources)).toEqual([
      {
        kind: "github",
        index: 2,
        field: "account",
        problem: "another GitHub source reads this account",
      },
    ]);
    expect(() =>
      reread({ ...mockConfig, sources: { ...mockConfig.sources, ...sources } }),
    ).toThrow("each may appear once");
  });

  it("refuses a Forgejo account twice at one address, and allows it at another", () => {
    const twice = {
      ...none,
      forgejo: [
        forgejo("someone", "https://forge.example.lan"),
        forgejo("someone", "https://forge.example.lan"),
        forgejo("someone", "https://other.example.lan"),
      ],
    };

    expect(sourceProblems(twice)).toEqual([
      {
        kind: "forgejo",
        index: 1,
        field: "account",
        problem: "another Forgejo source reads this account at this address",
      },
    ]);
    expect(() =>
      reread({ ...mockConfig, sources: { ...mockConfig.sources, ...twice } }),
    ).toThrow("each may appear once");
    const apart = { ...twice, forgejo: [twice.forgejo[0], twice.forgejo[2]] };
    expect(sourceProblems(apart as SourcesConfig)).toEqual([]);
  });

  it("refuses an Uptime Kuma name twice, as the config file does", () => {
    const sources = { ...none, kuma: [kuma("Server"), kuma("Server")] };

    expect(sourceProblems(sources)).toEqual([
      {
        kind: "kuma",
        index: 1,
        field: "name",
        problem: "another Uptime Kuma source has this name",
      },
    ]);
    expect(() =>
      reread({ ...mockConfig, sources: { ...mockConfig.sources, ...sources } }),
    ).toThrow("each may appear once");
  });
});
