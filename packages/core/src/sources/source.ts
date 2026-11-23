import type { PolledSourceName, RawData, RawFiles } from "../raw.ts";

/**
 * A source that runs in the periodic, unattended gather. Root collectors read config and the
 * outside world; enrichers read the raw files of sources gathered in an earlier round.
 * Throwing fails the whole source; a problem with one entry is recorded as that entry.
 */
export interface PolledSource<N extends PolledSourceName> {
  readonly name: N;
  gather(earlier: Partial<RawFiles>): Promise<RawData[N]>;
}
