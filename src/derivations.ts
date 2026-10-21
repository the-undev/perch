// Every derivation rule perch applies to raw facts, in one place. Gathering never judges; each
// rule here can be read and changed without touching how the machine is read.

import type {
  Observed,
  RawBullet,
  RawClaudeSessions,
  RawForgejo,
  RawGit,
  RawGithub,
  RawGithubRun,
  RawKuma,
  RawPullRequest,
  RawRoadmap,
  RawSection,
  RoadmapStructure,
} from "./raw.ts";
import type {
  ActivityState,
  CiRun,
  CiState,
  ClaudeSessionsData,
  Drift,
  DriftThresholds,
  ForgeData,
  GitData,
  HealthLevel,
  ItemError,
  KumaData,
  MonitorStatus,
  PullRequest,
  RoadmapData,
  RoadmapFile,
  WorkItem,
  WorkItemCounts,
  WorkItemGroup,
} from "./snapshot.ts";

// Work items

/** A heading whose text contains the word bug or bugs, in any case, marks the items beneath it. */
export function mentionsBugs(heading: string): boolean {
  return /\bbugs?\b/i.test(heading);
}

/** A #bug tag on an item's line marks it as a bug wherever it sits. */
function hasBugTag(tags: readonly string[]): boolean {
  return tags.some((tag) => tag.toLowerCase() === "bug");
}

/** Progress is checked against total checkbox items; null for a group without checkboxes. */
function progressOf(items: readonly WorkItem[]): WorkItemGroup["progress"] {
  const checkboxes = items.filter((item) => item.done !== null);
  if (checkboxes.length === 0) return null;
  const done = checkboxes.filter((item) => item.done === true).length;
  return { done, total: checkboxes.length };
}

function bulletItem(bullet: RawBullet, underBugs: boolean): WorkItem {
  return {
    text: bullet.text,
    kind: underBugs || hasBugTag(bullet.tags) ? "bug" : "feature",
    done: bullet.checkbox === "none" ? null : bullet.checkbox === "checked",
    line: bullet.line,
    source: "bullet",
    body: null,
  };
}

function headingItem(section: RawSection, underBugs: boolean): WorkItem {
  const bug =
    underBugs || mentionsBugs(section.heading) || hasBugTag(section.tags);
  return {
    text: section.heading,
    kind: bug ? "bug" : "feature",
    done: null,
    line: section.line,
    source: "heading",
    body: section.prose === "" ? null : section.prose,
  };
}

/**
 * Work items from one roadmap file, by the per-heading rule. A heading with direct bullets is a
 * group whose bullets are items. A heading with no bullets and no sub-headings is one item, its
 * prose the body. A heading with sub-headings and no bullets is structure; one with both is a
 * group with nested sub-groups. Bullets above the first heading are items at the top. An item is
 * a bug under any heading mentioning bugs, or with a #bug tag. Checkboxes set done.
 */
export function deriveRoadmapFile(
  path: string,
  structure: RoadmapStructure,
): RoadmapFile {
  const children = new Map<number, RawSection[]>();
  const roots: RawSection[] = [];
  for (const section of structure.sections) {
    const parent = section.parents.at(-1);
    if (parent === undefined) {
      roots.push(section);
      continue;
    }
    children.set(parent.line, [...(children.get(parent.line) ?? []), section]);
  }
  const childrenOf = (section: RawSection) => children.get(section.line) ?? [];
  const isBare = (section: RawSection) =>
    section.bullets.length === 0 && childrenOf(section).length === 0;

  const node = (section: RawSection, ancestorsBugs: boolean): WorkItemGroup => {
    const bugs = ancestorsBugs || mentionsBugs(section.heading);
    const items = [
      ...section.bullets.map((bullet) => bulletItem(bullet, bugs)),
      ...childrenOf(section)
        .filter(isBare)
        .map((child) => headingItem(child, bugs)),
    ];
    return {
      heading: section.heading,
      level: section.level,
      line: section.line,
      role: section.bullets.length > 0 ? "group" : "structure",
      items,
      groups: childrenOf(section)
        .filter((child) => !isBare(child))
        .map((child) => node(child, bugs)),
      progress: progressOf(items),
    };
  };

  return {
    path,
    items: [
      ...structure.bulletsBeforeFirstHeading.map((bullet) =>
        bulletItem(bullet, false),
      ),
      ...roots.filter(isBare).map((section) => headingItem(section, false)),
    ],
    groups: roots
      .filter((section) => !isBare(section))
      .map((section) => node(section, false)),
  };
}

