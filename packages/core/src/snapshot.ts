// The snapshot written to .scan/snapshot.json by `pnpm aggregate`. Every value here is derived
// from the raw files by src/derivations.ts. These types are the snapshot's source of truth.

import type { FailureReason, ForgeName, PolledSourceName } from "./raw.ts";

export type { FailureReason, ForgeName, PolledSourceName };

export type ItemKind = "repo" | "vault" | "server";

export type LiveSourceName = "dockerContainers";

/** Data a source could not read for one item, kept as data rather than failing the source. */
export interface ItemError {
  error: string;
}

export type ActivityState = "settled" | "in-progress" | "editing";

export type HealthLevel = "green" | "amber" | "red";

/** A source the owner can assert an item should have: CI. */
export type ExpectationName = "ci";

export interface Remote {
  name: string;
  fetchUrl: string;
  pushUrls: string[];
}

export interface LocalBranch {
  name: string;
  lastCommitAt: string;
  subject: string;
  upstream: string | null;
}

/** Windows in hours: amber at or beyond the first, red at or beyond the second. */
export interface HourThresholds {
  amberHours: number;
  redHours: number;
}

/** Windows in days: amber at or beyond the first, red at or beyond the second. */
export interface DayThresholds {
  amberDays: number;
  redDays: number;
}

/** Unsafe work of one kind, aged from its oldest change and judged against the item's windows. */
export interface AgedWork {
  since: string;
  /** Whole hours from since to when git was read. */
  hours: number;
  level: HealthLevel;
}

/** Unsafe work: uncommitted changes and unpushed commits, each aged from its oldest. */
export interface Drift {
  /** The oldest uncommitted change, from the dirty files' mtimes; null when there is none. */
  uncommitted: AgedWork | null;
  /** The oldest commit no remote holds, aged only against a joined forge presence. */
  unpushed: AgedWork | null;
  /** The worse of the two levels; green when neither exists. */
  level: HealthLevel;
  thresholds: HourThresholds;
}

/** HEAD parked on a branch other than the default, aged from that branch's newest commit. */
export interface Stall {
  branch: string;
  since: string;
  /** Whole days from since to when git was read. */
  days: number;
  level: HealthLevel;
  thresholds: DayThresholds;
}

/**
 * Whether unpushed work has somewhere to go: a joined forge presence, a remote perch has no
 * presence for, or no remote at all (one disk).
 */
export type Backup = "joined" | "unjoined-remote" | "local-only";

export interface GitData {
  backup: Backup;
  /** Null when HEAD is detached. */
  branch: string | null;
  defaultBranch: string | null;
  upstream: string | null;
  uncommittedCount: number;
  /** Null when the current branch has no upstream. */
  ahead: number | null;
  behind: number | null;
  /** Commits on local branches that no remote-tracking ref contains; zero when local only. */
  unpushedCount: number;
  lastCommitAt: string | null;
  oldestUncommittedAt: string | null;
  oldestUnpushedAt: string | null;
  branches: LocalBranch[];
  remotes: Remote[];
  activity: ActivityState;
  drift: Drift;
  /** Null when HEAD is on the default branch, detached, or there is no default branch. */
  stall: Stall | null;
}

export type WorkItemKind = "bug" | "feature";

export interface WorkItem {
  text: string;
  kind: WorkItemKind;
  /** Null when the item carries no checkbox. */
  done: boolean | null;
  line: number;
  /** A bullet, or a bare heading whose prose is its body. */
  source: "bullet" | "heading";
  /** The prose under a heading item; null for a bullet or a heading with no prose. */
  body: string | null;
}

export interface Progress {
  done: number;
  total: number;
}

export interface WorkItemGroup {
  heading: string;
  level: number;
  line: number;
  /** A group has direct bullets; structure only holds sub-headings. */
  role: "group" | "structure";
  items: WorkItem[];
  groups: WorkItemGroup[];
  /** Checked against total checkbox items among the direct items, null without checkboxes. */
  progress: Progress | null;
}

export interface RoadmapFile {
  /** Path relative to the item. */
  path: string;
  /** Bullets above the first heading and bare top-level headings. */
  items: WorkItem[];
  groups: WorkItemGroup[];
}

export type WorkItemCounts = Record<WorkItemKind, number>;

export interface RoadmapData {
  /** Open items by kind across every file; done items are not counted. */
  counts: WorkItemCounts;
  files: RoadmapFile[];
}

export interface ClaudeSessionsData {
  lastSessionAt: string | null;
  /** Whether the time came from the newest transcript's last message or, failing that, its mtime. */
  basis: "last-message" | "file-mtime" | null;
}

export interface PullRequest {
  number: number;
  title: string;
  author: string | null;
  draft: boolean;
  updatedAt: string;
  url: string;
}

/** CI outcome in perch's own terms; neutral covers cancelled, skipped and warning results. */
export type CiState = "success" | "failure" | "pending" | "neutral";

export interface CiRun {
  name: string;
  state: CiState;
  /** The forge's own word for the result, for example completed/success or failure. */
  forgeState: string;
  url: string | null;
  createdAt: string | null;
}

