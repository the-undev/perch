// The config but the item entries as the settings page edits it: the values the form holds, what
// they cannot be, and the edit that puts them back into config. No Node modules, so the renderer
// may import it.

import {
  type Config,
  collapseHome,
  expandHome,
  type ItemEntry,
  type LaunchCommandName,
  launchPlaceholders,
  type SourcesConfig,
  type Thresholds,
} from "./config.ts";
import {
  flatThresholds,
  nestedThresholds,
  type ThresholdKey,
  thresholdProblems,
} from "./entry-form.ts";
import { sourceProblemLine, sourceProblems } from "./sources-form.ts";

/** A zellij session and the root directory whose items it holds. */
export interface SessionRoot {
  /** The root as shown: a path under the home directory starts with ~. */
  root: string;
  session: string;
}

/** Everything in config but the item entries, which each bird's page edits. */
export interface SettingsValues {
  wires: { names: string[]; default: string };
  /** Config's source tables, each kind in order, paths written with ~. */
  sources: SourcesConfig;
  thresholds: Record<ThresholdKey, number>;
  scan: {
    intervalMinutes: number;
    archivedIntervalHours: number;
    finalisedCommits: number;
  };
  importance: { tiers: string[]; default: string };
  launch: {
    zellijSession: string;
    zellijSessions: SessionRoot[];
    /** Each command's argument list as one list line (see listLine); empty for no command. */
    commands: Record<LaunchCommandName, string>;
  };
  /** Each join's presence references as one list line. */
  joins: string[];
  /** Presence references left off the main view. */
  ignore: string[];
}

/** What the settings page needs: the values, and which item entries name each wire and tier. */
export interface SettingsForm {
  values: SettingsValues;
  /** The keys of the entries naming each wire and tier, which removing it moves to the default. */
  named: { wires: Record<string, string[]>; tiers: Record<string, string[]> };
}

/**
 * A list of strings as one line, in the config file's own form: brackets around double-quoted
 * strings, with JSON's escapes, such as ["code", "{path}"].
 */
export function listLine(list: readonly string[]): string {
  return `[${list.map((entry) => JSON.stringify(entry)).join(", ")}]`;
}

