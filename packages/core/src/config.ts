// The config model: what the owner asserts that leaves no trace on disk or on a forge. Parsing
// uses no Node modules, so the renderer may import the lookups below.

import { parse } from "smol-toml";
import {
  type CommandKind,
  commandKinds,
  customKind,
  type IconName,
  type LaunchKind,
  launchKinds,
  lineIcons,
  zellijKind,
} from "./launch-kinds.ts";
import { candidateRefs } from "./refs.ts";
import type {
  CountThresholds,
  DayThresholds,
  HourThresholds,
} from "./snapshot.ts";

/** The health windows: unsafe work in hours, stalled flight in days, open bugs and critical bugs in counts. */
export interface Thresholds {
  unsafe: HourThresholds;
  stalled: DayThresholds;
  bugs: CountThresholds;
  criticalBugs: CountThresholds;
}

/** Per-item threshold overrides; anything left out takes the global value. */
export interface ThresholdOverrides {
  unsafe: Partial<HourThresholds>;
  stalled: Partial<DayThresholds>;
  bugs: Partial<CountThresholds>;
  criticalBugs: Partial<CountThresholds>;
}

/** The word lists that make a task a bug or a critical bug; null takes the list below. */
export interface WorkWordsConfig {
  bugWords: string[] | null;
  criticalBugWords: string[] | null;
}

/** The word lists an item's work is classed by, each taken whole from one place. */
export interface WorkWords {
  bug: string[];
  criticalBug: string[];
}

/** The words that make a bug when neither the entry nor [work] sets the list. */
export const builtInBugWords: readonly string[] = [
  "bug",
  "bugs",
  "issue",
  "issues",
  "problem",
  "problems",
  "broken",
  "regression",
  "crash",
  "crashes",
  "p2",
  "p3",
  "p4",
];

/** The words that make a critical bug when neither the entry nor [work] sets the list. */
export const builtInCriticalBugWords: readonly string[] = [
  "critical",
  "urgent",
  "severe",
  "blocker",
  "p0",
  "p1",
];

/** The bug thresholds [thresholds] takes when it leaves them out. */
export const defaultBugThresholds: Pick<Thresholds, "bugs" | "criticalBugs"> = {
  bugs: { amberCount: 5, redCount: 20 },
  criticalBugs: { amberCount: 1, redCount: 3 },
};

/** An item's entry in config. Having one adopts the bird, which puts it on a wire. */
export interface ItemEntry {
  /** The wire the bird sits on; null puts it on the default wire. */
  wire: string | null;
  /** The name the bird goes by; null keeps the scanned name. */
  name: string | null;
  thresholds: ThresholdOverrides;
  /** Files for the detail page, relative to the item; null keeps the README and any roadmap. */
  keyFiles: string[] | null;
  /** Roadmap files relative to the item, the only files parsed as roadmaps; null or empty parses none. */
  roadmaps: string[] | null;
  /** The zellij session holding the item's tab; null takes it from the zellij action. */
  zellijSession: string | null;
  /** Words making a bug, replacing the [work] list; null keeps it. */
  bugWords: string[] | null;
  /** Words making a critical bug, replacing the [work] list; null keeps it. */
  criticalBugWords: string[] | null;
}

/** A local source: repositories found at or under its include paths, home expanded. */
export interface LocalSourceConfig {
  /** Each a repository, or a directory searched for repositories. */
  include: string[];
  /** Nothing at or below these paths is searched. */
  exclude: string[];
}

/** A GitHub account, read with its own read-only token. */
export interface GithubSourceConfig {
  /** The user or organisation whose own repositories this account lists. */
  account: string;
  /** The keyring key, under service perch, holding the account's read-only token. */
  key: string;
  /** Remote hosts or SSH aliases that reach this account's repositories. */
  hosts: string[];
  /** Forks worth tracking, as owner/name; every other fork is skipped. */
  trackedForks: string[];
}

/** A Forgejo account on the instance at its base URL. */
export interface ForgejoSourceConfig extends GithubSourceConfig {
  baseUrl: string;
}

/** An Uptime Kuma status page, monitored as the server it names. */
export interface KumaSourceConfig {
  /** The server's name, which is also the source's identity. */
  name: string;
  baseUrl: string;
  statusPage: string;
}

