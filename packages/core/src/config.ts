// The config model: what the owner asserts that leaves no trace on disk or on a forge. Parsing
// uses no Node modules, so the renderer may import the lookups below.

import { parse } from "smol-toml";
import { candidateRefs } from "./refs.ts";
import type {
  DayThresholds,
  ExpectationName,
  HourThresholds,
} from "./snapshot.ts";

export type { ExpectationName };

/** Every expectation config may assert. */
export const expectationNames: readonly ExpectationName[] = ["ci", "tickets"];

/** The three health windows: unsafe work in hours, stalled flight and unmet expectations in days. */
export interface Thresholds {
  unsafe: HourThresholds;
  stalled: DayThresholds;
  expectation: DayThresholds;
}

/** Per-item threshold overrides; anything left out takes the global value. */
export interface ThresholdOverrides {
  unsafe: Partial<HourThresholds>;
  stalled: Partial<DayThresholds>;
  expectation: Partial<DayThresholds>;
}

/** An item's entry in config. Having one adopts the bird, which puts it on a wire. */
export interface ItemEntry {
  /** The wire the bird sits on; null puts it on the default wire. */
  wire: string | null;
  /** The name the bird goes by; null keeps the scanned name. */
  name: string | null;
  importance: string | null;
  thresholds: ThresholdOverrides;
  /** Sources the owner says this item should have; an unmet one is a fact on the bird. */
  expect: ExpectationName[];
  /** Files for the detail page, relative to the item; null keeps the README and the roadmaps. */
  keyFiles: string[] | null;
  /** Roadmap files relative to the item, replacing the standard names; null keeps them. */
  roadmaps: string[] | null;
  /** The zellij session holding the item's tab; null takes it from the launch section. */
  zellijSession: string | null;
}

export interface ForgeAccount {
  /** The user or organisation whose own repositories this account lists. */
  account: string;
  /** The keyring key, under service perch, holding the account's read-only token. */
  key: string;
}

export interface ForgeConfig {
  /** Remote hosts or SSH aliases that are this forge. */
  hosts: string[];
  accounts: ForgeAccount[];
  /** Forks worth tracking, as owner/name; every other fork is skipped. */
  trackedForks: string[];
}

export interface Config {
  /** The wires top to bottom, and the one an adopted item sits on when its entry names none. */
  wires: { names: string[]; default: string };
  local: { include: string[]; ignore: string[] };
  /** Groups of presence references asserted to be one project. */
  joins: string[][];
  /** Presence references to leave off the main view. */
  ignore: string[];
  thresholds: Thresholds;
  importance: { tiers: string[]; default: string };
  /**
   * Item entries keyed by any of the item's presence references (see resolveEntry); an entry
   * adopts the item and marks a found repository set up.
   */
  items: Record<string, ItemEntry>;
  /** The two scan lanes: everything on the main interval, archived forge data on the slow one. */
  scan: { intervalMinutes: number; archivedIntervalHours: number };
  launch: {
    /** The zellij session for an item no root or entry assigns. */
    zellijSession: string;
    /** Sessions by root directory, home expanded; the longest root containing the item wins. */
    zellijSessions: Record<string, string>;
    commands: LaunchCommands;
  };
  forges: {
    finalisedCommits: number;
    github: ForgeConfig;
    forgejo: ForgeConfig & { baseUrl: string };
  };
  /** The server to monitor through Uptime Kuma; null when config has no [server] section. */
  server: { name: string; kumaBaseUrl: string; kumaStatusPage: string } | null;
}

/** A launch command's name in config, which is also the launch action it serves. */
export type LaunchCommandName =
  | "zellij"
  | "terminal"
  | "vscode"
  | "folder"
  | "obsidian";

/**
 * The commands behind the launch actions, each an argument list with placeholders filled in at
 * launch; null when config leaves it out, and then its action is not offered.
 */
export type LaunchCommands = Record<LaunchCommandName, string[] | null>;

/** The placeholders each launch command may use. */
export const launchPlaceholders: Record<LaunchCommandName, readonly string[]> =
  {
    zellij: [],
    terminal: ["session", "cwd"],
    vscode: ["path"],
    folder: ["path"],
    obsidian: ["vault"],
  };

export interface LoadedConfig {
  config: Config;
  path: string;
}

type Table = Record<string, unknown>;