export interface ForgeData {
  fullName: string;
  url: string;
  defaultBranch: string;
  openPullRequests: PullRequest[];
  /** Latest CI result on the default branch, null when there is none. */
  latestCi: CiRun | null;
  /** The newest commits on the forge's default branch: finalised work, against local work. */
  finalisedCommits: FinalisedCommit[];
}

export interface FinalisedCommit {
  sha: string;
  committedAt: string;
  subject: string;
}

export type MonitorStatus =
  | "up"
  | "down"
  | "pending"
  | "maintenance"
  | "unknown";

export interface Monitor {
  id: number;
  name: string;
  status: MonitorStatus;
  lastHeartbeatAt: string | null;
}

export interface KumaData {
  allUp: boolean;
  monitors: Monitor[];
}

/** Derived data per source on an item. */
export interface ItemSourceData {
  git: GitData | ItemError;
  roadmap: RoadmapData | ItemError;
  claudeSessions: ClaudeSessionsData | ItemError;
  github: ForgeData | ItemError;
  forgejo: ForgeData | ItemError;
  kuma: KumaData | ItemError;
}

export type ItemSources = Partial<ItemSourceData>;

export interface ForgePresence {
  forge: ForgeName;
  /** The presence reference, such as github:finch/perch. */
  ref: string;
  fullName: string;
  url: string;
  foundBy: "account-listing" | "local-remote";
}

export interface Presences {
  local: { ref: string; path: string } | null;
  forges: ForgePresence[];
}

export type ItemFlagName =
  | "not-set-up"
  | "remote-archived"
  | "remote-joined-elsewhere"
  | "config-conflict";

export interface ItemFlag {
  flag: ItemFlagName;
  /** The health level the flag carries where one is decided, else null. */
  level: HealthLevel | null;
  detail: string;
}

/** An expectation config asserts for an item, and whether the scan finds it met. */
export interface Expectation {
  name: ExpectationName;
  met: boolean;
  /** When a scan first found it unmet, carried forward between scans; null while met. */
  unmetSince: string | null;
  /** Whole days from unmetSince to the scan; null while met. */
  days: number | null;
  level: HealthLevel;
  thresholds: DayThresholds;
}

export interface Item {
  /** A local presence's id, or the first forge presence's reference for a forge-only item. */
  id: string;
  name: string;
  kind: ItemKind;
  /** Absolute path of the local clone, null without one. */
  path: string | null;
  /** Live sources a detail view may fetch for this item; never part of the scan. */
  liveSources: LiveSourceName[];
  presences: Presences;
  flags: ItemFlag[];
  /** Only the expectations config asserts for the item, in config order. */
  expectations: Expectation[];
  sources: ItemSources;
}

/** A config assertion that the observations contradict; the observation won. */
export interface ConfigConflict {
  assertion: string;
  detail: string;
}

export interface ForgeListingEntry {
  ref: string;
  fullName: string;
  url: string;
  /** The item this presence belongs to, null when it is on no item. */
  itemId: string | null;
  ignored: boolean;
}

/** What a forge holds, for its drill-down view; archived repositories only appear here. */
export interface ForgeListing {
  active: ForgeListingEntry[];
  archived: ForgeListingEntry[];
}

export interface SourceStatus {
  state: "ok" | "error";
  reason: FailureReason | null;
  error: string | null;
  lastSucceededAt: string | null;
  durationMs: number;
}

export type SourceCardKind = "local" | "github" | "forgejo" | "kuma";

/** A source card's last scan: never read, read with what it found, or failed. */
export type SourceCardResult =
  | { state: "never-scanned" }
  | {
      state: "ok";
      /** When the card's raw file was gathered. */
      at: string;
      /** Repositories found or listed, or a kuma page's monitors. */
      count: number;
      /** A local card's include paths that do not exist, home as ~; empty for other kinds. */
      missingIncludes: string[];
    }
  | {
      state: "failed";
      message: string;
      /** When the card last read, carried from the previous snapshot; null when unknown. */
      lastSucceededAt: string | null;
    };

/** One configured source table, as its settings card shows it, with its last scan. */
export interface SourceCard {
  /** Stable identity: local:<first include>, github:<account>, forgejo:<account>@<host>, kuma:<name>. */
  id: string;
  kind: SourceCardKind;
  /** The card's heading: the account, account@host, the kuma name, or the include paths, home as ~. */
  label: string;
  result: SourceCardResult;
}

export interface Snapshot {
  /** When the raw files were gathered, and how long gathering took. */
  scannedAt: string;
  durationMs: number;
  aggregatedAt: string;
  configPath: string;
  /** Problems outside any one item, such as a configured include path that does not exist. */
  warnings: string[];
  conflicts: ConfigConflict[];
  forges: Record<ForgeName, ForgeListing>;
  sources: Partial<Record<PolledSourceName, SourceStatus>>;
  /** One per configured source table, in config order: local, github, forgejo, then kuma. */
  sourceCards: SourceCard[];
  items: Item[];
}
