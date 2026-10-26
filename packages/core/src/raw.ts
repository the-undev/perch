// Raw observed facts written by `pnpm gather`, one pretty-printed JSON file per source under
// .scan/raw/. These types are the source of truth for those files. Nothing here is judged: no
// ages, thresholds, levels or states. Every value that could be missing says why it is missing.

/** A value that was not observed, with a machine-readable reason. */
export interface Absent<R extends string> {
  state: "absent";
  reason: R;
}

/** A value that was either observed or is absent for a stated reason. */
export type Observed<T, R extends string> =
  | { state: "observed"; value: T }
  | Absent<R>;

/** Something that went wrong reading one item, recorded as data rather than failing the source. */
export interface EntryError {
  state: "error";
  error: string;
}

/** One item's entry in a source file. */
export type Entry<T, R extends string> = Observed<T, R> | EntryError;

// Git

export interface RawCommit {
  sha: string;
  committedAt: string;
  subject: string;
}

export type Tracking =
  | { state: "tracking"; upstream: string; ahead: number; behind: number }
  | { state: "absent"; reason: "no-tracking-branch" }
  | { state: "absent"; reason: "upstream-gone"; upstream: string };

export interface RawBranch {
  name: string;
  lastCommit: RawCommit;
  tracking: Tracking;
}

export interface RawDirtyFile {
  path: string;
  /** The two-letter porcelain v2 status code, or ?? for an untracked path. */
  code: string;
  mtime: Observed<string, "file-deleted">;
}

export interface RawRemote {
  name: string;
  fetchUrl: string;
  /** Every URL a push goes to: the configured push URLs, or the fetch URL when there are none. */
  pushUrls: string[];
}

export interface RawGit {
  head:
    | { state: "branch"; name: string }
    | { state: "absent"; reason: "detached-head"; commit: string };
  lastCommit: Observed<RawCommit, "no-commits">;
  dirtyFiles: RawDirtyFile[];
  branches: RawBranch[];
  remotes: Observed<RawRemote[], "no-remote">;
  /** The branch refs/remotes/origin/HEAD points at. */
  originHead: Observed<string, "no-origin-head">;
  /**
   * Commits on local branches that no remote-tracking ref contains, newest first. With no
   * remote at all this is every commit on every branch.
   */
  unpushedCommits: RawCommit[];
  /**
   * The newest commits on the default branch, newest first, at most the configured number;
   * absent when that branch is not a local branch.
   */
  defaultBranchCommits: Observed<RawCommit[], "no-default-branch">;
}

// Roadmap

export interface RawBullet {
  /** The bullet's text with continuation lines joined, without the marker or checkbox. */
  text: string;
  line: number;
  checkbox: "checked" | "unchecked" | "none";
  /** #tag words on the bullet, without the #. */
  tags: string[];
}

export interface RawHeadingRef {
  text: string;
  level: number;
  line: number;
}

export interface RawSection {
  heading: string;
  level: number;
  line: number;
  tags: string[];
  /** Enclosing headings, outermost first. */
  parents: RawHeadingRef[];
  /** Top-level bullets directly under this heading, before the next heading. */
  bullets: RawBullet[];
  /** Other text directly under this heading, trimmed, paragraphs separated by a blank line. */
  prose: string;
}

/** A roadmap file as found: every heading in order, with the bullets beneath it. */
export interface RoadmapStructure {
  bulletsBeforeFirstHeading: RawBullet[];
  sections: RawSection[];
}

export interface RawRoadmapFile {
  /** Path relative to the item. */
  path: string;
  structure: Observed<RoadmapStructure, "file-not-found">;
}

export interface RawRoadmap {
  files: RawRoadmapFile[];
}

// Claude Code sessions

export interface RawTranscript {
  file: string;
  mtime: string;
}

export interface RawNewestTranscript {
  file: string;
  /** Timestamp of the last user or assistant line, read backwards from the end of the file. */
  lastMessageAt: Observed<string, "no-message-line" | "beyond-tail-limit">;
}

export interface RawClaudeSessions {
  /** The directory under ~/.claude/projects for the item's path. */
  directory: string;
  transcripts: Observed<RawTranscript[], "no-project-directory">;
  /** The transcript with the newest mtime. */
  newest: Observed<RawNewestTranscript, "no-transcripts">;
}

// Forges

export type ForgeName = "github" | "forgejo";

export interface RawForgeRepoInfo {
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  archived: boolean;
  fork: boolean;
  private: boolean;
  url: string;
}

