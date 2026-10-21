import type {
  DiscoveredItem,
  PolledSourceName,
  RawEntries,
  RawFiles,
} from "../raw.ts";
import type { Item, LiveSourceName } from "../snapshot.ts";

/**
 * A source that runs in the periodic, unattended gather. It returns raw entries keyed by item id
 * for the items it applies to, and may read the raw files of sources gathered before it.
 * Throwing fails the whole source; a problem with one item is recorded as that item's entry.
 */
export interface PolledSource<N extends PolledSourceName> {
  readonly name: N;
  gather(
    items: readonly DiscoveredItem[],
    earlier: Partial<RawFiles>,
  ): Promise<Record<string, RawEntries[N]>>;
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