/** The strings a list line holds, or why it holds none. */
export function parseListLine(
  line: string,
): { list: string[] } | { problem: string } {
  const shape =
    'must be a list in brackets of strings in double quotes, such as ["code", "{path}"]';
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { problem: shape };
  }
  if (
    !Array.isArray(parsed) ||
    !parsed.every((entry) => typeof entry === "string")
  ) {
    return { problem: shape };
  }
  return { list: parsed };
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
  const commands = {} as Record<LaunchCommandName, string>;
  for (const name of Object.keys(launchPlaceholders) as LaunchCommandName[]) {
    const argv = config.launch.commands[name];
    commands[name] = argv === null ? "" : listLine(argv);
  }
  return {
    values: {
      wires: { names: [...config.wires.names], default: config.wires.default },
      sources: mapSourcePaths(config.sources, path),
      thresholds: flatThresholds(config.thresholds) as Record<
        ThresholdKey,
        number
      >,
      scan: { ...config.scan },
      importance: {
        tiers: [...config.importance.tiers],
        default: config.importance.default,
      },
      launch: {
        zellijSession: config.launch.zellijSession,
        zellijSessions: Object.entries(config.launch.zellijSessions).map(
          ([root, session]) => ({ root: path(root), session }),
        ),
        commands,
      },
      joins: config.joins.map(listLine),
      ignore: [...config.ignore],
    },
    named: {
      wires: namedBy(config.items, (entry) => entry.wire),
      tiers: namedBy(config.items, (entry) => entry.importance),
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

const isAbsolute = (path: string) =>
  path.startsWith("/") || path === "~" || path.startsWith("~/");

const isBlank = (text: string) => text.trim() === "";

/** Why a list of names cannot be written: none at all, a blank, a repeat, or a default outside it. */
function namesProblems(
  label: string,
  noun: string,
  names: string[],
  defaultName: string,
): string[] {
  const problems: string[] = [];
  if (names.length === 0) problems.push(`${label}: name at least one ${noun}`);
  if (names.some(isBlank))
    problems.push(`${label}: every ${noun} needs a name`);
  if (new Set(names).size !== names.length) {
    problems.push(`${label}: each ${noun} once`);
  }
  if (!names.includes(defaultName)) {
    problems.push(`${label}: the default ${noun} must be one of the ${noun}s`);
  }
  return problems;
}

/** Why a launch command's line cannot be written, or null when it can or is empty. */
function commandProblem(name: LaunchCommandName, line: string): string | null {
  if (isBlank(line)) return null;
  const parsed = parseListLine(line);
  if ("problem" in parsed) return `Launch command ${name}: ${parsed.problem}`;
  const [program] = parsed.list;
  if (program === undefined || isBlank(program)) {
    return `Launch command ${name}: must name a program first; empty the field to remove the action`;
  }
  const allowed = launchPlaceholders[name];
  for (const [, placeholder] of parsed.list.join(" ").matchAll(/\{(\w+)\}/g)) {
    if (placeholder !== undefined && !allowed.includes(placeholder)) {
      const may = allowed.map((entry) => `{${entry}}`).join(", ") || "none";
      return `Launch command ${name}: has no placeholder {${placeholder}}; it may use ${may}`;
    }
  }
  return null;
}

/** Why the values cannot be saved, in words; empty when they can. */
export function settingsProblems(values: SettingsValues): string[] {
  const problems: string[] = [];
  problems.push(
    ...namesProblems("Wires", "wire", values.wires.names, values.wires.default),
    ...thresholdProblems(values.thresholds, values.thresholds),
  );
  if (!isWhole(values.scan.intervalMinutes)) {
    problems.push("Scan interval: must be whole minutes above zero");
  }
  if (!isWhole(values.scan.archivedIntervalHours)) {
    problems.push("Archived scan interval: must be whole hours above zero");
  }
  if (!isWhole(values.scan.finalisedCommits)) {
    problems.push("Finalised commits: must be a whole number above zero");
  }
  problems.push(
    ...namesProblems(
      "Importance",
      "tier",
      values.importance.tiers,
      values.importance.default,
    ),
  );
  const { launch } = values;
  if (isBlank(launch.zellijSession)) {
    problems.push("Launch: the zellij session needs a name");
  }
  if (!launch.zellijSessions.every(({ root }) => isAbsolute(root))) {
    problems.push("Zellij sessions: each root must start with / or ~");
  }
  if (launch.zellijSessions.some(({ session }) => isBlank(session))) {
    problems.push("Zellij sessions: every root needs a session name");
  }
  const roots = launch.zellijSessions.map(({ root }) => root);
  if (new Set(roots).size !== roots.length) {
    problems.push("Zellij sessions: each root once");
  }
  for (const name of Object.keys(launchPlaceholders) as LaunchCommandName[]) {
    const problem = commandProblem(name, launch.commands[name]);
    if (problem !== null) problems.push(problem);
  }
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

/** What saving removes from entries naming a wire the values no longer hold, in words. */
export function wireWarnings(
  named: Record<string, string[]>,
  wires: SettingsValues["wires"],
): string[] {
  return Object.entries(named)
    .filter(([wire]) => !wires.names.includes(wire))
    .map(
      ([wire, keys]) =>
        `${entryNames(keys)} ${keys.length === 1 ? "sits" : "sit"} on ${wire}, which is removed: saving moves ${keys.length === 1 ? "it" : "them"} to the default wire, ${wires.default}.`,
    );
}

/** What saving removes from entries naming a tier the values no longer hold, in words. */
export function tierWarnings(
  named: Record<string, string[]>,
  importance: SettingsValues["importance"],
): string[] {
  return Object.entries(named)
    .filter(([tier]) => !importance.tiers.includes(tier))
    .map(
      ([tier, keys]) =>
        `${entryNames(keys)} ${keys.length === 1 ? "has" : "have"} importance ${tier}, which is removed: saving gives ${keys.length === 1 ? "it" : "them"} the default tier, ${importance.default}.`,
    );
}

/**
 * What saving the values does to item entries, in words: an entry naming a wire or tier the
 * values remove falls to the default, and the form says so before it is saved.
 */
export function settingsWarnings(
  named: SettingsForm["named"],
  values: SettingsValues,
): string[] {
  return [
    ...wireWarnings(named.wires, values.wires),
    ...tierWarnings(named.tiers, values.importance),
  ];
}

/** A list line's strings; the line has passed settingsProblems. */
function listOf(line: string): string[] {
  const parsed = parseListLine(line);
  if ("problem" in parsed) throw new Error(parsed.problem);
  return parsed.list;
}

/**
 * Config with everything but its item entries set to the values, paths expanded against the home
 * directory; an entry naming a wire or tier the values remove falls to the default. Throws when
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
  const commands = {} as Config["launch"]["commands"];
  for (const name of Object.keys(launchPlaceholders) as LaunchCommandName[]) {
    const line = values.launch.commands[name];
    commands[name] = isBlank(line) ? null : listOf(line);
  }
  const { names: wires } = values.wires;
  const { tiers } = values.importance;
  return {
    wires: { names: [...wires], default: values.wires.default },
    sources: mapSourcePaths(values.sources, path),
    joins: values.joins.map(listOf),
    ignore: [...values.ignore],
    thresholds: nestedThresholds(values.thresholds) as Thresholds,
    importance: { tiers: [...tiers], default: values.importance.default },
    items: Object.fromEntries(
      Object.entries(config.items).map(([key, entry]) => [
        key,
        {
          ...entry,
          wire:
            entry.wire !== null && wires.includes(entry.wire)
              ? entry.wire
              : null,
          importance:
            entry.importance !== null && tiers.includes(entry.importance)
              ? entry.importance
              : null,
        },
      ]),
    ),
    scan: { ...values.scan },
    launch: {
      zellijSession: values.launch.zellijSession,
      zellijSessions: Object.fromEntries(
        values.launch.zellijSessions.map(({ root, session }) => [
          path(root),
          session,
        ]),
      ),
      commands,
    },
  };
}