/** Every source config declares, each kind in the order configured. */
export interface SourcesConfig {
  local: LocalSourceConfig[];
  github: GithubSourceConfig[];
  forgejo: ForgejoSourceConfig[];
  kuma: KumaSourceConfig[];
}

export interface Config {
  /** The wires top to bottom, and the one an adopted item sits on when its entry names none. */
  wires: { names: string[]; default: string };
  sources: SourcesConfig;
  /** Groups of presence references asserted to be one project. */
  joins: string[][];
  /** Presence references to leave off the main view. */
  ignore: string[];
  thresholds: Thresholds;
  /** The [work] table's word lists, which an entry's own lists replace. */
  work: WorkWordsConfig;
  /**
   * Item entries keyed by any of the item's presence references (see resolveEntry); an entry
   * adopts the item and marks a found repository set up.
   */
  items: Record<string, ItemEntry>;
  /** The scan interval, and the commits read on each forge repository's default branch. */
  scan: {
    intervalMinutes: number;
    finalisedCommits: number;
  };
  launch: {
    /** The launch actions in the order a bird offers them; none is offered until one is added. */
    actions: LaunchActionConfig[];
  };
  window: {
    /** The window lives in the tray: closing hides it, and the tray icon shows it. */
    tray: boolean;
  };
  update: {
    /** Each scan, at most hourly, reads the latest release and says when it is newer. */
    check: boolean;
    /** A newer release is downloaded and replaces the running AppImage. */
    install: boolean;
  };
}

/** The window stays in the tray unless config says otherwise. */
export const defaultTray = true;

/** The release check runs unless config says otherwise. */
export const defaultUpdateCheck = true;

/** Updates are only pointed at unless config says otherwise. */
export const defaultUpdateInstall = false;

/**
 * An action of a kind that runs one command detached, without a shell, its placeholders filled in:
 * VS Code, nvim, the folder or Obsidian. Config holds only what differs from the kind's defaults.
 */
export interface KindActionConfig {
  kind: CommandKind;
  /** The words on the bird's page. */
  verb: string;
  command: string[];
}

/** A custom command: its words and command its own, and the line icon it wears. */
export interface CommandActionConfig {
  kind: "command";
  verb: string;
  command: string[];
  icon: IconName;
}

/** The zellij tab action: goes to the item's tab in its session, or opens one there. */
export interface ZellijActionConfig {
  kind: "zellij";
  /** The words on the bird's page. */
  verb: string;
  /** zellij itself, asked for the running sessions and their tabs. */
  zellij: string[];
  /** Opens a terminal attached to a session that is not running. */
  terminal: string[];
  /** The session for an item no root or entry assigns. */
  session: string;
  /** Sessions by root directory, home expanded; the longest root containing the item wins. */
  sessions: Record<string, string>;
}

export type LaunchActionConfig =
  | KindActionConfig
  | CommandActionConfig
  | ZellijActionConfig;

/** The placeholders an argument list uses, each once, in order. */
export function placeholdersIn(argv: readonly string[]): string[] {
  return [
    ...new Set(
      argv.flatMap((part) =>
        [...part.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? ""),
      ),
    ),
  ];
}

/**
 * Whether an action is offered on Obsidian birds only: the Obsidian kind always, and a custom
 * command using {obsidian}.
 */
export function obsidianOnly(
  action: KindActionConfig | CommandActionConfig,
): boolean {
  if (action.kind === "command") {
    return placeholdersIn(action.command).includes("obsidian");
  }
  return commandKinds[action.kind].obsidianOnly;
}

/** Why an argument list cannot be a launch command using only the placeholders allowed; null when it can. */
export function launchCommandProblem(
  argv: readonly string[],
  allowed: readonly string[],
): string | null {
  const [program] = argv;
  if (program === undefined || program.trim() === "") {
    return "must name a program first";
  }
  const stray = placeholdersIn(argv).find((name) => !allowed.includes(name));
  if (stray === undefined) return null;
  const may = allowed.map((name) => `{${name}}`).join(" and ") || "none";
  return `has no placeholder {${stray}}; it may use ${may}`;
}

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

