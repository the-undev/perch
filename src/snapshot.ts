// The snapshot schema written to scan.local.json. These types are its source of truth.

export type ItemKind = "repo" | "vault" | "server";

export type PolledSourceName =
  | "git"
  | "roadmap"
  | "claudeSessions"
  | "github"
  | "forgejo"
  | "kuma";

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
}

export interface Progress {
  done: number;
  total: number;
}

export interface WorkItemGroup {
  /** Null for items above the first heading. */
  heading: string | null;
  level: number;
  items: WorkItem[];
  /** Checked against total checkbox items, null when the group has no checkboxes. */
  progress: Progress | null;
}

export interface RoadmapFile {
  /** Path relative to the item. */
  path: string;
  /** Whether items came from bullets or, for a file without bullets, from headings. */
  itemSource: "bullets" | "headings";
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
  error: string | null;
  lastSucceededAt: string | null;
  durationMs: number;
}

export interface Snapshot {
  scannedAt: string;
  durationMs: number;
  configPath: string;
  /** Problems outside any one source, such as a configured root that does not exist. */
  warnings: string[];
  sources: Record<PolledSourceName, SourceStatus>;
  items: Item[];
}
