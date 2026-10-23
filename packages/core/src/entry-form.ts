// A bird's config entry as its detail page edits it: the values the form holds, the choices it
// offers, and the edits that put them back into config. No Node modules, so the renderer may
// import it.

import {
  type Config,
  type ExpectationName,
  expectationNames,
  type ItemEntry,
  resolveEntry,
  type ThresholdOverrides,
  thresholdKeys,
} from "./config.ts";
import { itemRefs } from "./refs.ts";
import type { Item } from "./snapshot.ts";

/** A threshold's key in config, the same globally and per item. */
export type ThresholdKey = (typeof thresholdKeys)[number][2];

/** The entry fields the detail page edits; the zellij session is left as config has it. */
export interface EntryValues {
  /** The wire the bird sits on; null puts it on the default wire. */
  wire: string | null;
  /** The name the bird goes by; null keeps the scanned name. */
  name: string | null;
  /** The importance tier; null takes the default tier. */
  importance: string | null;
  expect: ExpectationName[];
  /** Key files relative to the item; null keeps the README and the roadmaps. */
  keyFiles: string[] | null;
  /** Roadmap files relative to the item; null keeps the standard names. */
  roadmaps: string[] | null;
  /** The overrides set; a key left out takes the global value. */
  thresholds: Partial<Record<ThresholdKey, number>>;
}

/** The choices the entry form offers, and the defaults a value left unset takes. */
export interface EntryOptions {
  wires: string[];
  defaultWire: string;
  tiers: string[];
  defaultTier: string;
  expectations: ExpectationName[];
  /** The global thresholds, which an override left out takes. */
  thresholds: Record<ThresholdKey, number>;
}

/** What the detail page needs to adopt a bird or edit its entry. */
export interface EntryForm {
  /** The config key the entry sits under; null for a bird config does not name. */
  key: string | null;
  /** The name the scan found, which a name left unset keeps. */
  scannedName: string;
  /** The entry's values; null for a bird on the fence. */
  values: EntryValues | null;
  options: EntryOptions;
}

/** The three health windows, each an amber key and a red key, with the unit they count in. */
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
  {
    label: "Unmet expectation",
    unit: "days",
    amber: "expectation_amber_days",
    red: "expectation_red_days",
  },
];

/** The values of a new entry: everything left to the defaults. */
export function emptyEntryValues(): EntryValues {
  return {
    wire: null,
    name: null,
    importance: null,
    expect: [],
    keyFiles: null,
    roadmaps: null,
    thresholds: {},
  };
}

function flatThresholds(
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

function nestedThresholds(
  flat: Partial<Record<ThresholdKey, number>>,
): ThresholdOverrides {
  const overrides: ThresholdOverrides = {
    unsafe: {},
    stalled: {},
    expectation: {},
  };
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
    importance: entry.importance,
    expect: [...entry.expect],
    keyFiles: entry.keyFiles === null ? null : [...entry.keyFiles],
    roadmaps: entry.roadmaps === null ? null : [...entry.roadmaps],
    thresholds: flatThresholds(entry.thresholds),
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
    tiers: [...config.importance.tiers],
    defaultTier: config.importance.default,
    expectations: [...expectationNames],
    thresholds,
  };
}

/** The entry form for an item: the entry that applies to it, if any, and the form's choices. */
export function entryFormFor(config: Config, item: Item): EntryForm {
  const { entry, keys } = resolveEntry(config, item.id, itemRefs(item));
  return {
    key: keys[0] ?? null,
    scannedName: item.name,
    values: entry === null ? null : entryValues(entry),
    options: entryOptions(config),
  };
}

/**
 * Config with an item's entry set to the values: under the key that already applies to the item,
 * else under its id. The zellij session the entry had is kept.
 */
export function withEntry(
  config: Config,
  item: Item,
  values: EntryValues,
): Config {
  const { entry, keys } = resolveEntry(config, item.id, itemRefs(item));
  const key = keys[0] ?? item.id;
  const next: ItemEntry = {
    wire: values.wire,
    name: values.name,
    importance: values.importance,
    thresholds: nestedThresholds(values.thresholds),
    expect: [...values.expect],
    keyFiles: values.keyFiles === null ? null : [...values.keyFiles],
    roadmaps: values.roadmaps === null ? null : [...values.roadmaps],
    zellijSession: entry?.zellijSession ?? null,
  };
  return { ...config, items: { ...config.items, [key]: next } };
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
  const problems: string[] = [];
  for (const window of thresholdWindows) {
    const amber = values.thresholds[window.amber];
    const red = values.thresholds[window.red];
    const bad = [amber, red].some(
      (value) => value !== undefined && !(Number.isInteger(value) && value > 0),
    );
    if (bad) {
      problems.push(
        `${window.label}: thresholds must be whole ${window.unit} above zero`,
      );
      continue;
    }
    if (
      (amber ?? options.thresholds[window.amber]) >=
      (red ?? options.thresholds[window.red])
    ) {
      problems.push(`${window.label}: amber must come before red`);
    }
  }
  return problems;
}
