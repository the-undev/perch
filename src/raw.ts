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

export type ItemKind = "repo" | "vault" | "server";

export type DiscoveredItem =
  | { id: string; name: string; kind: "repo" | "vault"; path: string }
  | { id: string; name: string; kind: "server" };

/** .scan/raw/discovery.json: the items found under the configured roots, plus the server. */
export interface DiscoveryFile {
  gatheredAt: string;
  home: string;
  items: DiscoveredItem[];
  /** Problems finding items, such as a configured root that does not exist. */
  warnings: string[];
}

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
  url: string;
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

export interface RawClaudeSessions {
  /** The directory under ~/.claude/projects for the item's path. */
  directory: string;
  transcripts: Observed<RawTranscript[], "no-project-directory">;
}

// Forges

export interface RawForgeRemote {
  remoteName: string;
  host: string;
  owner: string;
  repo: string;
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

export interface RawGithub {
  remote: RawForgeRemote;
  account: string;
  defaultBranch: string;
  openPullRequests: RawPullRequest[];
  latestRun: Observed<RawGithubRun, "no-runs-on-default-branch">;
}

export interface RawCommitStatus {
  context: string;
  status: string;
  targetUrl: Observed<string, "no-target-url">;
  createdAt: string;
}

export interface RawForgejo {
  remote: RawForgeRemote;
  defaultBranch: string;
  openPullRequests: RawPullRequest[];
  /** The default branch head's combined commit status as Forgejo reports it. */
  combinedStatus: { state: string; statuses: RawCommitStatus[] };
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

// Source files

/** Per-item entry type for each polled source. */
export interface RawEntries {
  git: Entry<RawGit, never>;
  roadmap: Entry<RawRoadmap, "no-roadmap-file">;
  claudeSessions: Entry<RawClaudeSessions, never>;
  github: Entry<RawGithub, "no-github-remote">;
  forgejo: Entry<RawForgejo, "no-forgejo-remote">;
  kuma: Entry<RawKuma, never>;
}

export type PolledSourceName = keyof RawEntries;

/** .scan/raw/<source>.json */
export interface RawSourceFile<N extends PolledSourceName> {
  source: N;
  gatheredAt: string;
  items: Record<string, RawEntries[N]>;
}

export type RawFiles = { [N in PolledSourceName]: RawSourceFile<N> };

export type FailureReason =
  | "token-not-stored"
  | "request-failed"
  | "unexpected";

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
  sources: Record<PolledSourceName, SourceStatus>;
}