function allItems(group: WorkItemGroup): WorkItem[] {
  return [...group.items, ...group.groups.flatMap(allItems)];
}

/** Counts open items by kind across files and every nested group; done items are left out. */
export function countOpenItems(files: readonly RoadmapFile[]): WorkItemCounts {
  const counts: WorkItemCounts = { bug: 0, feature: 0 };
  for (const file of files) {
    for (const item of [...file.items, ...file.groups.flatMap(allItems)]) {
      if (item.done !== true) counts[item.kind] += 1;
    }
  }
  return counts;
}

/**
 * Roadmap data for an item. A configured file that was not found makes the whole entry an
 * error naming the file.
 */
export function deriveRoadmap(raw: RawRoadmap): RoadmapData | ItemError {
  const files: RoadmapFile[] = [];
  for (const file of raw.files) {
    if (file.structure.state === "absent") {
      return { error: `roadmap file not found: ${file.path}` };
    }
    files.push(deriveRoadmapFile(file.path, file.structure.value));
  }
  return { counts: countOpenItems(files), files };
}

/** An item without a roadmap file has no work items. */
export const emptyRoadmap: RoadmapData = {
  counts: { bug: 0, feature: 0 },
  files: [],
};

// Git

const dayMs = 24 * 60 * 60 * 1000;

/** The default branch: where origin/HEAD points, else main or master if such a branch exists. */
export function chooseDefaultBranch(
  originHead: RawGit["originHead"],
  branchNames: readonly string[],
): string | null {
  if (originHead.state === "observed") return originHead.value;
  return ["main", "master"].find((name) => branchNames.includes(name)) ?? null;
}

export interface ActivityInput {
  uncommittedCount: number;
  unpushedCount: number;
  branch: string | null;
  defaultBranch: string | null;
  branchNames: readonly string[];
}

/**
 * The git work-state. Editing when any file is uncommitted. Otherwise in progress when any
 * commit is unpushed, HEAD is not on the default branch, or any other local branch exists.
 * Otherwise settled.
 */
export function deriveActivity(input: ActivityInput): ActivityState {
  if (input.uncommittedCount > 0) return "editing";
  if (input.unpushedCount > 0) return "in-progress";
  if (input.branch !== input.defaultBranch) return "in-progress";
  const otherBranches = input.branchNames.filter(
    (name) => name !== input.defaultBranch,
  );
  return otherBranches.length > 0 ? "in-progress" : "settled";
}

/** Whole days from a timestamp to the observation time, never negative. */
function ageInDays(since: string | null, observedAt: Date): number | null {
  if (since === null) return null;
  const elapsed = observedAt.getTime() - new Date(since).getTime();
  return Math.max(0, Math.floor(elapsed / dayMs));
}

/** Red at or beyond the red threshold, amber at or beyond amber, else green; no drift is green. */
function levelFor(
  driftDays: number | null,
  thresholds: DriftThresholds,
): HealthLevel {
  if (driftDays === null) return "green";
  if (driftDays >= thresholds.redDays) return "red";
  if (driftDays >= thresholds.amberDays) return "amber";
  return "green";
}

/**
 * Drift is the age of the oldest uncommitted or unpushed work, the larger of the two, measured
 * at the time git was read and judged against the item's thresholds.
 */
