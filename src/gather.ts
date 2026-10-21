import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SourceFailure } from "./failure.ts";
import { errorMessage, readTextIfExists } from "./fs.ts";
import type {
  DiscoveryFile,
  PolledSourceName,
  RawEntries,
  RawFiles,
  RawSourceFile,
  SourceStatus,
  StatusFile,
} from "./raw.ts";
import type { PolledSource } from "./sources/source.ts";

/** One polled source per name; the type makes every source required. */
export type PolledSources = { [N in PolledSourceName]: PolledSource<N> };

/** Gather order: git first, because the forges read remotes from its raw file. */
export const polledSourceOrder: readonly PolledSourceName[] = [
  "git",
  "roadmap",
  "claudeSessions",
  "github",
  "forgejo",
  "kuma",
];

/** Reads and writes the pretty-printed JSON files in the raw directory, by name without .json. */
export interface RawStore {
  read(name: string): Promise<unknown>;
  write(name: string, value: unknown): Promise<void>;
}

/** A RawStore over a directory, created on first write; a missing file reads as null. */
export function createRawStore(directory: string): RawStore {
  return {
    async read(name) {
      const text = await readTextIfExists(join(directory, `${name}.json`));
      return text === null ? null : JSON.parse(text);
    },
    async write(name, value) {
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, `${name}.json`),
        `${JSON.stringify(value, null, 2)}\n`,
      );
    },
  };
}

export interface GatherDeps {
  now: () => Date;
  sources: PolledSources;
  store: RawStore;
}

/** Entries in discovery order, so the files read in the same order as the item list. */
function ordered<T>(
  entries: Record<string, T>,
  discovery: DiscoveryFile,
): Record<string, T> {
  const sorted: Record<string, T> = {};
  for (const item of discovery.items) {
    const entry = entries[item.id];
    if (entry !== undefined) sorted[item.id] = entry;
  }
  return sorted;
}

async function gatherSource<N extends PolledSourceName>(
  source: PolledSource<N>,
  discovery: DiscoveryFile,
  earlier: Partial<RawFiles>,
  previous: SourceStatus | undefined,
  deps: GatherDeps,
): Promise<SourceStatus> {
  const started = deps.now();
  try {
    const entries = await source.gather(discovery.items, earlier);
    const finished = deps.now();
    const file: RawSourceFile<N> = {
      source: source.name,
      gatheredAt: finished.toISOString(),
      items: ordered<RawEntries[N]>(entries, discovery),
    };
    await deps.store.write(source.name, file);
    earlier[source.name] = file as Partial<RawFiles>[N];
    return {
      state: "ok",
      lastSucceededAt: finished.toISOString(),
      durationMs: finished.getTime() - started.getTime(),
    };
  } catch (error) {
    const kept = (await deps.store.read(
      source.name,
    )) as RawSourceFile<N> | null;
    if (kept !== null) earlier[source.name] = kept as Partial<RawFiles>[N];
    return {
      state: "error",
      reason: error instanceof SourceFailure ? error.reason : "unexpected",
      message: errorMessage(error),
      lastSucceededAt:
        previous === undefined
          ? { state: "absent", reason: "never-succeeded" }
          : previous.state === "ok"
            ? { state: "observed", value: previous.lastSucceededAt }
            : previous.lastSucceededAt,
      durationMs: deps.now().getTime() - started.getTime(),
    };
  }
}

/**
 * Writes the discovery file, then gathers every polled source in order into its own raw file.
 * A failing source leaves its previous raw file in place; status.json records each outcome.
 */
export async function gather(
  discovery: DiscoveryFile,
  deps: GatherDeps,
): Promise<StatusFile> {
  const started = deps.now();
  await deps.store.write("discovery", discovery);
  const previous = (await deps.store.read("status")) as StatusFile | null;
  const earlier: Partial<RawFiles> = {};
  const sources = {} as Record<PolledSourceName, SourceStatus>;
  for (const name of polledSourceOrder) {
    sources[name] = await gatherSource(
      deps.sources[name],
      discovery,
      earlier,
      previous?.sources[name],
      deps,
    );
  }
  const status: StatusFile = {
    gatheredAt: started.toISOString(),
    durationMs: deps.now().getTime() - started.getTime(),
    sources,
  };
  await deps.store.write("status", status);
  return status;
}
