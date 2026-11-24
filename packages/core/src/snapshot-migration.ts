// Migrates a snapshot written by an earlier perch, one step per version, to the shape this perch writes.

import type { JsonRecord } from "./json.ts";
import { type Snapshot, snapshotVersion } from "./snapshot.ts";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

const version1Backups: Record<string, string> = {
  joined: "linked",
  "unjoined-remote": "unlinked-remote",
};

const version1Flags: Record<string, string> = {
  "remote-joined-elsewhere": "remote-linked-elsewhere",
};

const version1Activities: Record<string, string> = {
  editing: "uncommitted",
  "in-progress": "committed",
  settled: "merged",
};

function renamed(value: unknown, names: Record<string, string>): unknown {
  return typeof value === "string" ? (names[value] ?? value) : value;
}

function gitFromVersion1(git: JsonRecord): JsonRecord {
  if ("error" in git) return git;
  const { activity, drift, backup, ...rest } = git;
  return {
    ...rest,
    backup: renamed(backup, version1Backups),
    workState: renamed(activity, version1Activities),
    unsafeWork: drift,
  };
}

/** A roadmap file or group, which share one shape, with its items renamed to work items. */
function workItemHolderFromVersion1(holder: JsonRecord): JsonRecord {
  const { items, groups, ...rest } = holder;
  return {
    ...rest,
    workItems: items,
    groups: records(groups).map(workItemHolderFromVersion1),
  };
}

function roadmapFromVersion1(roadmap: JsonRecord): JsonRecord {
  if ("error" in roadmap) return roadmap;
  return {
    ...roadmap,
    files: records(roadmap.files).map(workItemHolderFromVersion1),
  };
}

function entityFromVersion1(item: JsonRecord): JsonRecord {
  const {
    presences,
    liveSources: _liveSources,
    flags,
    sources,
    ...rest
  } = item;
  const {
    kuma: _kuma,
    git,
    roadmap,
    ...forges
  } = isRecord(sources) ? sources : {};
  return {
    ...rest,
    repositories: presences,
    flags: records(flags).map((flag) => ({
      ...flag,
      flag: renamed(flag.flag, version1Flags),
    })),
    sources: {
      ...(isRecord(git) && { git: gitFromVersion1(git) }),
      ...(isRecord(roadmap) && { roadmap: roadmapFromVersion1(roadmap) }),
      ...forges,
    },
  };
}

function forgeListingFromVersion1(listing: unknown): JsonRecord {
  const entries = (value: unknown) =>
    records(value).map(({ itemId, ...entry }) => ({
      ...entry,
      entityId: itemId,
    }));
  const { active, archived } = isRecord(listing) ? listing : {};
  return { active: entries(active), archived: entries(archived) };
}

/** Version 2 took the glossary's words and dropped servers and Uptime Kuma. */
function fromVersion1(document: JsonRecord): JsonRecord {
  const { items, sources, sourceCards, forges, ...rest } = document;
  const { kuma: _kuma, ...polledSources } = isRecord(sources) ? sources : {};
  return {
    ...rest,
    version: 2,
    forges: Object.fromEntries(
      Object.entries(isRecord(forges) ? forges : {}).map(([forge, listing]) => [
        forge,
        forgeListingFromVersion1(listing),
      ]),
    ),
    sources: polledSources,
    sourceCards: records(sourceCards).filter((card) => card.kind !== "kuma"),
    entities: records(items)
      .filter((item) => item.kind !== "server")
      .map(entityFromVersion1),
  };
}

/** The steps that take a snapshot up one version, the step from version 1 first. */
const migrationSteps: readonly ((document: JsonRecord) => JsonRecord)[] = [
  fromVersion1,
];

/** The version a snapshot was written at, 1 when it names none; null when this perch cannot read it. */
function versionOf(document: JsonRecord): number | null {
  if (document.version === undefined) return 1;
  const { version } = document;
  if (typeof version !== "number" || !Number.isInteger(version)) return null;
  if (version < 1 || version > snapshotVersion) return null;
  return version;
}

/** A parsed snapshot document migrated to this perch's version, or null when it cannot be. */
export function migrateSnapshot(document: unknown): Snapshot | null {
  if (!isRecord(document)) return null;
  const version = versionOf(document);
  if (version === null) return null;
  const migrated = migrationSteps
    .slice(version - 1)
    .reduce((current, step) => step(current), document);
  return migrated as unknown as Snapshot;
}