export function deriveDrift(
  ages: { oldestUncommittedAt: string | null; oldestUnpushedAt: string | null },
  thresholds: DriftThresholds,
  observedAt: Date,
): Drift {
  const uncommittedDays = ageInDays(ages.oldestUncommittedAt, observedAt);
  const unpushedDays = ageInDays(ages.oldestUnpushedAt, observedAt);
  const known = [uncommittedDays, unpushedDays].filter(
    (days): days is number => days !== null,
  );
  const driftDays = known.length === 0 ? null : Math.max(...known);
  return {
    uncommittedDays,
    unpushedDays,
    driftDays,
    level: levelFor(driftDays, thresholds),
    thresholds,
  };
}

function earliest(timestamps: readonly string[]): string | null {
  if (timestamps.length === 0) return null;
  return timestamps.reduce((a, b) => (new Date(a) <= new Date(b) ? a : b));
}

/**
 * Git data for an item. The oldest uncommitted change is the earliest mtime among dirty files
 * that still exist; deleted files have none. Unpushed work is every commit on a local branch
 * that no remote-tracking ref holds, so a repository with no remote counts all its commits.
 * Ahead and behind come from the current branch's tracking branch, when it has one.
 */
export function deriveGit(
  raw: RawGit,
  thresholds: DriftThresholds,
  observedAt: Date,
): GitData {
  const branch = raw.head.state === "branch" ? raw.head.name : null;
  const branchNames = raw.branches.map((entry) => entry.name);
  const defaultBranch = chooseDefaultBranch(raw.originHead, branchNames);
  const tracking = raw.branches.find(
    (entry) => entry.name === branch,
  )?.tracking;
  const tracked = tracking?.state === "tracking" ? tracking : null;
  const oldestUncommittedAt = earliest(
    raw.dirtyFiles.flatMap((file) =>
      file.mtime.state === "observed" ? [file.mtime.value] : [],
    ),
  );
  const oldestUnpushedAt = earliest(
    raw.unpushedCommits.map((commit) => commit.committedAt),
  );
  return {
    branch,
    defaultBranch,
    upstream: tracked?.upstream ?? null,
    uncommittedCount: raw.dirtyFiles.length,
    ahead: tracked?.ahead ?? null,
    behind: tracked?.behind ?? null,
    unpushedCount: raw.unpushedCommits.length,
    lastCommitAt:
      raw.lastCommit.state === "observed"
        ? raw.lastCommit.value.committedAt
        : null,
    oldestUncommittedAt,
    oldestUnpushedAt,
    branches: raw.branches.map((entry) => ({
      name: entry.name,
      lastCommitAt: entry.lastCommit.committedAt,
      subject: entry.lastCommit.subject,
      upstream:
        entry.tracking.state === "absent" &&
        entry.tracking.reason === "no-tracking-branch"
          ? null
          : entry.tracking.upstream,
    })),
    remotes: raw.remotes.state === "observed" ? raw.remotes.value : [],
    activity: deriveActivity({
      uncommittedCount: raw.dirtyFiles.length,
      unpushedCount: raw.unpushedCommits.length,
      branch,
      defaultBranch,
      branchNames,
    }),
    drift: deriveDrift(
      { oldestUncommittedAt, oldestUnpushedAt },
      thresholds,
      observedAt,
    ),
  };
}

// Claude Code sessions

/**
 * The last session is the timestamp of the last user or assistant line in the newest transcript.
 * When that cannot be read, the newest transcript's mtime stands in. No transcripts means null.
 */
export function deriveClaudeSessions(
  raw: RawClaudeSessions,
): ClaudeSessionsData {
  if (raw.newest.state === "absent" || raw.transcripts.state === "absent") {
    return { lastSessionAt: null, basis: null };
  }
  const newest = raw.newest.value;
  if (newest.lastMessageAt.state === "observed") {
    return { lastSessionAt: newest.lastMessageAt.value, basis: "last-message" };
  }
  const mtime = raw.transcripts.value.find(
    (entry) => entry.file === newest.file,
  )?.mtime;
  return { lastSessionAt: mtime ?? null, basis: mtime ? "file-mtime" : null };
}