function optionalBoolean(
  parent: Table,
  key: string,
  where: string,
  fallback: boolean,
): boolean {
  const value = parent[key];
  if (value === undefined) return fallback;
  if (typeof value !== "boolean")
    throw new Error(`config: ${where}${key} must be true or false`);
  return value;
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
  ["bugs", "amberCount", "bugs_amber_count"],
  ["bugs", "redCount", "bugs_red_count"],
  ["criticalBugs", "amberCount", "critical_bugs_amber_count"],
  ["criticalBugs", "redCount", "critical_bugs_red_count"],
] as const;

/** Per-item threshold overrides that set nothing. */
export function noThresholdOverrides(): ThresholdOverrides {
  return { unsafe: {}, stalled: {}, bugs: {}, criticalBugs: {} };
}

/** Reads the threshold keys present in a table. */
function thresholdOverrides(source: Table, where: string): ThresholdOverrides {
  const overrides = noThresholdOverrides();
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
    bugs: { ...base.bugs, ...overrides.bugs },
    criticalBugs: { ...base.criticalBugs, ...overrides.criticalBugs },
  };
}

/** Amber must open before red, or the amber window would never show. */
function checkOrder(thresholds: Thresholds, where: string): void {
  const pairs: [string, number, number][] = [
    ["unsafe", thresholds.unsafe.amberHours, thresholds.unsafe.redHours],
    ["stalled", thresholds.stalled.amberDays, thresholds.stalled.redDays],
    ["bugs", thresholds.bugs.amberCount, thresholds.bugs.redCount],
    [
      "critical bugs",
      thresholds.criticalBugs.amberCount,
      thresholds.criticalBugs.redCount,
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
  onlyKeys(
    source,
    thresholdKeys.map(([, , key]) => key),
    "thresholds.",
  );
  const read = (key: string) =>
    positiveInteger(source[key], `thresholds.${key}`);
  const unsafeAndStalled = {
    unsafe: {
      amberHours: read("unsafe_amber_hours"),
      redHours: read("unsafe_red_hours"),
    },
    stalled: {
      amberDays: read("stalled_amber_days"),
      redDays: read("stalled_red_days"),
    },
  };
  // The bug thresholds came later than the rest, so a config written before them leaves them out.
  return applyOverrides(
    { ...unsafeAndStalled, ...defaultBugThresholds },
    thresholdOverrides(source, "thresholds."),
  );
}

/** Reads an optional list of words, each whole and not blank. */
function optionalWords(
  source: Table,
  key: string,
  where: string,
): string[] | null {
  if (source[key] === undefined) return null;
  const words = stringArray(source[key], `${where}${key}`);
  if (words.some((word) => word.trim() === "")) {
    throw new Error(`config: ${where}${key} must not hold a blank word`);
  }
  return words;
}

/** The word list keys, the same in [work] and in an item entry. */
const workWordKeys = ["bug_words", "critical_bug_words"] as const;

function parseWork(document: Table): WorkWordsConfig {
  const work = optionalTable(document, "work", "");
  onlyKeys(work, workWordKeys, "work.");
  return {
    bugWords: optionalWords(work, "bug_words", "work."),
    criticalBugWords: optionalWords(work, "critical_bug_words", "work."),
  };
}

/** Every key an item entry may hold. */
const entryKeys = [
  "wire",
  "name",
  "key_files",
  "roadmaps",
  "zellij_session",
  ...workWordKeys,
  ...thresholdKeys.map(([, , key]) => key),
];

function parseEntry(
  id: string,
  value: unknown,
  context: {
    wires: readonly string[];
    thresholds: Thresholds;
  },
): ItemEntry {
  const where = `items."${id}".`;
  if (!isTable(value)) throw new Error(`config: items."${id}" must be a table`);
  onlyKeys(value, entryKeys, where);
  const wire = optionalString(value, "wire", where);
  if (wire !== null) oneOf(wire, context.wires, `${where}wire`);
  const thresholds = thresholdOverrides(value, where);
  checkOrder(applyOverrides(context.thresholds, thresholds), where);
  const list = (key: string) =>
    value[key] === undefined ? null : stringArray(value[key], `${where}${key}`);
  return {
    wire,
    name: optionalString(value, "name", where),
    thresholds,
    keyFiles: list("key_files"),
    roadmaps: list("roadmaps"),
    zellijSession: optionalString(value, "zellij_session", where),
    bugWords: optionalWords(value, "bug_words", where),
    criticalBugWords: optionalWords(value, "critical_bug_words", where),
  };
}

/** Throws on a key the table may not hold, naming it. */
function onlyKeys(source: Table, allowed: readonly string[], where: string) {
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) {
      throw new Error(`config: ${where}${key} is not a config key`);
    }
  }
}

