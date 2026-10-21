import { type Config, driftThresholdsFor, importanceFor } from "./config.ts";
import {
  deriveClaudeSessions,
  deriveForgejo,
  deriveGit,
  deriveGithub,
  deriveKuma,
  deriveRoadmap,
  emptyRoadmap,
} from "./derivations.ts";
import { polledSourceOrder, type RawStore } from "./gather.ts";
import type {
  DiscoveredItem,
  DiscoveryFile,
  Entry,
  PolledSourceName,
  RawFiles,
  SourceStatus as RawSourceStatus,
  StatusFile,
} from "./raw.ts";
import type {
  Item,
  ItemError,
  ItemSources,
  LiveSourceName,
  Snapshot,
  SourceStatus,
} from "./snapshot.ts";
import type { LiveSource } from "./sources/source.ts";

/** Any live source, whatever data it returns. */
export type AnyLiveSource = LiveSource<LiveSourceName, unknown>;

/** Everything aggregation reads: the discovery and status files and each source's raw file. */
export interface RawBundle {
  discovery: DiscoveryFile;
  status: StatusFile;
  files: Partial<RawFiles>;
}

/** Reads the raw directory; a source with no raw file yet is left out. */
export async function readRawBundle(store: RawStore): Promise<RawBundle> {
  const discovery = (await store.read("discovery")) as DiscoveryFile | null;
  const status = (await store.read("status")) as StatusFile | null;
  if (discovery === null || status === null) {
    throw new Error("no raw files to aggregate: run pnpm gather first");
  }
  const files: Partial<RawFiles> = {};
  for (const name of polledSourceOrder) {
    const file = await store.read(name);
    if (file !== null) Object.assign(files, { [name]: file });
  }
  return { discovery, status, files };
}

/** Maps one raw entry: an error stays an error, absence maps through its own rule. */
function fromEntry<T, R extends string, D>(
  entry: Entry<T, R> | undefined,
  observed: (value: T) => D | ItemError,
  absent: (reason: R) => D | undefined,
): D | ItemError | undefined {
  if (entry === undefined) return undefined;
  if (entry.state === "error") return { error: entry.error };
  if (entry.state === "absent") return absent(entry.reason);
  return observed(entry.value);
}

function itemSources(
  item: DiscoveredItem,
  files: Partial<RawFiles>,
  config: Config,
): ItemSources {
  const sources: ItemSources = {};
  const git = files.git;
  const gitData =
    git === undefined
      ? undefined
      : fromEntry(
          git.items[item.id],
          (raw) =>
            deriveGit(
              raw,
              driftThresholdsFor(config, item.id),
              new Date(git.gatheredAt),
            ),
          () => undefined,
        );
  if (gitData !== undefined) sources.git = gitData;
  const roadmap = fromEntry(
    files.roadmap?.items[item.id],
    deriveRoadmap,
    () => emptyRoadmap,
  );
  if (roadmap !== undefined) sources.roadmap = roadmap;
  const sessions = fromEntry(
    files.claudeSessions?.items[item.id],
    deriveClaudeSessions,
    () => undefined,
  );
  if (sessions !== undefined) sources.claudeSessions = sessions;
  const github = fromEntry(
    files.github?.items[item.id],
    deriveGithub,
    () => undefined,
  );
  if (github !== undefined) sources.github = github;
  const forgejo = fromEntry(
    files.forgejo?.items[item.id],
    deriveForgejo,
    () => undefined,
  );
  if (forgejo !== undefined) sources.forgejo = forgejo;
  const kuma = fromEntry(
    files.kuma?.items[item.id],
    deriveKuma,
    () => undefined,
  );
  if (kuma !== undefined) sources.kuma = kuma;
  return sources;
}

function sourceStatus(raw: RawSourceStatus): SourceStatus {
  if (raw.state === "ok") {
    return {
      state: "ok",
      reason: null,
      error: null,
      lastSucceededAt: raw.lastSucceededAt,
      durationMs: raw.durationMs,
    };
  }
  return {
    state: "error",
    reason: raw.reason,
    error: raw.message,
    lastSucceededAt:
      raw.lastSucceededAt.state === "observed"
        ? raw.lastSucceededAt.value
        : null,
    durationMs: raw.durationMs,
  };
}

/**
 * Builds the snapshot from raw files alone. Ages are measured against each source file's
 * gatheredAt, so the same raw files always give the same snapshot.
 */
export function aggregate(
  bundle: RawBundle,
  input: {
    config: Config;
    configPath: string;
    liveSources: readonly AnyLiveSource[];
  },
  aggregatedAt: Date,
): Snapshot {
  const items: Item[] = bundle.discovery.items.map((discovered) => {
    const item: Item = {
      id: discovered.id,
      name: discovered.name,
      kind: discovered.kind,
      path: discovered.kind === "server" ? null : discovered.path,
      importance: importanceFor(input.config, discovered.id),
      liveSources: [],
      sources: itemSources(discovered, bundle.files, input.config),
    };
    item.liveSources = input.liveSources
      .filter((source) => source.appliesTo(item))
      .map((source) => source.name);
    return item;
  });
  const sources = {} as Record<PolledSourceName, SourceStatus>;
  for (const name of polledSourceOrder) {
    sources[name] = sourceStatus(bundle.status.sources[name]);
  }
  return {
    scannedAt: bundle.status.gatheredAt,
    durationMs: bundle.status.durationMs,
    aggregatedAt: aggregatedAt.toISOString(),
    configPath: input.configPath,
    warnings: bundle.discovery.warnings,
    sources,
    items,
  };
}
