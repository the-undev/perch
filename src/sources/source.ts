import type { PolledSourceName, RawData, RawFiles } from "../raw.ts";
import type { Item, LiveSourceName } from "../snapshot.ts";

/**
 * A source that runs in the periodic, unattended gather. Root collectors read config and the
 * outside world; enrichers read the raw files of sources gathered in an earlier round.
 * Throwing fails the whole source; a problem with one entry is recorded as that entry.
 */
export interface PolledSource<N extends PolledSourceName> {
  readonly name: N;
  gather(earlier: Partial<RawFiles>): Promise<RawData[N]>;
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