function isTable(value: unknown): value is Table {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function table(parent: Table, key: string, where: string): Table {
  const value = parent[key];
  if (!isTable(value))
    throw new Error(`config: ${where}${key} must be a table`);
  return value;
}

function optionalTable(parent: Table, key: string, where: string): Table {
  if (parent[key] === undefined) return {};
  return table(parent, key, where);
}

function string(parent: Table, key: string, where: string): string {
  const value = parent[key];
  if (typeof value !== "string")
    throw new Error(`config: ${where}${key} must be a string`);
  return value;
}

function optionalString(
  parent: Table,
  key: string,
  where: string,
): string | null {
  if (parent[key] === undefined) return null;
  return string(parent, key, where);
}

function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`config: ${name} must be a positive integer`);
  }
  return value;
}

function stringArray(value: unknown, name: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === "string")
  ) {
    throw new Error(`config: ${name} must be an array of strings`);
  }
  return value;
}

function oneOf(
  value: string,
  allowed: readonly string[],
  name: string,
): string {
  if (!allowed.includes(value)) {
    throw new Error(`config: ${name} must be one of ${allowed.join(", ")}`);
  }
  return value;
}

/** A path with a leading ~ expanded against the home directory; any other path as it is. */
export function expandHome(path: string, home: string): string {
  if (path === "~") return home;
  if (path.startsWith("~/")) return `${home}/${path.slice(2)}`;
  return path;
}

/** A path at or under the home directory written with a leading ~; any other path as it is. */
export function collapseHome(path: string, home: string): string {
  if (path === home) return "~";
  if (path.startsWith(`${home}/`)) return `~/${path.slice(home.length + 1)}`;
  return path;
}

/** The threshold keys, the same globally and per item, with the window and field each sets. */
export const thresholdKeys = [
  ["unsafe", "amberHours", "unsafe_amber_hours"],
  ["unsafe", "redHours", "unsafe_red_hours"],
  ["stalled", "amberDays", "stalled_amber_days"],
  ["stalled", "redDays", "stalled_red_days"],
  ["expectation", "amberDays", "expectation_amber_days"],
  ["expectation", "redDays", "expectation_red_days"],
] as const;

/** Reads the threshold keys present in a table. */
function thresholdOverrides(source: Table, where: string): ThresholdOverrides {
  const overrides: ThresholdOverrides = {
    unsafe: {},
    stalled: {},
    expectation: {},
  };
  for (const [window, field, key] of thresholdKeys) {
    if (source[key] === undefined) continue;
    Object.assign(overrides[window], {
      [field]: positiveInteger(source[key], `${where}${key}`),
    });
  }
  return overrides;
}

function applyOverrides(
  base: Thresholds,
  overrides: ThresholdOverrides,
): Thresholds {
  return {
    unsafe: { ...base.unsafe, ...overrides.unsafe },
    stalled: { ...base.stalled, ...overrides.stalled },
    expectation: { ...base.expectation, ...overrides.expectation },
  };
}

/** Amber must open before red, or the amber window would never show. */
function checkOrder(thresholds: Thresholds, where: string): void {
  const pairs: [string, number, number][] = [
    ["unsafe", thresholds.unsafe.amberHours, thresholds.unsafe.redHours],
    ["stalled", thresholds.stalled.amberDays, thresholds.stalled.redDays],
    [
      "expectation",
      thresholds.expectation.amberDays,
      thresholds.expectation.redDays,
    ],
  ];
  for (const [name, amber, red] of pairs) {
    if (amber >= red) {
      throw new Error(
        `config: ${where}${name} amber threshold must be below its red threshold`,
      );
    }
  }
}

function globalThresholds(source: Table): Thresholds {
  const read = (key: string) =>
    positiveInteger(source[key], `thresholds.${key}`);
  return {
    unsafe: {
      amberHours: read("unsafe_amber_hours"),
      redHours: read("unsafe_red_hours"),
    },
    stalled: {
      amberDays: read("stalled_amber_days"),
      redDays: read("stalled_red_days"),
    },
    expectation: {
      amberDays: read("expectation_amber_days"),
      redDays: read("expectation_red_days"),
    },
  };
}

function parseEntry(
  id: string,
  value: unknown,
  context: {
    tiers: readonly string[];
    wires: readonly string[];
    thresholds: Thresholds;
  },
): ItemEntry {
  const where = `items."${id}".`;
  if (!isTable(value)) throw new Error(`config: items."${id}" must be a table`);
  const importance = optionalString(value, "importance", where);
  if (importance !== null)
    oneOf(importance, context.tiers, `${where}importance`);
  const wire = optionalString(value, "wire", where);
  if (wire !== null) oneOf(wire, context.wires, `${where}wire`);
  const thresholds = thresholdOverrides(value, where);
  checkOrder(applyOverrides(context.thresholds, thresholds), where);
  const expect =
    value.expect === undefined
      ? []
      : stringArray(value.expect, `${where}expect`).map(
          (name) =>
            oneOf(name, expectationNames, `${where}expect`) as ExpectationName,
        );
  const list = (key: string) =>
    value[key] === undefined ? null : stringArray(value[key], `${where}${key}`);
  return {
    wire,
    name: optionalString(value, "name", where),
    importance,
    thresholds,
    expect,
    keyFiles: list("key_files"),
    roadmaps: list("roadmaps"),
    zellijSession: optionalString(value, "zellij_session", where),
  };
}

