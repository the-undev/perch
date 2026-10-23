// Serialising config back to TOML, the reverse of parseConfig. No Node modules, so the renderer
// may import it. The output carries no comments; config.example.toml is the commented reference.

import { stringify } from "smol-toml";
import {
  type Config,
  collapseHome,
  type ForgeConfig,
  type ItemEntry,
  type LaunchCommandName,
  launchPlaceholders,
  type ThresholdOverrides,
  type Thresholds,
  thresholdKeys,
} from "./config.ts";

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
  if (entry.importance !== null) out.importance = entry.importance;
  if (entry.expect.length > 0) out.expect = entry.expect;
  if (entry.keyFiles !== null) out.key_files = entry.keyFiles;
  if (entry.roadmaps !== null) out.roadmaps = entry.roadmaps;
  if (entry.zellijSession !== null) out.zellij_session = entry.zellijSession;
  return { ...out, ...thresholdTable(entry.thresholds) };
}

function forgeTable(forge: ForgeConfig): Table {
  return {
    hosts: forge.hosts,
    accounts: forge.accounts.map(({ account, key }) => ({ account, key })),
    tracked_forks: forge.trackedForks,
  };
}

function commandsTable(commands: Config["launch"]["commands"]): Table {
  const out: Table = {};
  for (const name of Object.keys(launchPlaceholders) as LaunchCommandName[]) {
    const argv = commands[name];
    if (argv !== null) out[name] = argv;
  }
  return out;
}

/** The table, or nothing when it is empty: the parser reads a table left out as an empty one. */
function unlessEmpty(table: Table): Table | undefined {
  return Object.keys(table).length === 0 ? undefined : table;
}

/**
 * Serialises config to TOML that parseConfig reads back to an equal config, deterministic because
 * item entries and zellij session roots are sorted by key and every list keeps its order.
 * Paths at or under the home directory are written with a leading ~, and empty optional tables
 * are left out.
 */
export function writeConfig(config: Config, home: string): string {
  const path = (stored: string) => collapseHome(stored, home);
  const document: Table = {
    joins: config.joins,
    ignore: config.ignore,
    wires: { names: config.wires.names, default: config.wires.default },
    local: {
      include: config.local.include.map(path),
      ignore: config.local.ignore.map(path),
    },
    thresholds: thresholdTable(config.thresholds),
    importance: {
      tiers: config.importance.tiers,
      default: config.importance.default,
    },
    scan: {
      interval_minutes: config.scan.intervalMinutes,
      archived_interval_hours: config.scan.archivedIntervalHours,
    },
    launch: {
      zellij_session: config.launch.zellijSession,
      zellij_sessions: unlessEmpty(
        sortedByKey(
          Object.fromEntries(
            Object.entries(config.launch.zellijSessions).map(
              ([root, session]) => [path(root), session],
            ),
          ),
        ),
      ),
      commands: unlessEmpty(commandsTable(config.launch.commands)),
    },
    items: unlessEmpty(
      Object.fromEntries(
        Object.entries(sortedByKey(config.items)).map(([key, entry]) => [
          key,
          entryTable(entry),
        ]),
      ),
    ),
    forges: {
      finalised_commits: config.forges.finalisedCommits,
      github: forgeTable(config.forges.github),
      forgejo: {
        base_url: config.forges.forgejo.baseUrl,
        ...forgeTable(config.forges.forgejo),
      },
    },
  };
  if (config.server !== null) {
    document.server = {
      name: config.server.name,
      kuma_base_url: config.server.kumaBaseUrl,
      kuma_status_page: config.server.kumaStatusPage,
    };
  }
  return `${stringify(document).trimEnd()}\n`;
}
