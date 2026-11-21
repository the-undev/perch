// The owner's snoozes, kept in a state file beside the scan: local state, never config. The file is
// a JSON object keyed by bird id, each snooze `{ "until": "YYYY-MM-DD" }` or `{ "until": null }`
// for indefinitely. A person can edit it by hand, so every entry is checked as it is read.

import { errorMessage } from "@perch/core/fs.ts";
import { isEndDate } from "@perch/core/snooze-date.ts";
import type { Snooze, Snoozes } from "@perch/core/viewmodel.ts";

/** The snoozes the app runs on, and what is wrong with the file they were read from. */
export interface SnoozeState {
  snoozes: Snoozes;
  /** Why the latest read failed, and each entry that holds no end date perch can read. */
  problems: string[];
}

export interface SnoozeStoreDeps {
  /** The state file, the only file the store reads and writes. */
  path: string;
  /** A file's text; null when it does not exist. */
  readText: (path: string) => Promise<string | null>;
  /** Replaces a file's text in one step, making its directory when missing. */
  writeText: (path: string, text: string) => Promise<void>;
}

export interface SnoozeStore {
  /** Reads the file again; a failure keeps the snoozes last read, a missing file holds none. */
  reload(): Promise<void>;
  current(): SnoozeState;
  /**
   * Sets a bird's snooze, or removes it with null, in a fresh read of the file; rejects, writing
   * nothing, when the file does not parse. Every other entry is written back as it was found.
   */
  write(birdId: string, snooze: Snooze | null): Promise<void>;
}

type StoredEntries = Record<string, unknown>;

function isEntries(value: unknown): value is StoredEntries {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readEntries(path: string, text: string | null): StoredEntries {
  if (text === null) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} does not parse: ${errorMessage(error)}`);
  }
  if (!isEntries(value)) {
    throw new Error(`${path} must hold an object of snoozes keyed by bird id`);
  }
  return value;
}

/**
 * An entry without an end date perch can read stays snoozed until woken and is named as a problem:
 * dropping it would wake the bird without a word.
 */
function stateOf(entries: StoredEntries): SnoozeState {
  const snoozes: Snoozes = {};
  const problems: string[] = [];
  for (const [birdId, entry] of Object.entries(entries)) {
    const until = isEntries(entry) ? entry.until : undefined;
    if (until === null || isEndDate(until)) {
      snoozes[birdId] = { until };
      continue;
    }
    snoozes[birdId] = { until: null };
    problems.push(
      `The snooze of ${birdId} has no end date perch can read (${JSON.stringify(entry)}), so it lasts until you wake it`,
    );
  }
  return { snoozes, problems };
}

/** Holds the snoozes across reads, so a file that does not parse never takes the app down. */
export function createSnoozeStore(deps: SnoozeStoreDeps): SnoozeStore {
  let state: SnoozeState = { snoozes: {}, problems: [] };

  const fresh = async () =>
    readEntries(deps.path, await deps.readText(deps.path));

  return {
    async reload() {
      try {
        state = stateOf(await fresh());
      } catch (error) {
        state = {
          snoozes: state.snoozes,
          problems: [`The snoozes were not read: ${errorMessage(error)}`],
        };
      }
    },
    current: () => state,
    async write(birdId, snooze) {
      const { [birdId]: _replaced, ...others } = await fresh();
      const entries =
        snooze === null ? others : { ...others, [birdId]: snooze };
      await deps.writeText(deps.path, `${JSON.stringify(entries, null, 2)}\n`);
      state = stateOf(entries);
    },
  };
}
