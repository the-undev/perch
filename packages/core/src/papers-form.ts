// A bird's config papers as the bird's page edits it: the values the form holds, the choices it
// offers, and the edits that put them back into config. No Node modules, so the renderer may
// import it.

import {
  type Config,
  collapseHome,
  noThresholdOverrides,
  type Papers,
  resolvePapers,
  type ThresholdOverrides,
  thresholdKeys,
  zellijActionOf,
  zellijSessionFor,
} from "./config.ts";
import { entityRefs } from "./refs.ts";
import type { Entity } from "./snapshot.ts";

/** A threshold's key in config, the same globally and per entity. */
export type ThresholdKey = (typeof thresholdKeys)[number][2];

/** The papers fields the bird's page edits. */
export interface PapersValues {
  /** The wire the bird sits on; null puts it on the default wire. */
  wire: string | null;
  /** The name the bird goes by; null keeps the scanned name. */
  name: string | null;
  /** Key files relative to the entity; null keeps the README and the roadmaps. */
  keyFiles: string[] | null;
  /** Roadmap files relative to the entity; null keeps the standard names. */
  roadmaps: string[] | null;
  /** The overrides set; a key left out takes the global value. */
  thresholds: Partial<Record<ThresholdKey, number>>;
  /** The zellij session holding the entity's tab; null takes it from the zellij action. */
  zellijSession: string | null;
  /** The papers' bug words, kept as config has them; the form does not edit them. */
  bugWords: string[] | null;
  /** The papers' critical bug words, kept as config has them; the form does not edit them. */
  criticalBugWords: string[] | null;
}

/** The choices the papers form offers, and the defaults a value left unset takes. */
export interface PapersOptions {
  wires: string[];
  defaultWire: string;
  /** The global thresholds, which an override left out takes. */
  thresholds: Record<ThresholdKey, number>;
}

/** The newest commit the scan read for an entity. */
export interface SeenCommit {
  at: string;
  /** Null when the scan read no subject for it, as on a detached HEAD. */
  subject: string | null;
}

/** What the scan found for an entity, which the papers show and cannot change. */
export interface PapersSeen {
  /** Where the local repository is on disk, home as ~; null for an entity with no local repository here. */
  foundAt: string | null;
  /** The forges that also hold it, each as its web address without the scheme. */
  forges: string[];
  /** The checked-out commit, else the newest on a forge's default branch; null when none was read. */
  lastCommit: SeenCommit | null;
}

/** What the bird's page needs to adopt a bird or edit its papers. */
export interface PapersForm {
  /** The config key the papers sit under; null for a bird config does not name. */
  key: string | null;
  /** The name the scan found, which a name left unset keeps. */
  scannedName: string;
  seen: PapersSeen;
  /** The session the zellij action gives the local repository, which a session left unset takes; null without either. */
  defaultSession: string | null;
  /** The papers' values; null for a bird on the fence. */
  values: PapersValues | null;
  options: PapersOptions;
}

/** The two facts with thresholds the papers set, each an amber key and a red key, with the unit they count in and a fragment saying what the number counts. */
export const thresholdFacts: readonly {
  label: string;
  unit: "hours" | "days";
  counts: string;
  amber: ThresholdKey;
  red: ThresholdKey;
}[] = [
  {
    label: "Unsafe work",
    unit: "hours",
    counts: "Hours since the oldest uncommitted change or unpushed commit",
    amber: "unsafe_amber_hours",
    red: "unsafe_red_hours",
  },
  {
    label: "Stalled flight",
    unit: "days",
    counts:
      "Days a non-default branch has sat without a commit, even with everything pushed",
    amber: "stalled_amber_days",
    red: "stalled_red_days",
  },
];

/** The values of a new papers: everything left to the defaults. */
export function emptyPapersValues(): PapersValues {
  return {
    wire: null,
    name: null,
    keyFiles: null,
    roadmaps: null,
    thresholds: {},
    zellijSession: null,
    bugWords: null,
    criticalBugWords: null,
  };
}

/** Thresholds keyed as config writes them, a fact left out leaving its keys out. */
export function flatThresholds(
  thresholds: ThresholdOverrides,
): Partial<Record<ThresholdKey, number>> {
  const flat: Partial<Record<ThresholdKey, number>> = {};
  for (const [fact, field, key] of thresholdKeys) {
    const value = (thresholds[fact] as Partial<Record<string, number>>)[field];
    if (value !== undefined) flat[key] = value;
  }
  return flat;
}

/** Thresholds keyed as config writes them, back under their facts. */
export function nestedThresholds(
  flat: Partial<Record<ThresholdKey, number>>,
): ThresholdOverrides {
  const overrides = noThresholdOverrides();
  for (const [fact, field, key] of thresholdKeys) {
    const value = flat[key];
    if (value !== undefined) Object.assign(overrides[fact], { [field]: value });
  }
  return overrides;
}

