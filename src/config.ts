import { join } from "node:path";
import { parse } from "smol-toml";
import type { DriftThresholds } from "./snapshot.ts";

export interface ItemOverride {
  importance: string | null;
  drift: Partial<DriftThresholds>;
  /** Roadmap files relative to the item, replacing the standard names; null keeps them. */
  roadmaps: string[] | null;
}

export interface ForgeAccount {
  account: string;
  /** Remote hosts or SSH aliases whose repositories this account's token reads. */
  hosts: string[];
}

export interface ForgeConfig {
  accounts: ForgeAccount[];
  /** Forks worth tracking, as owner/name; every other fork is skipped. */
  trackedForks: string[];
}

export interface Config {
  local: { include: string[]; ignore: string[] };
  /** Groups of presence references asserted to be one project. */
  joins: string[][];
  /** Presence references to leave off the main view. */
  ignore: string[];
  drift: DriftThresholds;
  importance: { tiers: string[]; default: string };
  /** Per-item overrides keyed by item id; a key here also marks a found repository as set up. */
  items: Record<string, ItemOverride>;
  forges: {
    finalisedCommits: number;
    archivedIntervalHours: number;
    github: ForgeConfig;
    forgejo: ForgeConfig & { baseUrl: string };
  };
  server: { name: string; kumaBaseUrl: string; kumaStatusPage: string };
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

function expandHome(path: string, home: string): string {
  if (path === "~") return home;
  if (path.startsWith("~/")) return join(home, path.slice(2));
  return path;
}

function parseOverride(
  id: string,
  value: unknown,
  tiers: readonly string[],
): ItemOverride {
  if (!isTable(value)) throw new Error(`config: items."${id}" must be a table`);
  const importance = value.importance === undefined ? null : value.importance;
  if (
    importance !== null &&
    (typeof importance !== "string" || !tiers.includes(importance))
  ) {
    throw new Error(
      `config: items."${id}".importance must be one of ${tiers.join(", ")}`,
    );
  }
  const drift: Partial<DriftThresholds> = {};
  if (value.drift_amber_days !== undefined) {
    drift.amberDays = positiveInteger(
      value.drift_amber_days,
      `items."${id}".drift_amber_days`,
    );
  }
  if (value.drift_red_days !== undefined) {
    drift.redDays = positiveInteger(
      value.drift_red_days,
      `items."${id}".drift_red_days`,
    );
  }
  const roadmaps =
    value.roadmaps === undefined
      ? null
      : stringArray(value.roadmaps, `items."${id}".roadmaps`);
  return { importance, drift, roadmaps };
}

function parseForge(forge: Table, where: string): ForgeConfig {
  const accounts = forge.accounts;
  if (!Array.isArray(accounts)) {
    throw new Error(`config: ${where}accounts must be an array of tables`);
  }
  return {
    accounts: accounts.map((entry, index) => {
      const name = `${where}accounts[${index}]`;
      if (!isTable(entry)) throw new Error(`config: ${name} must be a table`);
      return {
        account: string(entry, "account", `${name}.`),
        hosts: stringArray(entry.hosts, `${name}.hosts`),
      };
    }),
    trackedForks: stringArray(forge.tracked_forks, `${where}tracked_forks`),
  };
}

function stringArrays(value: unknown, name: string): string[][] {
  if (!Array.isArray(value))
    throw new Error(`config: ${name} must be an array`);
  return value.map((entry, index) => stringArray(entry, `${name}[${index}]`));
}

/** Parses and validates config TOML, expanding a leading ~ in paths against the home directory. */
export function parseConfig(text: string, home: string): Config {
  const document: Table = parse(text);

  const local = table(document, "local", "");
  const drift = table(document, "drift", "");
  const importance = table(document, "importance", "");
  const tiers = stringArray(importance.tiers, "importance.tiers");
  const defaultTier = string(importance, "default", "importance.");
  if (!tiers.includes(defaultTier)) {
    throw new Error(
      `config: importance.default must be one of ${tiers.join(", ")}`,
    );
  }
  const items = optionalTable(document, "items", "");
  const forges = table(document, "forges", "");
  const forgejo = table(forges, "forgejo", "forges.");
  const server = table(document, "server", "");
  const paths = (value: unknown, name: string) =>
    stringArray(value, name).map((path) => expandHome(path, home));

  return {
    local: {
      include: paths(local.include, "local.include"),
      ignore: paths(local.ignore, "local.ignore"),
    },
    joins: stringArrays(document.joins, "joins"),
    ignore: stringArray(document.ignore, "ignore"),
    drift: {
      amberDays: positiveInteger(drift.amber_days, "drift.amber_days"),
      redDays: positiveInteger(drift.red_days, "drift.red_days"),
    },
    importance: { tiers, default: defaultTier },
    items: Object.fromEntries(
      Object.entries(items).map(([id, value]) => [
        id,
        parseOverride(id, value, tiers),
      ]),
    ),
    forges: {
      finalisedCommits: positiveInteger(
        forges.finalised_commits,
        "forges.finalised_commits",
      ),
      archivedIntervalHours: positiveInteger(
        forges.archived_interval_hours,
        "forges.archived_interval_hours",
      ),
      github: parseForge(table(forges, "github", "forges."), "forges.github."),
      forgejo: {
        ...parseForge(forgejo, "forges.forgejo."),
        baseUrl: string(forgejo, "base_url", "forges.forgejo."),
      },
    },
    server: {
      name: string(server, "name", "server."),
      kumaBaseUrl: string(server, "kuma_base_url", "server."),
      kumaStatusPage: string(server, "kuma_status_page", "server."),
    },
  };
}

/** Maps each remote host of a forge to the account whose token reads it. */
export function hostAccounts(forge: ForgeConfig): Record<string, string> {
  return Object.fromEntries(
    forge.accounts.flatMap((entry) =>
      entry.hosts.map((host) => [host, entry.account]),
    ),
  );
}

/** The importance tier for an item: its override when one is set, else the default tier. */
export function importanceFor(config: Config, itemId: string): string {
  return config.items[itemId]?.importance ?? config.importance.default;
}

/** The drift thresholds for an item: the global values with any per-item override applied. */
export function driftThresholdsFor(
  config: Config,
  itemId: string,
): DriftThresholds {
  const override = config.items[itemId]?.drift ?? {};
  return {
    amberDays: override.amberDays ?? config.drift.amberDays,
    redDays: override.redDays ?? config.drift.redDays,
  };
}

export interface ConfigDeps {
  home: string;
  examplePath: string;
  readText: (path: string) => Promise<string | null>;
}

/** Reads ~/.config/perch/config.toml when it exists, else the example config in the repository. */
export async function loadConfig(deps: ConfigDeps): Promise<LoadedConfig> {
  const userPath = join(deps.home, ".config", "perch", "config.toml");
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
