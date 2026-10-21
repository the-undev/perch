import type {
  Item,
  LiveSourceName,
  PolledSourceData,
  PolledSourceName,
} from "../snapshot.ts";

/**
 * A source that runs in the periodic, unattended scan and feeds the glance.
 * It receives the items with the data of earlier sources filled in, and returns data keyed by
 * item id for the items it applies to. Throwing marks the whole source as failed.
 */
export interface PolledSource<N extends PolledSourceName> {
  readonly name: N;
  scan(
    items: readonly Item[],
  ): Promise<ReadonlyMap<string, PolledSourceData[N]>>;
}

export type LiveResult<T> =
  | { state: "ok"; data: T }
  | { state: "error"; error: string }
  | { state: "not-implemented" };

/** A source fetched by a detail view when it opens, never cached or run by the scan. */
export interface LiveSource<N extends LiveSourceName, T> {
  readonly name: N;
  appliesTo(item: Item): boolean;
  fetch(item: Item): Promise<LiveResult<T>>;
}
