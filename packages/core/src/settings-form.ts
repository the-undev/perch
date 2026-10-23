// The whole config but the item entries as the settings page edits it: the values the form
// holds, what they cannot be, and the edit that puts them back into config. No Node modules, so
// the renderer may import it.

import {
  type Config,
  collapseHome,
  expandHome,
  type ForgeAccount,
  type ItemEntry,
  type LaunchCommandName,
  launchPlaceholders,
  type Thresholds,
} from "./config.ts";
import {
  flatThresholds,
  nestedThresholds,
  type ThresholdKey,
  thresholdProblems,
} from "./entry-form.ts";

/** One forge's hosts, accounts and tracked forks as the form edits them. */
export interface ForgeValues {
  hosts: string[];
  accounts: ForgeAccount[];
  /** Forks worth tracking, as owner/name. */
  trackedForks: string[];
}

/** The server to monitor through Uptime Kuma. */
export interface ServerValues {
  name: string;
  kumaBaseUrl: string;
  kumaStatusPage: string;
}

/** A zellij session and the root directory whose items it holds. */
export interface SessionRoot {
  /** The root as shown: a path under the home directory starts with ~. */
  root: string;
  session: string;
}

/** Everything in config but the item entries, which each bird's detail page edits. */
export interface SettingsValues {
  /** Paths as shown: a path under the home directory starts with ~. */
  local: { include: string[]; ignore: string[] };
  wires: { names: string[]; default: string };
  thresholds: Record<ThresholdKey, number>;
  scan: { intervalMinutes: number; archivedIntervalHours: number };
  importance: { tiers: string[]; default: string };
  launch: {
    zellijSession: string;
    zellijSessions: SessionRoot[];
    /** Each command's argument list as one list line (see listLine); empty for no command. */
    commands: Record<LaunchCommandName, string>;
  };
  forges: {
    finalisedCommits: number;
    github: ForgeValues;
    forgejo: ForgeValues & { baseUrl: string };
  };
  /** Null when no server is monitored. */
  server: ServerValues | null;
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

function forgeValues(forge: Config["forges"]["github"]): ForgeValues {
  return {
    hosts: [...forge.hosts],
    accounts: forge.accounts.map(({ account, key }) => ({ account, key })),
    trackedForks: [...forge.trackedForks],
  };
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
      local: {
        include: config.local.include.map(path),
        ignore: config.local.ignore.map(path),
      },
      wires: { names: [...config.wires.names], default: config.wires.default },
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
      forges: {
        finalisedCommits: config.forges.finalisedCommits,
        github: forgeValues(config.forges.github),
        forgejo: {
          ...forgeValues(config.forges.forgejo),
          baseUrl: config.forges.forgejo.baseUrl,
        },
      },
      server: config.server === null ? null : { ...config.server },
      joins: config.joins.map(listLine),
      ignore: [...config.ignore],
    },
    named: {
      wires: namedBy(config.items, (entry) => entry.wire),
      tiers: namedBy(config.items, (entry) => entry.importance),
    },
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

function forgeProblems(label: string, forge: ForgeValues): string[] {
  const problems: string[] = [];
  if (forge.hosts.some(isBlank)) {
    problems.push(`${label}: every host needs a name`);
  }
  if (
    forge.accounts.some(({ account, key }) => isBlank(account) || isBlank(key))
  ) {
    problems.push(`${label}: every account needs a name and a keyring key`);
  }
  if (!forge.trackedForks.every((fork) => /^[^/\s]+\/[^/\s]+$/.test(fork))) {
    problems.push(`${label}: tracked forks are written owner/name`);
  }
  return problems;
}

/** Why the values cannot be saved, in words; empty when they can. */
export function settingsProblems(values: SettingsValues): string[] {
  const problems: string[] = [];
  if (!values.local.include.every(isAbsolute)) {
    problems.push("Include paths: each must start with / or ~");
  }
  if (!values.local.ignore.every(isAbsolute)) {
    problems.push("Ignore paths: each must start with / or ~");
  }
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
  if (!isWhole(values.forges.finalisedCommits)) {
    problems.push("Finalised commits: must be a whole number above zero");
  }
  problems.push(
    ...forgeProblems("GitHub", values.forges.github),
    ...forgeProblems("Forgejo", values.forges.forgejo),
  );
  if (isBlank(values.forges.forgejo.baseUrl)) {
    problems.push("Forgejo: the address cannot be empty");
  }
  const { server } = values;
  if (
    server !== null &&
    [server.name, server.kumaBaseUrl, server.kumaStatusPage].some(isBlank)
  ) {
    problems.push(
      "Server: the name, the Uptime Kuma address and the status page each need a value",
    );
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
  return problems;
}

function entryNames(keys: string[]): string {
  if (keys.length === 1) return keys[0] ?? "";
  return `${keys.slice(0, -1).join(", ")} and ${keys.at(-1)}`;
}

/**
 * What saving the values does to item entries, in words: an entry naming a wire or tier the
 * values remove falls to the default, and the form says so before it is saved.
 */
export function settingsWarnings(
  named: SettingsForm["named"],
  values: SettingsValues,
): string[] {
  const warnings: string[] = [];
  for (const [wire, keys] of Object.entries(named.wires)) {
    if (values.wires.names.includes(wire)) continue;
    warnings.push(
      `${entryNames(keys)} ${keys.length === 1 ? "sits" : "sit"} on ${wire}, which is removed: saving moves ${keys.length === 1 ? "it" : "them"} to the default wire, ${values.wires.default}.`,
    );
  }
  for (const [tier, keys] of Object.entries(named.tiers)) {
    if (values.importance.tiers.includes(tier)) continue;
    warnings.push(
      `${entryNames(keys)} ${keys.length === 1 ? "has" : "have"} importance ${tier}, which is removed: saving gives ${keys.length === 1 ? "it" : "them"} the default tier, ${values.importance.default}.`,
    );
  }
  return warnings;
}

function forgeConfig(forge: ForgeValues): Config["forges"]["github"] {
  return {
    hosts: [...forge.hosts],
    accounts: forge.accounts.map(({ account, key }) => ({ account, key })),
    trackedForks: [...forge.trackedForks],
  };
}

/** A list line's strings; the line has passed settingsProblems. */
function listOf(line: string): string[] {
  const parsed = parseListLine(line);
  if ("problem" in parsed) throw new Error(parsed.problem);
  return parsed.list;
}

/**
 * Config with everything but its item entries set to the values, paths expanded against the
 * home directory; an entry naming a wire or tier the values remove falls to the default. Throws
 * when settingsProblems finds any.
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
    local: {
      include: values.local.include.map(path),
      ignore: values.local.ignore.map(path),
    },
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
    forges: {
      finalisedCommits: values.forges.finalisedCommits,
      github: forgeConfig(values.forges.github),
      forgejo: {
        ...forgeConfig(values.forges.forgejo),
        baseUrl: values.forges.forgejo.baseUrl,
      },
    },
    server: values.server === null ? null : { ...values.server },
  };
}
