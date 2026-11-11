import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SourceFailure } from "./failure.ts";
import { errorMessage, readTextIfExists } from "./fs.ts";
import type {
  PolledSourceName,
  RawFiles,
  RawSourceFile,
  SourceStatus,
  StatusFile,
} from "./raw.ts";
import type { PolledSource } from "./sources/source.ts";

/** One polled source per name; kuma is null when config declares no kuma source. */
export type PolledSources = {
  [N in Exclude<PolledSourceName, "kuma">]: PolledSource<N>;
} & { kuma: PolledSource<"kuma"> | null };

/**
 * Collection rounds, run in order. Root collectors read config and the outside world; enrichers
 * read what earlier rounds gathered. The roadmap reader runs last, because a clone's config entry
 * is resolved through the join, which needs the forge enrichers' files. Sources within a round
 * run together.
 */
export const gatherRounds: readonly (readonly PolledSourceName[])[] = [
  ["local", "githubAccounts", "forgejoAccounts", "kuma"],
  ["github", "forgejo"],
  ["roadmap"],
];

/** Every polled source, in round order. */
export const polledSourceOrder: readonly PolledSourceName[] =
  gatherRounds.flat();

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

async function gatherSource<N extends PolledSourceName>(
  source: PolledSource<N>,
  earlier: Partial<RawFiles>,
  gathered: Partial<RawFiles>,
  previous: SourceStatus | undefined,
  deps: GatherDeps,
): Promise<SourceStatus> {
  const started = deps.now();
  try {
    const data = await source.gather(earlier);
    const finished = deps.now();
    const file: RawSourceFile<N> = {
      source: source.name,
      gatheredAt: finished.toISOString(),
      data,
    };
    await deps.store.write(source.name, file);
    gathered[source.name] = file as Partial<RawFiles>[N];
    return {
      state: "ok",
      lastSucceededAt: finished.toISOString(),
      durationMs: finished.getTime() - started.getTime(),
    };
  } catch (error) {
    const kept = (await deps.store.read(
      source.name,
    )) as RawSourceFile<N> | null;
    if (kept !== null) gathered[source.name] = kept as Partial<RawFiles>[N];
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
 * Gathers every polled source, round by round, each into its own raw file. A failing source
 * leaves its previous raw file in place, and later rounds read that file; status.json records
 * each outcome.
 */
export async function gather(deps: GatherDeps): Promise<StatusFile> {
  const started = deps.now();
  const previous = (await deps.store.read("status")) as StatusFile | null;
  const earlier: Partial<RawFiles> = {};
  const sources: Partial<Record<PolledSourceName, SourceStatus>> = {};
  for (const configuredRound of gatherRounds) {
    const round = configuredRound.filter((name) => deps.sources[name] !== null);
    const gathered: Partial<RawFiles> = {};
    const outcomes = await Promise.all(
      round.map((name) =>
        gatherSource(
          deps.sources[name] as PolledSource<typeof name>,
          earlier,
          gathered,
          previous?.sources[name],
          deps,
        ),
      ),
    );
    round.forEach((name, index) => {
      sources[name] = outcomes[index] as SourceStatus;
    });
    Object.assign(earlier, gathered);
  }
  const status: StatusFile = {
    gatheredAt: started.toISOString(),
    durationMs: deps.now().getTime() - started.getTime(),
    sources,
  };
  await deps.store.write("status", status);
  return status;
}
