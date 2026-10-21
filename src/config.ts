import { join } from "node:path";
import { parse } from "smol-toml";
import type { DriftThresholds } from "./snapshot.ts";

export type RootKind = "repo" | "vault";

export interface RootConfig {
  /** Absolute path, with a leading ~ expanded. */
  path: string;
  /** A repo root is searched for repositories; a vault root is itself one vault item. */
  kind: RootKind;
  /** Roadmap files relative to a vault root; empty for repo roots, which use the standard names. */
  roadmaps: string[];
}

export interface ItemOverride {
  importance: string | null;
  drift: Partial<DriftThresholds>;
}

export interface Config {
  roots: RootConfig[];
  excludeSegments: string[];
  drift: DriftThresholds;
  importance: { tiers: string[]; default: string };
  items: Record<string, ItemOverride>;
  github: { hostAccounts: Record<string, string> };
  forgejo: { baseUrl: string; remoteHosts: string[] };
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

function stringRecord(value: Table, name: string): Record<string, string> {
  const entries = Object.entries(value).map(([key, entry]) => {
    if (typeof entry !== "string")
      throw new Error(`config: ${name}.${key} must be a string`);
    return [key, entry] as const;
  });
  return Object.fromEntries(entries);
}

function expandHome(path: string, home: string): string {
  if (path === "~") return home;
  if (path.startsWith("~/")) return join(home, path.slice(2));
  return path;
}

function parseRoot(value: unknown, index: number, home: string): RootConfig {
  const where = `roots[${index}].`;
  if (!isTable(value))
    throw new Error(`config: roots[${index}] must be a table`);
  const kind = string(value, "kind", where);
  if (kind !== "repo" && kind !== "vault") {
    throw new Error(`config: ${where}kind must be "repo" or "vault"`);
  }
  const roadmaps =
    value.roadmaps === undefined
      ? []
      : stringArray(value.roadmaps, `${where}roadmaps`);
  return {
    path: expandHome(string(value, "path", where), home),
    kind,
    roadmaps,
  };
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
  return { importance, drift };
}

/** Parses and validates config TOML, expanding ~ in root paths against the given home directory. */
export function parseConfig(text: string, home: string): Config {
  const document: Table = parse(text);

  const scan = table(document, "scan", "");
  const roots = document.roots;
  if (!Array.isArray(roots))
    throw new Error("config: roots must be an array of tables");

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
  const github = table(document, "github", "");
  const forgejo = table(document, "forgejo", "");
  const server = table(document, "server", "");

  return {
    roots: roots.map((root, index) => parseRoot(root, index, home)),
    excludeSegments: stringArray(
      scan.exclude_segments,
      "scan.exclude_segments",
    ),
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
    github: {
      hostAccounts: stringRecord(
        table(github, "host_accounts", "github."),
        "github.host_accounts",
      ),
    },
    forgejo: {
      baseUrl: string(forgejo, "base_url", "forgejo."),
      remoteHosts: stringArray(forgejo.remote_hosts, "forgejo.remote_hosts"),
    },
    server: {
      name: string(server, "name", "server."),
      kumaBaseUrl: string(server, "kuma_base_url", "server."),
      kumaStatusPage: string(server, "kuma_status_page", "server."),
    },
  };
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