/** Papers' editable fields as form values. */
export function papersValues(papers: Papers): PapersValues {
  return {
    wire: papers.wire,
    name: papers.name,
    keyFiles: papers.keyFiles === null ? null : [...papers.keyFiles],
    roadmaps: papers.roadmaps === null ? null : [...papers.roadmaps],
    thresholds: flatThresholds(papers.thresholds),
    zellijSession: papers.zellijSession,
    bugWords: papers.bugWords === null ? null : [...papers.bugWords],
    criticalBugWords:
      papers.criticalBugWords === null ? null : [...papers.criticalBugWords],
  };
}

/** The choices the form offers from config. */
export function papersOptions(config: Config): PapersOptions {
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
function lastCommitOf(entity: Entity): SeenCommit | null {
  const git = entity.sources.git;
  if (git !== undefined && !("error" in git) && git.lastCommitAt !== null) {
    const head = git.branches.find((branch) => branch.name === git.branch);
    return { at: git.lastCommitAt, subject: head?.subject ?? null };
  }
  const finalised = [entity.sources.github, entity.sources.forgejo].flatMap(
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

/**
 * What the scan found for an entity: its local repository, its forges, by address or by reference
 * for one that could not be read, and its newest commit.
 */
export function papersSeen(entity: Entity, home: string): PapersSeen {
  return {
    foundAt: entity.path === null ? null : collapseHome(entity.path, home),
    forges: entity.repositories.forges.map(
      (repository) =>
        repository.url?.replace(/^[a-z]+:\/\//, "") ?? repository.ref,
    ),
    lastCommit: lastCommitOf(entity),
  };
}

/**
 * The papers form for an entity: the papers that apply to it, if any, what the scan found, and the
 * form's choices. Paths are written with ~ for the home directory.
 */
export function papersFormFor(
  config: Config,
  entity: Entity,
  home: string,
): PapersForm {
  const { papers, keys } = resolvePapers(config, entity.id, entityRefs(entity));
  const zellij = zellijActionOf(config);
  return {
    key: keys[0] ?? null,
    scannedName: entity.name,
    seen: papersSeen(entity, home),
    defaultSession:
      zellij === null || entity.path === null
        ? null
        : zellijSessionFor(zellij, null, entity.path),
    values: papers === null ? null : papersValues(papers),
    options: papersOptions(config),
  };
}

/**
 * Config with an entity's papers set to the values: under the key that already applies to the entity,
 * else under its id.
 */
export function withPapers(
  config: Config,
  entity: Entity,
  values: PapersValues,
): Config {
  const { keys } = resolvePapers(config, entity.id, entityRefs(entity));
  const key = keys[0] ?? entity.id;
  const next: Papers = {
    wire: values.wire,
    name: values.name,
    thresholds: nestedThresholds(values.thresholds),
    keyFiles: values.keyFiles === null ? null : [...values.keyFiles],
    roadmaps: values.roadmaps === null ? null : [...values.roadmaps],
    zellijSession: values.zellijSession,
    bugWords: values.bugWords === null ? null : [...values.bugWords],
    criticalBugWords:
      values.criticalBugWords === null ? null : [...values.criticalBugWords],
  };
  return { ...config, entities: { ...config.entities, [key]: next } };
}

/** Whether two sets of values write the same papers, whatever order their thresholds were set in. */
export function samePapersValues(a: PapersValues, b: PapersValues): boolean {
  const canonical = (values: PapersValues) =>
    JSON.stringify([
      values.wire,
      values.name,
      values.keyFiles,
      values.roadmaps,
      flatThresholds(nestedThresholds(values.thresholds)),
      values.zellijSession,
      values.bugWords,
      values.criticalBugWords,
    ]);
  return canonical(a) === canonical(b);
}

/** Config without any papers naming the entity, so it returns to the fence. */
export function withoutPapers(config: Config, entity: Entity): Config {
  const { keys } = resolvePapers(config, entity.id, entityRefs(entity));
  return {
    ...config,
    entities: Object.fromEntries(
      Object.entries(config.entities).filter(([key]) => !keys.includes(key)),
    ),
  };
}

/** Why the values cannot be saved, in words; empty when they can. */
export function papersProblems(
  values: PapersValues,
  options: PapersOptions,
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
  for (const fact of thresholdFacts) {
    const amber = thresholds[fact.amber];
    const red = thresholds[fact.red];
    const bad = [amber, red].some(
      (value) => value !== undefined && !(Number.isInteger(value) && value > 0),
    );
    if (bad) {
      problems.push(
        `${fact.label}: thresholds must be whole ${fact.unit} above zero`,
      );
      continue;
    }
    if ((amber ?? fallback[fact.amber]) >= (red ?? fallback[fact.red])) {
      problems.push(`${fact.label}: amber must come before red`);
    }
  }
  return problems;
}
