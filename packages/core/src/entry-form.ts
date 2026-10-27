// A bird's config entry as its detail page edits it: the values the form holds, the choices it
// offers, and the edits that put them back into config. No Node modules, so the renderer may
// import it.

import {
  type Config,
  collapseHome,
  type ItemEntry,
  resolveEntry,
  type ThresholdOverrides,
  thresholdKeys,
  zellijSessionFor,
} from "./config.ts";
import { itemRefs } from "./refs.ts";
import type { Item } from "./snapshot.ts";

/** A threshold's key in config, the same globally and per item. */
export type ThresholdKey = (typeof thresholdKeys)[number][2];

/** The entry fields the detail page edits. */
export interface EntryValues {
  /** The wire the bird sits on; null puts it on the default wire. */
  wire: string | null;
  /** The name the bird goes by; null keeps the scanned name. */
  name: string | null;
  /** Key files relative to the item; null keeps the README and the roadmaps. */
  keyFiles: string[] | null;
  /** Roadmap files relative to the item; null keeps the standard names. */
  roadmaps: string[] | null;
  /** The overrides set; a key left out takes the global value. */
  thresholds: Partial<Record<ThresholdKey, number>>;
  /** The zellij session holding the item's tab; null takes it from the launch section. */
  zellijSession: string | null;
}

/** The choices the entry form offers, and the defaults a value left unset takes. */
export interface EntryOptions {
  wires: string[];
  defaultWire: string;
  /** The global thresholds, which an override left out takes. */
  thresholds: Record<ThresholdKey, number>;
}

/** The newest commit the scan read for an item. */
export interface SeenCommit {
  at: string;
  /** Null when the scan read no subject for it, as on a detached HEAD. */
  subject: string | null;
}

/** What the scan found for an item, which the papers show and cannot change. */
export interface EntrySeen {
  /** Where the clone is on disk, home as ~; null for an item with no clone here. */
  foundAt: string | null;
  /** The forges that also hold it, each as its web address without the scheme. */
  forges: string[];
  /** The checked-out commit, else the newest on a forge's default branch; null when none was read. */
  lastCommit: SeenCommit | null;
}

/** What the detail page needs to adopt a bird or edit its entry. */
export interface EntryForm {
  /** The config key the entry sits under; null for a bird config does not name. */
  key: string | null;
  /** The name the scan found, which a name left unset keeps. */
  scannedName: string;
  seen: EntrySeen;
  /** The session the launch rules give the clone, which a session left unset takes; null without one. */
  defaultSession: string | null;
  /** The entry's values; null for a bird on the fence. */
  values: EntryValues | null;
  options: EntryOptions;
}

/** The two health windows, each an amber key and a red key, with the unit they count in. */
export const thresholdWindows: readonly {
  label: string;
  unit: "hours" | "days";
  amber: ThresholdKey;
  red: ThresholdKey;
}[] = [
  {
    label: "Unsafe work",
    unit: "hours",
    amber: "unsafe_amber_hours",
    red: "unsafe_red_hours",
  },
  {
    label: "Stalled flight",
    unit: "days",
    amber: "stalled_amber_days",
    red: "stalled_red_days",
  },
];

/** The values of a new entry: everything left to the defaults. */
export function emptyEntryValues(): EntryValues {
  return {
    wire: null,
    name: null,
    keyFiles: null,
    roadmaps: null,
    thresholds: {},
    zellijSession: null,
  };
}

/** Thresholds keyed as config writes them, a window left out leaving its keys out. */
export function flatThresholds(
  thresholds: ThresholdOverrides,
): Partial<Record<ThresholdKey, number>> {
  const flat: Partial<Record<ThresholdKey, number>> = {};
  for (const [window, field, key] of thresholdKeys) {
    const value = (thresholds[window] as Partial<Record<string, number>>)[
      field
    ];
    if (value !== undefined) flat[key] = value;
  }
  return flat;
}

/** Thresholds keyed as config writes them, back in their windows. */
export function nestedThresholds(
  flat: Partial<Record<ThresholdKey, number>>,
): ThresholdOverrides {
  const overrides: ThresholdOverrides = { unsafe: {}, stalled: {} };
  for (const [window, field, key] of thresholdKeys) {
    const value = flat[key];
    if (value !== undefined)
      Object.assign(overrides[window], { [field]: value });
  }
  return overrides;
}

/** An entry's editable fields as form values. */
export function entryValues(entry: ItemEntry): EntryValues {
  return {
    wire: entry.wire,
    name: entry.name,
    keyFiles: entry.keyFiles === null ? null : [...entry.keyFiles],
    roadmaps: entry.roadmaps === null ? null : [...entry.roadmaps],
    thresholds: flatThresholds(entry.thresholds),
    zellijSession: entry.zellijSession,
  };
}

