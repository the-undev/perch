import { basename, relative, sep } from "node:path";
import { type Config, importanceFor } from "./config.ts";
import type { Discovery } from "./discovery.ts";
import { errorMessage } from "./fs.ts";
import type {
  Item,
  LiveSourceName,
  PolledSourceName,
  Snapshot,
  SourceStatus,
} from "./snapshot.ts";
import type { LiveSource, PolledSource } from "./sources/source.ts";

/** Id of the one server item. */
export const serverItemId = "server";

/** Any live source, whatever data it returns. */
export type AnyLiveSource = LiveSource<LiveSourceName, unknown>;

/** One polled source per name; the type makes every source required. */
export type PolledSources = { [N in PolledSourceName]: PolledSource<N> };

/** Run order: git first, because the forges read remotes from its data. */
export const polledSourceOrder: readonly PolledSourceName[] = [
  "git",
  "roadmap",
  "claudeSessions",
  "github",
  "forgejo",
  "kuma",
];

export interface ScanDeps {
  now: () => Date;
  polledSources: PolledSources;
  liveSources: readonly AnyLiveSource[];
}

export interface ScanInput {
  config: Config;
  configPath: string;
  home: string;
  discovery: Discovery;
  /** The previous snapshot, whose data and success times a failing source keeps. */
  previous: Snapshot | null;
}

function itemId(path: string, home: string): string {
  const fromHome = relative(home, path);
  return fromHome.startsWith("..") || fromHome === ""
    ? path
    : fromHome.split(sep).join("/");
}

/** Builds the item list: one per discovered repository or vault, then the server. */
export function buildItems(
  input: Pick<ScanInput, "config" | "home" | "discovery">,
  liveSources: readonly AnyLiveSource[],
): Item[] {
  const items: Item[] = input.discovery.found.map((found) => {
    const id = itemId(found.path, input.home);
    return {
      id,
      name: basename(found.path),
      kind: found.kind,
      path: found.path,
      importance: importanceFor(input.config, id),
      liveSources: [],
      sources: {},
    };
  });
  items.push({
    id: serverItemId,
    name: input.config.server.name,
    kind: "server",
    path: null,
    importance: importanceFor(input.config, serverItemId),
    liveSources: [],
    sources: {},
  });
  for (const item of items) {
    item.liveSources = liveSources
      .filter((source) => source.appliesTo(item))
      .map((source) => source.name);
  }
  return items;
}

async function runSource<N extends PolledSourceName>(
  source: PolledSource<N>,
  items: Item[],
  previous: Snapshot | null,
  now: () => Date,
): Promise<SourceStatus> {
  const started = now();
  try {
    const results = await source.scan(items);
    for (const item of items) {
      const data = results.get(item.id);
      if (data !== undefined) item.sources[source.name] = data;
    }
    const finished = now();
    return {
      state: "ok",
      error: null,
      lastSucceededAt: finished.toISOString(),
      durationMs: finished.getTime() - started.getTime(),
    };
  } catch (error) {
    const previousItems = new Map(
      previous?.items.map((item) => [item.id, item]),
    );
    for (const item of items) {
      const kept = previousItems.get(item.id)?.sources[source.name];
      if (kept !== undefined) item.sources[source.name] = kept;
    }
    return {
      state: "error",
      error: errorMessage(error),
      lastSucceededAt: previous?.sources[source.name]?.lastSucceededAt ?? null,
      durationMs: now().getTime() - started.getTime(),
    };
  }
}

/**
 * Runs every polled source in order over the discovered items. Later sources see earlier
 * sources' data, so the forges read remotes from git. A failing source keeps its previous data.
 */
export async function runScan(
  input: ScanInput,
  deps: ScanDeps,
): Promise<Snapshot> {
  const started = deps.now();
  const items = buildItems(input, deps.liveSources);
  const statuses = {} as Record<PolledSourceName, SourceStatus>;
  for (const name of polledSourceOrder) {
    statuses[name] = await runSource(
      deps.polledSources[name],
      items,
      input.previous,
      deps.now,
    );
  }
  const finished = deps.now();
  return {
    scannedAt: finished.toISOString(),
    durationMs: finished.getTime() - started.getTime(),
    configPath: input.configPath,
    warnings: input.discovery.warnings,
    sources: statuses,
    items,
  };
}