function parseForge(forge: Table, where: string): ForgeConfig {
  const accounts = forge.accounts;
  if (!Array.isArray(accounts)) {
    throw new Error(`config: ${where}accounts must be an array of tables`);
  }
  return {
    hosts: stringArray(forge.hosts, `${where}hosts`),
    accounts: accounts.map((entry, index) => {
      const name = `${where}accounts[${index}]`;
      if (!isTable(entry)) throw new Error(`config: ${name} must be a table`);
      return {
        account: string(entry, "account", `${name}.`),
        key: string(entry, "key", `${name}.`),
      };
    }),
    trackedForks: stringArray(forge.tracked_forks, `${where}tracked_forks`),
  };
}

function parseLaunchCommands(commands: Table): LaunchCommands {
  const parsed = {} as LaunchCommands;
  for (const [command, allowed] of Object.entries(launchPlaceholders) as [
    LaunchCommandName,
    readonly string[],
  ][]) {
    const name = `launch.commands.${command}`;
    if (commands[command] === undefined) {
      parsed[command] = null;
      continue;
    }
    const argv = stringArray(commands[command], name);
    if (argv.length === 0) {
      throw new Error(`config: ${name} must name a program`);
    }
    for (const [, placeholder] of argv.join(" ").matchAll(/\{(\w+)\}/g)) {
      if (placeholder !== undefined && !allowed.includes(placeholder)) {
        throw new Error(
          `config: ${name} has no placeholder {${placeholder}}; it may use ${allowed.map((entry) => `{${entry}}`).join(", ") || "none"}`,
        );
      }
    }
    parsed[command] = argv;
  }
  return parsed;
}

function stringArrays(value: unknown, name: string): string[][] {
  if (!Array.isArray(value))
    throw new Error(`config: ${name} must be an array`);
  return value.map((entry, index) => stringArray(entry, `${name}[${index}]`));
}

/** Parses and validates config TOML, expanding a leading ~ in paths against the home directory. */
export function parseConfig(text: string, home: string): Config {
  const document: Table = parse(text);

  const wires = table(document, "wires", "");
  const wireNames = stringArray(wires.names, "wires.names");
  if (wireNames.length === 0) {
    throw new Error("config: wires.names must name at least one wire");
  }
  const defaultWire = oneOf(
    string(wires, "default", "wires."),
    wireNames,
    "wires.default",
  );
  const local = table(document, "local", "");
  const thresholds = globalThresholds(table(document, "thresholds", ""));
  checkOrder(thresholds, "thresholds.");
  const importance = table(document, "importance", "");
  const tiers = stringArray(importance.tiers, "importance.tiers");
  const defaultTier = oneOf(
    string(importance, "default", "importance."),
    tiers,
    "importance.default",
  );
  const items = optionalTable(document, "items", "");
  const scan = table(document, "scan", "");
  const launch = table(document, "launch", "");
  const sessions = optionalTable(launch, "zellij_sessions", "launch.");
  const forges = table(document, "forges", "");
  const forgejo = table(forges, "forgejo", "forges.");
  const server =
    document.server === undefined ? null : table(document, "server", "");
  const paths = (value: unknown, name: string) =>
    stringArray(value, name).map((path) => expandHome(path, home));

  return {
    wires: { names: wireNames, default: defaultWire },
    local: {
      include: paths(local.include, "local.include"),
      ignore: paths(local.ignore, "local.ignore"),
    },
    joins: stringArrays(document.joins, "joins"),
    ignore: stringArray(document.ignore, "ignore"),
    thresholds,
    importance: { tiers, default: defaultTier },
    items: Object.fromEntries(
      Object.entries(items).map(([id, value]) => [
        id,
        parseEntry(id, value, { tiers, wires: wireNames, thresholds }),
      ]),
    ),
    scan: {
      intervalMinutes: positiveInteger(
        scan.interval_minutes,
        "scan.interval_minutes",
      ),
      archivedIntervalHours: positiveInteger(
        scan.archived_interval_hours,
        "scan.archived_interval_hours",
      ),
    },
    launch: {
      zellijSession: string(launch, "zellij_session", "launch."),
      zellijSessions: Object.fromEntries(
        Object.keys(sessions).map((root) => [
          expandHome(root, home),
          string(sessions, root, "launch.zellij_sessions."),
        ]),
      ),
      commands: parseLaunchCommands(
        optionalTable(launch, "commands", "launch."),
      ),
    },
    forges: {
      finalisedCommits: positiveInteger(
        forges.finalised_commits,
        "forges.finalised_commits",
      ),
      github: parseForge(table(forges, "github", "forges."), "forges.github."),
      forgejo: {
        ...parseForge(forgejo, "forges.forgejo."),
        baseUrl: string(forgejo, "base_url", "forges.forgejo."),
      },
    },
    server:
      server === null
        ? null
        : {
            name: string(server, "name", "server."),
            kumaBaseUrl: string(server, "kuma_base_url", "server."),
            kumaStatusPage: string(server, "kuma_status_page", "server."),
          },
  };
}