/** The choices the form offers from config. */
export function entryOptions(config: Config): EntryOptions {
  const thresholds = flatThresholds(config.thresholds) as Record<
    ThresholdKey,
    number
  >;
  return {
    wires: [...config.wires.names],
    defaultWire: config.wires.default,
    thresholds,
  };
}

/** The newest commit the scan read: git's checked-out one, else the newest any forge finalised. */
function lastCommitOf(item: Item): SeenCommit | null {
  const git = item.sources.git;
  if (git !== undefined && !("error" in git) && git.lastCommitAt !== null) {
    const head = git.branches.find((branch) => branch.name === git.branch);
    return { at: git.lastCommitAt, subject: head?.subject ?? null };
  }
  const finalised = [item.sources.github, item.sources.forgejo].flatMap(
    (forge) =>
      forge === undefined ||
      "error" in forge ||
      "error" in forge.finalisedCommits
        ? []
        : forge.finalisedCommits,
  );
  const newest = finalised.reduce<(typeof finalised)[number] | null>(
    (best, commit) =>
      best === null ||
      Date.parse(commit.committedAt) > Date.parse(best.committedAt)
        ? commit
        : best,
    null,
  );
  return newest === null
    ? null
    : { at: newest.committedAt, subject: newest.subject };
}

/** What the scan found for an item: its clone, its forges and its newest commit. */
export function entrySeen(item: Item, home: string): EntrySeen {
  return {
    foundAt: item.path === null ? null : collapseHome(item.path, home),
    forges: item.presences.forges.map((presence) =>
      presence.url.replace(/^[a-z]+:\/\//, ""),
    ),
    lastCommit: lastCommitOf(item),
  };
}

/**
 * The entry form for an item: the entry that applies to it, if any, what the scan found, and the
 * form's choices. Paths are written with ~ for the home directory.
 */
export function entryFormFor(
  config: Config,
  item: Item,
  home: string,
): EntryForm {
  const { entry, keys } = resolveEntry(config, item.id, itemRefs(item));
  return {
    key: keys[0] ?? null,
    scannedName: item.name,
    seen: entrySeen(item, home),
    defaultSession:
      item.path === null ? null : zellijSessionFor(config, null, item.path),
    values: entry === null ? null : entryValues(entry),
    options: entryOptions(config),
  };
}

/**
 * Config with an item's entry set to the values: under the key that already applies to the item,
 * else under its id.
 */
export function withEntry(
  config: Config,
  item: Item,
  values: EntryValues,
): Config {
  const { keys } = resolveEntry(config, item.id, itemRefs(item));
  const key = keys[0] ?? item.id;
  const next: ItemEntry = {
    wire: values.wire,
    name: values.name,
    thresholds: nestedThresholds(values.thresholds),
    keyFiles: values.keyFiles === null ? null : [...values.keyFiles],
    roadmaps: values.roadmaps === null ? null : [...values.roadmaps],
    zellijSession: values.zellijSession,
  };
  return { ...config, items: { ...config.items, [key]: next } };
}

/** Whether two sets of values write the same entry, whatever order their thresholds were set in. */
export function sameEntryValues(a: EntryValues, b: EntryValues): boolean {
  const canonical = (values: EntryValues) =>
    JSON.stringify([
      values.wire,
      values.name,
      values.keyFiles,
      values.roadmaps,
      flatThresholds(nestedThresholds(values.thresholds)),
      values.zellijSession,
    ]);
  return canonical(a) === canonical(b);
}

/** Config without any entry naming the item, so it returns to the fence. */
export function withoutEntry(config: Config, item: Item): Config {
  const { keys } = resolveEntry(config, item.id, itemRefs(item));
  return {
    ...config,
    items: Object.fromEntries(
      Object.entries(config.items).filter(([key]) => !keys.includes(key)),
    ),
  };
}

/** Why the values cannot be saved, in words; empty when they can. */
export function entryProblems(
  values: EntryValues,
  options: EntryOptions,
): string[] {
  return thresholdProblems(values.thresholds, options.thresholds);
}

/**
 * Why thresholds cannot be written: a value that is not a whole number above zero, or an amber
 * that does not open before its red, a key left out taking its fallback.
 */
export function thresholdProblems(
  thresholds: Partial<Record<ThresholdKey, number>>,
  fallback: Record<ThresholdKey, number>,
): string[] {
  const problems: string[] = [];
  for (const window of thresholdWindows) {
    const amber = thresholds[window.amber];
    const red = thresholds[window.red];
    const bad = [amber, red].some(
      (value) => value !== undefined && !(Number.isInteger(value) && value > 0),
    );
    if (bad) {
      problems.push(
        `${window.label}: thresholds must be whole ${window.unit} above zero`,
      );
      continue;
    }
    if ((amber ?? fallback[window.amber]) >= (red ?? fallback[window.red])) {
      problems.push(`${window.label}: amber must come before red`);
    }
  }
  return problems;
}