// Forges

function pullRequest(raw: RawPullRequest): PullRequest {
  return {
    number: raw.number,
    title: raw.title,
    author: raw.author.state === "observed" ? raw.author.value : null,
    draft: raw.draft,
    updatedAt: raw.updatedAt,
    url: raw.url,
  };
}

/**
 * GitHub run to CI state: any status other than completed is pending; a success conclusion is
 * success; failure, timed_out, startup_failure and action_required are failure; the rest
 * (cancelled, skipped, neutral, stale) are neutral.
 */
export function githubCiState(
  status: string,
  conclusion: string | null,
): CiState {
  if (status !== "completed") return "pending";
  if (conclusion === "success") return "success";
  if (
    conclusion === "failure" ||
    conclusion === "timed_out" ||
    conclusion === "startup_failure" ||
    conclusion === "action_required"
  ) {
    return "failure";
  }
  return "neutral";
}

function githubCi(run: Observed<RawGithubRun, string>): CiRun | null {
  if (run.state === "absent") return null;
  const conclusion =
    run.value.conclusion.state === "observed"
      ? run.value.conclusion.value
      : null;
  return {
    name: run.value.name,
    state: githubCiState(run.value.status, conclusion),
    forgeState:
      conclusion === null
        ? run.value.status
        : `${run.value.status}/${conclusion}`,
    url: run.value.url,
    createdAt: run.value.createdAt,
  };
}

export function deriveGithub(raw: RawGithub): ForgeData {
  return {
    host: raw.remote.host,
    owner: raw.remote.owner,
    repo: raw.remote.repo,
    defaultBranch: raw.defaultBranch,
    openPullRequests: raw.openPullRequests.map(pullRequest),
    latestCi: githubCi(raw.latestRun),
  };
}

/** Forgejo combined status to CI state: success, failure or error, pending, else neutral. */
export function forgejoCiState(state: string): CiState {
  if (state === "success") return "success";
  if (state === "failure" || state === "error") return "failure";
  if (state === "pending") return "pending";
  return "neutral";
}

/** Forgejo CI is the combined status, named after its newest individual status; none is null. */
function forgejoCi(combined: RawForgejo["combinedStatus"]): CiRun | null {
  const newest = combined.statuses
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (newest === undefined) return null;
  return {
    name: newest.context,
    state: forgejoCiState(combined.state),
    forgeState: combined.state,
    url: newest.targetUrl.state === "observed" ? newest.targetUrl.value : null,
    createdAt: newest.createdAt,
  };
}

export function deriveForgejo(raw: RawForgejo): ForgeData {
  return {
    host: raw.remote.host,
    owner: raw.remote.owner,
    repo: raw.remote.repo,
    defaultBranch: raw.defaultBranch,
    openPullRequests: raw.openPullRequests.map(pullRequest),
    latestCi: forgejoCi(raw.combinedStatus),
  };
}

// Uptime Kuma

const monitorStatuses: Record<number, MonitorStatus> = {
  0: "down",
  1: "up",
  2: "pending",
  3: "maintenance",
};

/**
 * Each monitor's status is its newest heartbeat's, unknown when it has none. The server is all
 * up when it has at least one monitor and every monitor is up.
 */
export function deriveKuma(raw: RawKuma): KumaData {
  const monitors = raw.monitors.map((monitor) => {
    const newest = monitor.heartbeats
      .slice()
      .sort((a, b) => b.time.localeCompare(a.time))[0];
    return {
      id: monitor.id,
      name: monitor.name,
      status: newest
        ? (monitorStatuses[newest.status] ?? "unknown")
        : "unknown",
      lastHeartbeatAt: newest?.time ?? null,
    };
  });
  return {
    allUp:
      monitors.length > 0 &&
      monitors.every((monitor) => monitor.status === "up"),
    monitors,
  };
}
