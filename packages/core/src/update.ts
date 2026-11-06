// The release check: one unauthenticated read of the-undev/perch's latest GitHub release, compared
// with the running version, at most hourly however often the scan runs. A failed check keeps the
// last answer. No Node modules, so the renderer may import the types.

import { type FetchJson, HttpStatusError, NoAnswerError } from "./http.ts";
import { asRecord, stringField } from "./json.ts";

/** The releases page every status row links to. */
export const releasesPage = "https://github.com/the-undev/perch/releases";

/** The API answer naming the latest release; drafts and prereleases are never it. */
export const latestReleaseUrl =
  "https://api.github.com/repos/the-undev/perch/releases/latest";

/** A scheduled check runs at most once in this long, whatever the scan interval. */
export const checkGapMs = 3_600_000;

/** A release newer than the running version: its version without a v, and its page. */
export interface Release {
  version: string;
  url: string;
}

/** What the checks have learned so far. */
export interface ReleaseCheck {
  /** The newer release the latest answer named; null when none was newer or none answered. */
  release: Release | null;
  /** When a check last answered, ISO; null before any did. */
  checkedAt: string | null;
  /** Why the latest check failed, as a clause after "The check failed: "; null once one answers. */
  failure: string | null;
  /** A check is running. */
  checking: boolean;
}

/** The download of a newer release, while perch installs updates. */
export type DownloadState =
  | { state: "none" }
  | {
      state: "downloading";
      version: string;
      transferred: number;
      total: number;
    }
  | { state: "ready"; version: string }
  | {
      state: "failed";
      version: string;
      /** The amber sentence: what failed and why. */
      failure: string;
    };

/** Everything the Updates page's status row and the tray entry read, pushed with each change. */
export interface UpdateState extends ReleaseCheck {
  /** The running version. */
  running: string;
  /** Config's [update] check: the scan cycle checks by itself. */
  checkOn: boolean;
  /** Config's [update] install, with an image to replace: perch downloads and installs. */
  installs: boolean;
  /** The image an install replaces, shown with ~; null when run from source. */
  image: string | null;
  download: DownloadState;
}

/** A version's numeric parts and its prerelease label, or null for text that is not one. */
interface Version {
  numbers: [number, number, number];
  prerelease: string | null;
}

/** Reads "0.3.0", "v0.3.0" or "0.3.0-dev"; null for anything else. */
export function parseVersion(text: string): Version | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(
    text.trim(),
  );
  if (match === null) return null;
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? null,
  };
}

/** Below zero when a comes first, above when b does; a prerelease comes before its release. */
function compareVersions(a: Version, b: Version): number {
  for (let at = 0; at < 3; at += 1) {
    const difference = (a.numbers[at] ?? 0) - (b.numbers[at] ?? 0);
    if (difference !== 0) return difference;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease < b.prerelease ? -1 : 1;
}

/** The tag's version without its v when it is newer than the running one; else null. */
export function newerVersion(tag: string, running: string): string | null {
  const released = parseVersion(tag);
  const current = parseVersion(running);
  if (released === null) {
    throw new Error(`the latest release's tag ${tag} is not a version`);
  }
  if (current === null) {
    throw new Error(`the running version ${running} is not a version`);
  }
  if (compareVersions(released, current) <= 0) return null;
  return tag.trim().replace(/^v/, "");
}

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "perch",
};

/** The latest release when it is newer than the running version, else null; rejects on failure. */
export async function readLatestRelease(
  fetchJson: FetchJson,
  running: string,
): Promise<Release | null> {
  const record = asRecord(
    await fetchJson(latestReleaseUrl, headers),
    "release",
  );
  const version = newerVersion(stringField(record, "tag_name"), running);
  if (version === null) return null;
  return { version, url: stringField(record, "html_url") };
}

/** Why a check failed, as a clause: the host that did not answer, the status it gave, or the error. */
export function checkFailureWords(error: unknown): string {
  if (error instanceof NoAnswerError) return "api.github.com did not answer";
  if (error instanceof HttpStatusError) {
    return `api.github.com answered HTTP ${error.status}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export interface ReleaseCheckerDeps {
  fetchJson: FetchJson;
  /** The running version. */
  running: string;
  now: () => Date;
  /** Told every change to what the checks have learned. */
  onChange: (check: ReleaseCheck) => void;
}

export interface ReleaseChecker {
  state(): ReleaseCheck;
  /** Checks when no check has started in the last hour; joins one running. */
  checkIfDue(): Promise<void>;
  /** Checks now whatever the hour, joining one running. */
  checkNow(): Promise<void>;
}

export function createReleaseChecker(deps: ReleaseCheckerDeps): ReleaseChecker {
  let check: ReleaseCheck = {
    release: null,
    checkedAt: null,
    failure: null,
    checking: false,
  };
  let running: Promise<void> | null = null;
  let lastStartedAt: number | null = null;

  const set = (next: ReleaseCheck) => {
    check = next;
    deps.onChange(check);
  };

  async function attempt(): Promise<void> {
    lastStartedAt = deps.now().getTime();
    set({ ...check, checking: true });
    try {
      const release = await readLatestRelease(deps.fetchJson, deps.running);
      set({
        release,
        checkedAt: deps.now().toISOString(),
        failure: null,
        checking: false,
      });
    } catch (error) {
      set({ ...check, failure: checkFailureWords(error), checking: false });
    }
  }

  function checkNow(): Promise<void> {
    running ??= attempt().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    state: () => check,
    checkIfDue() {
      if (running !== null) return running;
      const due =
        lastStartedAt === null ||
        deps.now().getTime() - lastStartedAt >= checkGapMs;
      return due ? checkNow() : Promise.resolve();
    },
    checkNow,
  };
}