/** The configured account for a repository owner, matched without case, or null. */
export function accountForOwner(
  forge: ForgeConfig,
  owner: string,
): ForgeAccount | null {
  return (
    forge.accounts.find(
      (entry) => entry.account.toLowerCase() === owner.toLowerCase(),
    ) ?? null
  );
}

/** The entry an item resolves to, and every key naming the item. */
export interface ResolvedEntry {
  /** The entry that applies, null when no key names the item. */
  entry: ItemEntry | null;
  /** Every key naming the item, the one that applies first; more than one is a conflict. */
  keys: string[];
}

/**
 * The config entry for an item, given its id and presence references: an entry applies when its
 * key names any of them, and the key naming the earliest wins, the id first, ties by key.
 */
export function resolveEntry(
  config: Config,
  id: string,
  refs: readonly string[],
): ResolvedEntry {
  const names = [id, ...refs];
  const ranked = Object.keys(config.items)
    .map((key) => {
      const candidates = [key, ...candidateRefs(key)];
      const rank = names.findIndex((name) => candidates.includes(name));
      return { key, rank };
    })
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || (a.key < b.key ? -1 : 1));
  const keys = ranked.map(({ key }) => key);
  const first = keys[0];
  return {
    entry: first === undefined ? null : (config.items[first] ?? null),
    keys,
  };
}

/** The importance tier for an item: its entry's when one is set, else the default tier. */
export function importanceFor(config: Config, entry: ItemEntry | null): string {
  return entry?.importance ?? config.importance.default;
}

/** The health windows for an item: the global values with its entry's overrides applied. */
export function thresholdsFor(
  config: Config,
  entry: ItemEntry | null,
): Thresholds {
  const overrides = entry?.thresholds ?? {
    unsafe: {},
    stalled: {},
    expectation: {},
  };
  return applyOverrides(config.thresholds, overrides);
}

/** The wire an adopted item sits on; null for an item config does not name, which is on the fence. */
export function wireFor(
  config: Config,
  entry: ItemEntry | null,
): string | null {
  if (entry === null) return null;
  return entry.wire ?? config.wires.default;
}

/**
 * The zellij session for an item at a path: its entry's, else the session of the longest root
 * containing the path, else the launch default.
 */
export function zellijSessionFor(
  config: Config,
  entry: ItemEntry | null,
  path: string,
): string {
  const asserted = entry?.zellijSession;
  if (asserted) return asserted;
  const byRoot = Object.entries(config.launch.zellijSessions)
    .filter(([root]) => path === root || path.startsWith(`${root}/`))
    .sort(([a], [b]) => b.length - a.length)[0];
  return byRoot?.[1] ?? config.launch.zellijSession;
}

/** Where the owner's config lives under a home directory: ~/.config/perch/config.toml. */
export function userConfigPath(home: string): string {
  return `${home}/.config/perch/config.toml`;
}

export interface ConfigDeps {
  /** The home directory a leading ~ in config paths expands to. */
  home: string;
  /** The owner's config, read when it exists. */
  userPath: string;
  /** The example config, read when the owner's does not exist. */
  examplePath: string;
  readText: (path: string) => Promise<string | null>;
}

/** Reads the owner's config when it exists, else the example config. */
export async function loadConfig(deps: ConfigDeps): Promise<LoadedConfig> {
  const { userPath } = deps;
  const userText = await deps.readText(userPath);
  if (userText !== null)
    return { config: parseConfig(userText, deps.home), path: userPath };

  const exampleText = await deps.readText(deps.examplePath);
  if (exampleText === null)
    throw new Error(
      `config: neither ${userPath} nor ${deps.examplePath} exists`,
    );
  return {
    config: parseConfig(exampleText, deps.home),
    path: deps.examplePath,
  };
}
