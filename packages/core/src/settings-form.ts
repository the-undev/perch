// The config but the item entries as the settings page edits it: the values the form holds, what
// they cannot be, and the edit that puts them back into config. No Node modules, so the renderer
// may import it.

import {
  type Config,
  collapseHome,
  expandHome,
  type ItemEntry,
  type SourcesConfig,
  type Thresholds,
} from "./config.ts";
import {
  flatThresholds,
  nestedThresholds,
  type ThresholdKey,
  thresholdProblems,
} from "./entry-form.ts";
import {
  type LaunchActionValues,
  launchConfigOf,
  launchProblemLine,
  launchProblems,
  launchValuesOf,
} from "./launch-form.ts";
import { listLine, listOf, parseListLine } from "./list-line.ts";
import { sourceProblemLine, sourceProblems } from "./sources-form.ts";

/** A wire on the settings page: the config wire it started as, null for one added, and its name now. */
export interface WireRow {
  from: string | null;
  name: string;
}

/** Everything in config but the item entries, which each bird's page edits. */
export interface SettingsValues {
  /** The wires top to bottom, and the default by its row's place among them. */
  wires: { rows: WireRow[]; defaultRow: number };
  /** Config's source tables, each kind in order, paths written with ~. */
  sources: SourcesConfig;
  thresholds: Record<ThresholdKey, number>;
  scan: {
    intervalMinutes: number;
    finalisedCommits: number;
  };
  launch: {
    /** One card per launch action, in the order a bird offers them. */
    actions: LaunchActionValues[];
  };
  /** Each join's presence references as one list line. */
  joins: string[];
  /** Presence references left off the main view. */
  ignore: string[];
}

/** What the settings page needs: the values, and which item entries name each wire. */
export interface SettingsForm {
  values: SettingsValues;
  /** The keys of the entries naming each config wire, which removing it moves to the default. */
  named: { wires: Record<string, string[]> };
}

function namedBy(
  items: Record<string, ItemEntry>,
  field: (entry: ItemEntry) => string | null,
): Record<string, string[]> {
  const named: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(items)) {
    const name = field(entry);
    if (name === null) continue;
    named[name] = [...(named[name] ?? []), key];
  }
  return named;
}

/** The settings form for a config, paths under the home directory shown with ~. */
export function settingsFormFor(config: Config, home: string): SettingsForm {
  const path = (stored: string) => collapseHome(stored, home);
  return {
    values: {
      wires: {
        rows: config.wires.names.map((name) => ({ from: name, name })),
        defaultRow: config.wires.names.indexOf(config.wires.default),
      },
      sources: mapSourcePaths(config.sources, path),
      thresholds: flatThresholds(config.thresholds) as Record<
        ThresholdKey,
        number
      >,
      scan: { ...config.scan },
      launch: {
        actions: config.launch.actions.map((action) =>
          launchValuesOf(action, path),
        ),
      },
      joins: config.joins.map(listLine),
      ignore: [...config.ignore],
    },
    named: {
      wires: namedBy(config.items, (entry) => entry.wire),
    },
  };
}

/** The sources with every local path mapped, each list a copy. */
function mapSourcePaths(
  sources: SourcesConfig,
  path: (path: string) => string,
): SourcesConfig {
  const forge = <T extends { hosts: string[]; trackedForks: string[] }>(
    source: T,
  ): T => ({
    ...source,
    hosts: [...source.hosts],
    trackedForks: [...source.trackedForks],
  });
  return {
    local: sources.local.map((source) => ({
      include: source.include.map(path),
      exclude: source.exclude.map(path),
    })),
    github: sources.github.map(forge),
    forgejo: sources.forgejo.map(forge),
    kuma: sources.kuma.map((source) => ({ ...source })),
  };
}

const isWhole = (value: number) => Number.isInteger(value) && value > 0;

const isBlank = (text: string) => text.trim() === "";

/** The default wire's name now, or undefined when the default row is not one of the rows. */
export function defaultName(
  wires: SettingsValues["wires"],
): string | undefined {
  return wires.rows[wires.defaultRow]?.name;
}

/** The names that appear more than once, each once, in order. */
function repeats(names: readonly string[]): string[] {
  return [...new Set(names.filter((name, at) => names.indexOf(name) !== at))];
}

