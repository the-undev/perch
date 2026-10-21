// The snapshot written to .scan/snapshot.json by `pnpm aggregate`. Every value here is derived
// from the raw files by src/derivations.ts. These types are the snapshot's source of truth.

import type { FailureReason, ItemKind, PolledSourceName } from "./raw.ts";

export type { ItemKind, PolledSourceName };

export type LiveSourceName = "dockerContainers";

/** Data a source could not read for one item, kept as data rather than failing the source. */
export interface ItemError {
  error: string;
}

export type ActivityState = "settled" | "in-progress" | "editing";

export type HealthLevel = "green" | "amber" | "red";

export interface Remote {
  name: string;
  url: string;
}

export interface LocalBranch {
  name: string;
  lastCommitAt: string;
  subject: string;
  upstream: string | null;
}

export interface DriftThresholds {
  amberDays: number;
  redDays: number;
}

export interface Drift {
  /** Age in whole days of the oldest uncommitted change, from the dirty files' mtimes. */
  uncommittedDays: number | null;
  /** Age in whole days of the oldest commit on any local branch that no remote holds. */
  unpushedDays: number | null;
  /** The larger of the two ages, null when nothing is uncommitted or unpushed. */
  driftDays: number | null;
  level: HealthLevel;
  thresholds: DriftThresholds;
}

export interface GitData {
  /** Null when HEAD is detached. */
  branch: string | null;
  defaultBranch: string | null;
  upstream: string | null;
  uncommittedCount: number;
  /** Null when the current branch has no upstream. */
  ahead: number | null;
  behind: number | null;
  /** Commits on local branches that no remote-tracking ref contains. */
  unpushedCount: number;
  lastCommitAt: string | null;
  oldestUncommittedAt: string | null;
  oldestUnpushedAt: string | null;
  branches: LocalBranch[];
  remotes: Remote[];
  activity: ActivityState;
  drift: Drift;
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
  host: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  openPullRequests: PullRequest[];
  /** Latest CI result on the default branch, null when there is none. */
  latestCi: CiRun | null;
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

export interface PolledSourceData {
  git: GitData | ItemError;
  roadmap: RoadmapData | ItemError;
  claudeSessions: ClaudeSessionsData | ItemError;
  github: ForgeData | ItemError;
  forgejo: ForgeData | ItemError;
  kuma: KumaData | ItemError;
}

export type ItemSources = Partial<PolledSourceData>;

export interface Item {
  /** Path relative to the home directory, or a fixed name for items without a path. */
  id: string;
  name: string;
  kind: ItemKind;
  /** Absolute path, null for the server. */
  path: string | null;
  importance: string;
  /** Live sources a detail view may fetch for this item; never part of the scan. */
  liveSources: LiveSourceName[];
  sources: ItemSources;
}

export interface SourceStatus {
  state: "ok" | "error";
  reason: FailureReason | null;
  error: string | null;
  lastSucceededAt: string | null;
  durationMs: number;
}

export interface Snapshot {
  /** When the raw files were gathered, and how long gathering took. */
  scannedAt: string;
  durationMs: number;
  aggregatedAt: string;
  configPath: string;
  /** Problems outside any one source, such as a configured root that does not exist. */
  warnings: string[];
  sources: Record<PolledSourceName, SourceStatus>;
  items: Item[];
}
