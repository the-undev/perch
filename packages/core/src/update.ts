// The release check: one unauthenticated read of the-undev/perch's latest GitHub release, compared
// with the running version, at most hourly however often the scan runs. A failed check keeps the
// last answer. The status row the Updates page shows is derived here too. No Node modules, so the
// renderer may import it.

import { type FetchJson, HttpStatusError, NoAnswerError } from "./http.ts";
import { asRecord, stringField } from "./json.ts";
import { hoursWords } from "./speech.ts";

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

/** What the status row's one button does. */
export type UpdateAction = "check" | "open" | "install" | "restart";

/** The Updates page's first row: a sentence, a detail line and one button, whatever the state. */
export interface UpdateStatus {
  sentence: string;
  /** The line beneath: the releases link, an amber failure, the download's bar, or a quiet note. */
  detail:
    | { kind: "link" }
    | { kind: "failure"; text: string }
    | { kind: "progress"; fraction: number }
    | { kind: "note"; text: string };
  button: {
    action: UpdateAction;
    label: string;
    /** Drawn as the page's primary action when perch has a next step to take; else quiet. */
    primary: boolean;
    /** Pressing does nothing now: a check or a download is running. */
    held: boolean;
  };
}

/** How long before now a time was: "just now", "4 minutes ago", "two hours ago". */
function agoWords(at: string, now: Date): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(at)) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  return `${hoursWords(Math.floor(minutes / 60))} ago`;
}

/** Whole megabytes. */
const megabytes = (bytes: number) => Math.round(bytes / 1_000_000);

/** The status row for an update state, its ages measured to now. */
export function updateStatus(update: UpdateState, now: Date): UpdateStatus {
  const { running, release, download, checkedAt, failure } = update;
  const check = {
    action: "check" as const,
    label: "Check now",
    primary: false,
    held: update.checking,
  };
  if (download.state === "ready") {
    return {
      sentence: `${download.version} is downloaded. It runs from the next start.`,
      detail: {
        kind: "note",
        text: `The image at ${update.image ?? "the AppImage"} is replaced when Perch quits.`,
      },
      button: {
        action: "restart",
        label: "Restart now",
        primary: true,
        held: false,
      },
    };
  }
  if (download.state === "downloading") {
    return {
      sentence:
        download.total > 0
          ? `Downloading ${download.version}: ${megabytes(download.transferred)} of ${megabytes(download.total)} MB.`
          : `Downloading ${download.version}.`,
      detail: {
        kind: "progress",
        fraction:
          download.total > 0 ? download.transferred / download.total : 0,
      },
      button: {
        action: "install",
        label: `Install ${download.version}`,
        primary: true,
        held: true,
      },
    };
  }
  if (update.checking) {
    return { sentence: "Checking…", detail: { kind: "link" }, button: check };
  }
  const failed =
    download.state === "failed"
      ? download.failure
      : failure === null
        ? null
        : `The check failed: ${failure}.`;
  const detail: UpdateStatus["detail"] =
    failed === null ? { kind: "link" } : { kind: "failure", text: failed };
  if (release !== null) {
    const button = update.installs
      ? {
          action: "install" as const,
          label: `Install ${release.version}`,
          primary: true,
          held: false,
        }
      : {
          action: "open" as const,
          label: "Open the releases page",
          primary: true,
          held: false,
        };
    const sentence =
      failure !== null
        ? `Running ${running}. Last known: ${release.version} is out.`
        : `${release.version} is out. This is ${running}. Checked ${checkedAt === null ? "just now" : agoWords(checkedAt, now)}.`;
    return { sentence, detail, button };
  }
  if (checkedAt === null) {
    if (failure !== null) {
      return {
        sentence: `Running ${running}. No check has answered yet.`,
        detail,
        button: check,
      };
    }
    return {
      sentence: update.checkOn
        ? `Running ${running}. No check yet.`
        : `Running ${running}. Checking is off; press to check once.`,
      detail,
      button: check,
    };
  }
  return {
    sentence:
      failure !== null
        ? `Running ${running}, the latest release when checked ${agoWords(checkedAt, now)}.`
        : `Running ${running}, the latest release. Checked ${agoWords(checkedAt, now)}.`,
    detail,
    button: check,
  };
}