/**
 * Why the wires cannot be written: none at all, a blank, a name repeated, two rows starting as one
 * wire, or a default outside them.
 */
function wiresProblems(wires: SettingsValues["wires"]): string[] {
  const names = wires.rows.map((row) => row.name);
  const problems: string[] = [];
  if (names.length === 0) problems.push("Wires: name at least one wire");
  if (names.some(isBlank)) problems.push("Wires: every wire needs a name");
  for (const name of repeats(names.filter((name) => !isBlank(name)))) {
    problems.push(
      `Wires: two wires are named ${name}; each name may appear once`,
    );
  }
  const froms = wires.rows.flatMap((row) =>
    row.from === null ? [] : [row.from],
  );
  for (const from of repeats(froms)) {
    problems.push(`Wires: two wires both start as ${from}`);
  }
  if (defaultName(wires) === undefined) {
    problems.push("Wires: the default wire must be one of the wires");
  }
  return problems;
}

/** Why the values cannot be saved, in words; empty when they can. */
export function settingsProblems(values: SettingsValues): string[] {
  const problems: string[] = [];
  problems.push(
    ...wiresProblems(values.wires),
    ...thresholdProblems(values.thresholds, values.thresholds),
  );
  if (!isWhole(values.scan.intervalMinutes)) {
    problems.push("Scan interval: must be whole minutes above zero");
  }
  if (!isWhole(values.scan.finalisedCommits)) {
    problems.push("Finalised commits: must be a whole number above zero");
  }
  problems.push(
    ...launchProblems(values.launch.actions).map(launchProblemLine),
  );
  for (const line of values.joins) {
    const parsed = parseListLine(line);
    if ("problem" in parsed) {
      problems.push(`Joins: each join ${parsed.problem}`);
      continue;
    }
    if (parsed.list.length < 2 || parsed.list.some(isBlank)) {
      problems.push("Joins: each join names two references or more");
    }
  }
  if (values.ignore.some(isBlank)) {
    problems.push("Ignored presences: a reference cannot be empty");
  }
  problems.push(...sourceProblems(values.sources).map(sourceProblemLine));
  return problems;
}

function entryNames(keys: string[]): string {
  if (keys.length === 1) return keys[0] ?? "";
  return `${keys.slice(0, -1).join(", ")} and ${keys.at(-1)}`;
}

/** What saving does to entries naming a config wire no row starts as, in words. */
export function wireWarnings(
  named: Record<string, string[]>,
  wires: SettingsValues["wires"],
): string[] {
  const kept = new Set(wires.rows.map((row) => row.from));
  return Object.entries(named)
    .filter(([wire]) => !kept.has(wire))
    .map(
      ([wire, keys]) =>
        `${entryNames(keys)} ${keys.length === 1 ? "sits" : "sit"} on ${wire}, which is removed: saving moves ${keys.length === 1 ? "it" : "them"} to the default wire, ${defaultName(wires)}.`,
    );
}

/**
 * Config with everything but its item entries set to the values, paths expanded against the home
 * directory. An entry's wire follows the row that starts as it to that row's name, all in one
 * pass; an entry naming a wire no row starts as falls to the default. Throws when
 * settingsProblems finds any.
 */
export function withSettings(
  config: Config,
  values: SettingsValues,
  home: string,
): Config {
  const problems = settingsProblems(values);
  if (problems.length > 0) throw new Error(problems.join("; "));
  const path = (shown: string) => expandHome(shown, home);
  const { rows } = values.wires;
  const renamed = new Map(
    rows.flatMap((row) => (row.from === null ? [] : [[row.from, row.name]])),
  );
  return {
    wires: {
      names: rows.map((row) => row.name),
      default: defaultName(values.wires) ?? "",
    },
    sources: mapSourcePaths(values.sources, path),
    joins: values.joins.map(listOf),
    ignore: [...values.ignore],
    thresholds: nestedThresholds(values.thresholds) as Thresholds,
    items: Object.fromEntries(
      Object.entries(config.items).map(([key, entry]) => [
        key,
        {
          ...entry,
          wire: entry.wire === null ? null : (renamed.get(entry.wire) ?? null),
        },
      ]),
    ),
    scan: { ...values.scan },
    launch: {
      actions: values.launch.actions.map((action) =>
        launchConfigOf(action, path),
      ),
    },
  };
}