/** The tables of one source kind, each passed to read with its position; none when absent. */
function cards<T>(
  sources: Table,
  kind: keyof SourcesConfig,
  read: (card: Table, where: string) => T,
): T[] {
  const value = sources[kind];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`config: sources.${kind} must be an array of tables`);
  }
  return value.map((card, index) => {
    const where = `sources.${kind}[${index}]`;
    if (!isTable(card)) throw new Error(`config: ${where} must be a table`);
    return read(card, `${where}.`);
  });
}

function optionalStrings(source: Table, key: string, where: string): string[] {
  if (source[key] === undefined) return [];
  return stringArray(source[key], `${where}${key}`);
}

const githubKeys = ["account", "key", "hosts", "tracked_forks"] as const;

function parseGithubSource(card: Table, where: string): GithubSourceConfig {
  return {
    account: string(card, "account", where),
    key: string(card, "key", where),
    hosts: stringArray(card.hosts, `${where}hosts`),
    trackedForks: optionalStrings(card, "tracked_forks", where),
  };
}

/** Throws when two sources share an identity, naming the kind and the identity. */
function checkDistinct<T>(
  kind: string,
  sources: readonly T[],
  identity: (source: T) => string,
  shown: (source: T) => string,
): void {
  const seen = new Set<string>();
  for (const source of sources) {
    const id = identity(source);
    if (seen.has(id)) {
      throw new Error(
        `config: two sources.${kind} tables name ${shown(source)}; each may appear once`,
      );
    }
    seen.add(id);
  }
}

function parseSources(document: Table, home: string): SourcesConfig {
  const sources = optionalTable(document, "sources", "");
  onlyKeys(sources, ["local", "github", "forgejo", "kuma"], "sources.");
  const paths = (card: Table, key: string, where: string) =>
    optionalStrings(card, key, where).map((path) => expandHome(path, home));
  const parsed: SourcesConfig = {
    local: cards(sources, "local", (card, where) => {
      onlyKeys(card, ["include", "exclude"], where);
      return {
        include: stringArray(card.include, `${where}include`).map((path) =>
          expandHome(path, home),
        ),
        exclude: paths(card, "exclude", where),
      };
    }),
    github: cards(sources, "github", (card, where) => {
      onlyKeys(card, githubKeys, where);
      return parseGithubSource(card, where);
    }),
    forgejo: cards(sources, "forgejo", (card, where) => {
      onlyKeys(card, [...githubKeys, "base_url"], where);
      return {
        ...parseGithubSource(card, where),
        baseUrl: string(card, "base_url", where),
      };
    }),
    kuma: cards(sources, "kuma", (card, where) => {
      onlyKeys(card, ["name", "base_url", "status_page"], where);
      return {
        name: string(card, "name", where),
        baseUrl: string(card, "base_url", where),
        statusPage: string(card, "status_page", where),
      };
    }),
  };
  checkDistinct(
    "github",
    parsed.github,
    (source) => source.account.toLowerCase(),
    (source) => `account ${source.account}`,
  );
  checkDistinct(
    "forgejo",
    parsed.forgejo,
    (source) => `${source.account.toLowerCase()} ${source.baseUrl}`,
    (source) => `account ${source.account} at ${source.baseUrl}`,
  );
  for (const kind of ["github", "forgejo"] as const) {
    checkDistinct(
      kind,
      parsed[kind],
      (source) => source.key,
      (source) => `keyring key ${source.key}`,
    );
  }
  checkDistinct(
    "kuma",
    parsed.kuma,
    (source) => source.name,
    (source) => `name ${source.name}`,
  );
  return parsed;
}

/**
 * One [[launch.actions]] table: its kind, and only what differs from the kind's defaults, bar a
 * custom command, which names its verb and command and may pick its icon.
 */