/** One account's listing: its own repositories, with untracked forks left out by name. */
export interface RawForgeAccount {
  repos: RawForgeRepoInfo[];
  skippedForks: string[];
}

export interface RawPullRequest {
  number: number;
  title: string;
  author: Observed<string, "no-user">;
  draft: boolean;
  updatedAt: string;
  url: string;
}

export interface RawGithubRun {
  name: string;
  status: string;
  conclusion: Observed<string, "run-not-completed">;
  url: string;
  createdAt: string;
}

export interface RawCommitStatus {
  context: string;
  status: string;
  targetUrl: Observed<string, "no-target-url">;
  createdAt: string;
}

export type RawCi =
  | {
      forge: "github";
      latestRun: Observed<RawGithubRun, "no-runs-on-default-branch">;
    }
  | {
      forge: "forgejo";
      /** The default branch head's combined commit status as Forgejo reports it. */
      combinedStatus: { state: string; statuses: RawCommitStatus[] };
    };

export interface RawForgeDetails {
  openPullRequests: RawPullRequest[];
  ci: RawCi;
  /** The newest commits on the forge's default branch, newest first, as the forge reports them. */
  finalisedCommits: RawCommit[];
}

export interface RawForgeRepo {
  info: RawForgeRepoInfo;
  /** Listed under a configured account, or looked up because a local clone's remote names it. */
  foundBy: "account-listing" | "local-remote";
  /** The configured account whose token read it. */
  account: string;
  /** Other lower-case owner/name forms that local remotes used and the forge redirected. */
  aliases: string[];
  details: Entry<RawForgeDetails, "archived-slow-lane">;
}

// Uptime Kuma

export interface RawHeartbeat {
  /** Kuma's numeric status: 0 down, 1 up, 2 pending, 3 maintenance. */
  status: number;
  time: string;
  message: string;
}

export interface RawMonitor {
  id: number;
  name: string;
  group: string;
  /** Heartbeats as the status page returns them. */
  heartbeats: RawHeartbeat[];
}

export interface RawKuma {
  statusPage: string;
  monitors: RawMonitor[];
}

// Local presences

export type IncludeKind = "repo" | "directory";

export interface RawObsidian {
  /** Whether .obsidian/ exists at the repository root. */
  folder: boolean;
  /** Whether .obsidian/plugins/obsidian-livesync/ exists. */
  livesyncPlugin: boolean;
}

export interface RawLocalPresence {
  path: string;
  /** The configured include path the repository was found under. */
  include: string;
  obsidian: RawObsidian;
  git: Entry<RawGit, never>;
}

export interface RawLocal {
  /** Each configured include path: itself a repository, a directory searched for them, or missing. */
  includes: Record<string, Observed<IncludeKind, "path-not-found">>;
  /** Found repositories keyed by id, the path relative to the home directory. */
  presences: Record<string, RawLocalPresence>;
}

// Source files

/** Each polled source's data, as written to its raw file. */
export interface RawData {
  local: RawLocal;
  githubAccounts: Record<string, Entry<RawForgeAccount, never>>;
  forgejoAccounts: Record<string, Entry<RawForgeAccount, never>>;
  /** Status pages keyed by their source's name. */
  kuma: Record<string, Entry<RawKuma, never>>;
  roadmap: Record<string, Entry<RawRoadmap, "no-roadmap-file">>;
  claudeSessions: Record<string, Entry<RawClaudeSessions, never>>;
  /** Forge repositories keyed by lower-case owner/name. */
  github: Record<string, Entry<RawForgeRepo, "fork-not-tracked">>;
  forgejo: Record<string, Entry<RawForgeRepo, "fork-not-tracked">>;
}

export type PolledSourceName = keyof RawData;

/** .scan/raw/<source>.json */
export interface RawSourceFile<N extends PolledSourceName> {
  source: N;
  gatheredAt: string;
  data: RawData[N];
}

export type RawFiles = { [N in PolledSourceName]: RawSourceFile<N> };

export type FailureReason = "request-failed" | "unexpected";

export type SourceStatus =
  | { state: "ok"; lastSucceededAt: string; durationMs: number }
  | {
      state: "error";
      reason: FailureReason;
      message: string;
      lastSucceededAt: Observed<string, "never-succeeded">;
      durationMs: number;
    };

/** .scan/raw/status.json: how the last gather went, per source. */
export interface StatusFile {
  gatheredAt: string;
  durationMs: number;
  /** A source that did not run, such as kuma with no [[sources.kuma]] table, has no entry. */
  sources: Partial<Record<PolledSourceName, SourceStatus>>;
}
