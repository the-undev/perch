// Serialising config back to TOML, the reverse of parseConfig. No Node modules, so the renderer
// may import it. The output carries no comments; config.example.toml is the commented reference.

import { stringify } from "smol-toml";
import {
  type Config,
  collapseHome,
  defaultTray,
  type GithubSourceConfig,
  type ItemEntry,
  type LaunchActionConfig,
  type ThresholdOverrides,
  type Thresholds,
  thresholdKeys,
} from "./config.ts";
import { commandKinds, customKind, zellijKind } from "./launch-kinds.ts";

type Table = Record<string, unknown>;

/** A record's entries sorted by key, so the order they were added in never reaches the file. */
function sortedByKey<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/** The threshold keys a table sets, in the parser's key order. */
function thresholdTable(thresholds: Thresholds | ThresholdOverrides): Table {
  const out: Table = {};
  for (const [window, field, key] of thresholdKeys) {
    const value = (thresholds[window] as Partial<Record<string, number>>)[
      field
    ];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function entryTable(entry: ItemEntry): Table {
  const out: Table = {};
  if (entry.wire !== null) out.wire = entry.wire;
  if (entry.name !== null) out.name = entry.name;
  if (entry.keyFiles !== null) out.key_files = entry.keyFiles;
  if (entry.roadmaps !== null) out.roadmaps = entry.roadmaps;
  if (entry.zellijSession !== null) out.zellij_session = entry.zellijSession;
  return { ...out, ...thresholdTable(entry.thresholds) };
}

function githubTable(source: GithubSourceConfig): Table {
  return {
    account: source.account,
    key: source.key,
    hosts: source.hosts,
    tracked_forks: source.trackedForks,
  };
}

/** The [[sources.*]] arrays in the order configured; a kind with no source is left out. */
function sourcesTable(
  sources: Config["sources"],
  path: (stored: string) => string,
): Table {
  const out: Table = {
    local: sources.local.map((source) => ({
      include: source.include.map(path),
      exclude: source.exclude.map(path),
    })),
    github: sources.github.map(githubTable),
    forgejo: sources.forgejo.map((source) => ({
      base_url: source.baseUrl,
      ...githubTable(source),
    })),
    kuma: sources.kuma.map((source) => ({
      name: source.name,
      base_url: source.baseUrl,
      status_page: source.statusPage,
    })),
  };
  for (const [kind, list] of Object.entries(out)) {
    if ((list as unknown[]).length === 0) delete out[kind];
  }
  return out;
}

/** The table, or nothing when it is empty: the parser reads a table left out as an empty one. */
function unlessEmpty(table: Table): Table | undefined {
  return Object.keys(table).length === 0 ? undefined : table;
}

/** The value, or nothing when it is the default: config holds only what differs. */
function unlessDefault<T>(value: T, fallback: T): T | undefined {
  return JSON.stringify(value) === JSON.stringify(fallback) ? undefined : value;
}

/**
 * One [[launch.actions]] table: its kind, and what differs from the kind's defaults. A custom
 * command writes its verb and command, and its icon unless it is the folder.
 */
function actionTable(
  action: LaunchActionConfig,
  path: (stored: string) => string,
): Table {
  if (action.kind === "command") {
    return {
      kind: action.kind,
      verb: action.verb,
      command: action.command,
      icon: unlessDefault(action.icon, customKind.icon),
    };
  }
  if (action.kind === "zellij") {
    return {
      kind: action.kind,
      verb: unlessDefault(action.verb, zellijKind.verb),
      zellij: unlessDefault(action.zellij, zellijKind.zellij),
      terminal: unlessDefault(action.terminal, zellijKind.terminal),
      session: unlessDefault(action.session, zellijKind.session),
      sessions: unlessEmpty(
        sortedByKey(
          Object.fromEntries(
            Object.entries(action.sessions).map(([root, session]) => [
              path(root),
              session,
            ]),
          ),
        ),
      ),
    };
  }
  const defaults = commandKinds[action.kind];
  return {
    kind: action.kind,
    verb: unlessDefault(action.verb, defaults.verb),
    command: unlessDefault(action.command, defaults.command),
  };
}

/**
 * Serialises config to TOML that parseConfig reads back to an equal config, deterministic because
 * item entries and zellij session roots are sorted by key and every list, sources and launch
 * actions among them, keeps its order. Paths at or under the home directory are written with a
 * leading ~, empty optional tables, source kinds and launch actions are left out, and so is a
 * launch action's field that holds its kind's default and a window setting that holds its own.
 */
export function writeConfig(config: Config, home: string): string {
  const path = (stored: string) => collapseHome(stored, home);
  const document: Table = {
    joins: config.joins,
    ignore: config.ignore,
    wires: { names: config.wires.names, default: config.wires.default },
    sources: unlessEmpty(sourcesTable(config.sources, path)),
    thresholds: thresholdTable(config.thresholds),
    scan: {
      interval_minutes: config.scan.intervalMinutes,
      finalised_commits: config.scan.finalisedCommits,
    },
    launch:
      config.launch.actions.length === 0
        ? undefined
        : {
            actions: config.launch.actions.map((action) =>
              actionTable(action, path),
            ),
          },
    window: unlessEmpty(
      config.window.tray === defaultTray ? {} : { tray: config.window.tray },
    ),
    items: unlessEmpty(
      Object.fromEntries(
        Object.entries(sortedByKey(config.items)).map(([key, entry]) => [
          key,
          entryTable(entry),
        ]),
      ),
    ),
  };
  return `${stringify(document).trimEnd()}\n`;
}