function parseLaunchAction(
  value: unknown,
  where: string,
  home: string,
): LaunchActionConfig {
  if (!isTable(value)) throw new Error(`config: ${where} must be a table`);
  const at = `${where}.`;
  const kind = oneOf(
    string(value, "kind", at),
    launchKinds,
    `${at}kind`,
  ) as LaunchKind;
  const verb = (fallback: string | null) => {
    if (value.verb === undefined && fallback !== null) return fallback;
    const words = string(value, "verb", at);
    if (words.trim() === "") {
      throw new Error(`config: ${at}verb must not be blank`);
    }
    return words;
  };
  const argv = (
    key: string,
    fallback: readonly string[] | null,
    allowed: readonly string[],
  ) => {
    if (value[key] === undefined && fallback !== null) return [...fallback];
    const list = stringArray(value[key], `${at}${key}`);
    const problem = launchCommandProblem(list, allowed);
    if (problem !== null) throw new Error(`config: ${at}${key} ${problem}`);
    return list;
  };
  if (kind === "command") {
    onlyKeys(value, ["kind", "verb", "command", "icon"], at);
    return {
      kind,
      verb: verb(null),
      command: argv("command", null, customKind.placeholders),
      icon:
        value.icon === undefined
          ? customKind.icon
          : (oneOf(
              string(value, "icon", at),
              lineIcons,
              `${at}icon`,
            ) as IconName),
    };
  }
  if (kind === "zellij") {
    onlyKeys(
      value,
      ["kind", "verb", "zellij", "terminal", "session", "sessions"],
      at,
    );
    const sessions = optionalTable(value, "sessions", at);
    return {
      kind,
      verb: verb(zellijKind.verb),
      zellij: argv("zellij", zellijKind.zellij, zellijKind.placeholders.zellij),
      terminal: argv(
        "terminal",
        zellijKind.terminal,
        zellijKind.placeholders.terminal,
      ),
      session:
        value.session === undefined
          ? zellijKind.session
          : string(value, "session", at),
      sessions: Object.fromEntries(
        Object.keys(sessions).map((root) => [
          expandHome(root, home),
          string(sessions, root, `${at}sessions.`),
        ]),
      ),
    };
  }
  onlyKeys(value, ["kind", "verb", "command"], at);
  const defaults = commandKinds[kind];
  return {
    kind,
    verb: verb(defaults.verb),
    command: argv("command", defaults.command, defaults.placeholders),
  };
}

/** The [launch] table, its actions in order and at most one of them zellij; none when absent. */
function parseLaunch(document: Table, home: string): Config["launch"] {
  const launch = optionalTable(document, "launch", "");
  onlyKeys(launch, ["actions"], "launch.");
  const tables = launch.actions ?? [];
  if (!Array.isArray(tables)) {
    throw new Error("config: launch.actions must be an array of tables");
  }
  const actions = tables.map((value, index) =>
    parseLaunchAction(value, `launch.actions[${index}]`, home),
  );
  if (actions.filter((action) => action.kind === "zellij").length > 1) {
    throw new Error(
      "config: launch.actions holds two zellij actions; there may be one",
    );
  }
  return { actions };
}

function stringArrays(value: unknown, name: string): string[][] {
  if (!Array.isArray(value))
    throw new Error(`config: ${name} must be an array`);
  return value.map((entry, index) => stringArray(entry, `${name}[${index}]`));
}

/** Every key config may hold at its top level. */
const topLevelKeys = [
  "wires",
  "sources",
  "joins",
  "ignore",
  "thresholds",
  "work",
  "items",
  "scan",
  "launch",
  "window",
  "update",
] as const;

/** Parses and validates config TOML, expanding a leading ~ in paths against the home directory. */
export function parseConfig(text: string, home: string): Config {
  const document: Table = parse(text);
  onlyKeys(document, topLevelKeys, "");

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
  const thresholds = globalThresholds(table(document, "thresholds", ""));
  checkOrder(thresholds, "thresholds.");
  const items = optionalTable(document, "items", "");
  const scan = table(document, "scan", "");
  onlyKeys(scan, ["interval_minutes", "finalised_commits"], "scan.");
  const windowTable = optionalTable(document, "window", "");
  onlyKeys(windowTable, ["tray"], "window.");
  const updateTable = optionalTable(document, "update", "");
  onlyKeys(updateTable, ["check", "install"], "update.");

  return {
    wires: { names: wireNames, default: defaultWire },
    sources: parseSources(document, home),
    joins: stringArrays(document.joins, "joins"),
    ignore: stringArray(document.ignore, "ignore"),
    thresholds,
    work: parseWork(document),
    items: Object.fromEntries(
      Object.entries(items).map(([id, value]) => [
        id,
        parseEntry(id, value, { wires: wireNames, thresholds }),
      ]),
    ),
    scan: {
      intervalMinutes: positiveInteger(
        scan.interval_minutes,
        "scan.interval_minutes",
      ),
      finalisedCommits: positiveInteger(
        scan.finalised_commits,
        "scan.finalised_commits",
      ),
    },
    launch: parseLaunch(document, home),
    window: {
      tray: optionalBoolean(windowTable, "tray", "window.", defaultTray),
    },
    update: {
      check: optionalBoolean(
        updateTable,
        "check",
        "update.",
        defaultUpdateCheck,
      ),
      install: optionalBoolean(
        updateTable,
        "install",
        "update.",
        defaultUpdateInstall,
      ),
    },
  };
}

/** The configured source for a repository owner, its account matched without case, or null. */
export function accountForOwner<S extends { account: string }>(
  sources: readonly S[],
  owner: string,
): S | null {
  return (
    sources.find(
      (source) => source.account.toLowerCase() === owner.toLowerCase(),
    ) ?? null
  );
}

/** Every remote host or SSH alias the sources of one forge name, each once, in order. */
export function hostsOf(sources: readonly { hosts: string[] }[]): string[] {
  return [...new Set(sources.flatMap((source) => source.hosts))];
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

/** The health windows for an item: the global values with its entry's overrides applied. */
export function thresholdsFor(
  config: Config,
  entry: ItemEntry | null,
): Thresholds {
  const overrides = entry?.thresholds ?? noThresholdOverrides();
  return applyOverrides(config.thresholds, overrides);
}

/** The word lists for an item: each from its entry if set, else from [work], else built in. */
export function workWordsFor(
  config: Config,
  entry: ItemEntry | null,
): WorkWords {
  return {
    bug: [...(entry?.bugWords ?? config.work.bugWords ?? builtInBugWords)],
    criticalBug: [
      ...(entry?.criticalBugWords ??
        config.work.criticalBugWords ??
        builtInCriticalBugWords),
    ],
  };
}

/** The wire an adopted item sits on; null for an item config does not name, which is on the fence. */
export function wireFor(
  config: Config,
  entry: ItemEntry | null,
): string | null {
  if (entry === null) return null;
  return entry.wire ?? config.wires.default;
}

/** The config's zellij action, or null when it has none. */
export function zellijActionOf(config: Config): ZellijActionConfig | null {
  return (
    config.launch.actions.find(
      (action): action is ZellijActionConfig => action.kind === "zellij",
    ) ?? null
  );
}

/**
 * The zellij session for an item at a path: its entry's, else the session of the action's longest
 * root containing the path, else the action's default.
 */
export function zellijSessionFor(
  action: ZellijActionConfig,
  entry: ItemEntry | null,
  path: string,
): string {
  const asserted = entry?.zellijSession;
  if (asserted) return asserted;
  const byRoot = Object.entries(action.sessions)
    .filter(([root]) => path === root || path.startsWith(`${root}/`))
    .sort(([a], [b]) => b.length - a.length)[0];
  return byRoot?.[1] ?? action.session;
}

/** Where the owner's config lives under a home directory: ~/.config/perch/config.toml. */
export function userConfigPath(home: string): string {
  return `${home}/.config/perch/config.toml`;
}

export interface ConfigDeps {
  /** The home directory a leading ~ in config paths expands to. */
  home: string;
  /** The owner's config. */
  userPath: string;
  readText: (path: string) => Promise<string | null>;
}

/** Reads the owner's config, or null when the file does not exist. */
export async function loadConfig(
  deps: ConfigDeps,
): Promise<LoadedConfig | null> {
  const text = await deps.readText(deps.userPath);
  if (text === null) return null;
  return { config: parseConfig(text, deps.home), path: deps.userPath };
}
