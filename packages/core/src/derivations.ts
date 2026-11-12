// Every derivation rule perch applies to raw facts, in one place. Gathering never judges; each
// rule here can be read and changed without touching how the machine is read.

import { collapseHome, type SourcesConfig, type WorkWords } from "./config.ts";
import type {
  Entry,
  RawBullet,
  RawCi,
  RawFiles,
  RawForgeRepo,
  RawGit,
  RawKuma,
  RawLocal,
  RawPullRequest,
  RawRoadmap,
  RawSection,
  RoadmapStructure,
  StatusFile,
} from "./raw.ts";
import type {
  ActivityState,
  AgedWork,
  Backup,
  BugThresholds,
  CiRun,
  CiState,
  DayThresholds,
  Drift,
  ForgeData,
  ForgeError,
  GitData,
  HealthLevel,
  HourThresholds,
  Item,
  ItemError,
  KumaData,
  MonitorStatus,
  PullRequest,
  RoadmapData,
  RoadmapFile,
  SourceCard,
  SourceCardKind,
  SourceCardResult,
  Stall,
  UnpushedBranch,
  WorkItem,
  WorkItemCounts,
  WorkItemGroup,
  WorkItemKind,
} from "./snapshot.ts";
import type { Health, HealthCause } from "./viewmodel.ts";

// Work items

const wordCharacter = "[\\p{L}\\p{N}_]";

/** One pattern matching any of the words whole, in any case; an empty list matches nothing. */
function wordPattern(words: readonly string[]): RegExp {
  if (words.length === 0) return /(?!)/u;
  const alternatives = words
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return new RegExp(
    `(?<!${wordCharacter})(?:${alternatives})(?!${wordCharacter})`,
    "iu",
  );
}

/**
 * Classes a task by the texts it is read from: its own text and every heading above it. A #tag
 * is part of the text it sits in, so it matches there, and is ignored inside a mention there.
 */
type KindOf = (texts: readonly string[]) => WorkItemKind;

/** Inline code and double-quoted text, straight or curly: a term mentioned rather than used. */
const mentionPattern = /(`+)[^`][\s\S]*?\1|"[^"]*"|“[^”]*”/g;

/** The text with each mention blanked, so the words either side stay apart. */
function withoutMentions(text: string): string {
  return text.replace(mentionPattern, " ");
}

/**
 * A word from the critical bug list makes a critical bug on its own and wins over a bug word; a word
 * from the bug list makes a bug; anything else is a task. Words inside a mention do not count.
 */
export function kindClassifier(words: WorkWords): KindOf {
  const critical = wordPattern(words.criticalBug);
  const bug = wordPattern(words.bug);
  return (given) => {
    const texts = given.map(withoutMentions);
    if (texts.some((text) => critical.test(text))) return "critical-bug";
    if (texts.some((text) => bug.test(text))) return "bug";
    return "task";
  };
}

/** A section's heading and every heading above it, nearest first. */
function headingsOf(section: RawSection): string[] {
  return [
    section.heading,
    ...section.parents.map((parent) => parent.text).reverse(),
  ];
}

/** Progress is checked against total checkbox items; null for a group without checkboxes. */
function progressOf(items: readonly WorkItem[]): WorkItemGroup["progress"] {
  const checkboxes = items.filter((item) => item.done !== null);
  if (checkboxes.length === 0) return null;
  const done = checkboxes.filter((item) => item.done === true).length;
  return { done, total: checkboxes.length };
}

function bulletItem(
  bullet: RawBullet,
  headings: readonly string[],
  kindOf: KindOf,
): WorkItem {
  return {
    text: bullet.text,
    kind: kindOf([bullet.text, ...headings]),
    done: bullet.checkbox === "none" ? null : bullet.checkbox === "checked",
    line: bullet.line,
    source: "bullet",
    body: null,
  };
}

function headingItem(section: RawSection, kindOf: KindOf): WorkItem {
  return {
    text: section.heading,
    kind: kindOf(headingsOf(section)),
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
 * group with nested sub-groups. Bullets above the first heading are items at the top. The word
 * lists class each item as a task, a bug or a critical bug. Checkboxes set done.
 */
export function deriveRoadmapFile(
  path: string,
  structure: RoadmapStructure,
  words: WorkWords,
): RoadmapFile {
  const kindOf = kindClassifier(words);
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

  const node = (section: RawSection): WorkItemGroup => {
    const items = [
      ...section.bullets.map((bullet) =>
        bulletItem(bullet, headingsOf(section), kindOf),
      ),
      ...childrenOf(section)
        .filter(isBare)
        .map((child) => headingItem(child, kindOf)),
    ];
    return {
      heading: section.heading,
      level: section.level,
      line: section.line,
      role: section.bullets.length > 0 ? "group" : "structure",
      items,
      groups: childrenOf(section)
        .filter((child) => !isBare(child))
        .map(node),
      progress: progressOf(items),
    };
  };

  const items = [
    ...structure.bulletsBeforeFirstHeading.map((bullet) =>
      bulletItem(bullet, [], kindOf),
    ),
    ...roots.filter(isBare).map((section) => headingItem(section, kindOf)),
  ];
  const groups = roots.filter((section) => !isBare(section)).map(node);
  return {
    path,
    items,
    groups,
    counts: openCounts([...items, ...groups.flatMap(allItems)]),
  };
}

function allItems(group: WorkItemGroup): WorkItem[] {
  return [...group.items, ...group.groups.flatMap(allItems)];
}

function openCounts(items: readonly WorkItem[]): WorkItemCounts {
  const counts: WorkItemCounts = { task: 0, bug: 0, "critical-bug": 0 };
  for (const item of items) {
    if (item.done !== true) counts[item.kind] += 1;
  }
  return counts;
}

/** Counts open items by kind across files and every nested group; done items are left out. */
export function countOpenItems(files: readonly RoadmapFile[]): WorkItemCounts {
  return openCounts(
    files.flatMap((file) => [...file.items, ...file.groups.flatMap(allItems)]),
  );
}

/**
 * Roadmap data for an item. A configured file that was not found makes the whole entry an
 * error naming the file.
 */
export function deriveRoadmap(
  raw: RawRoadmap,
  words: WorkWords,
  thresholds: BugThresholds,
): RoadmapData | ItemError {
  const files: RoadmapFile[] = [];
  for (const file of raw.files) {
    if (file.structure.state === "absent") {
      return { error: `roadmap file not found: ${file.path}` };
    }
    files.push(deriveRoadmapFile(file.path, file.structure.value, words));
  }
  return {
    counts: countOpenItems(files),
    files,
    thresholds,
    detectedPath: raw.detectedPath,
  };
}

/** An item without a roadmap file has no work items. */
export function emptyRoadmap(thresholds: BugThresholds): RoadmapData {
  return {
    counts: { task: 0, bug: 0, "critical-bug": 0 },
    files: [],
    thresholds,
    detectedPath: null,
  };
}

/** A roadmap file's open bugs and open critical bugs, each judged against its window. */
export function bugLevelsOf(
  counts: WorkItemCounts,
  thresholds: BugThresholds,
): { bugs: HealthLevel; criticalBugs: HealthLevel } {
  return {
    bugs: levelFor(
      counts.bug,
      thresholds.bugs.amberCount,
      thresholds.bugs.redCount,
    ),
    criticalBugs: levelFor(
      counts["critical-bug"],
      thresholds.criticalBugs.amberCount,
      thresholds.criticalBugs.redCount,
    ),
  };
}

/** The item's roadmap when it was read and judged; null otherwise. */
export function roadmapOf(item: Item): RoadmapData | null {
  const roadmap = item.sources.roadmap;
  if (roadmap === undefined || "error" in roadmap) return null;
  // A snapshot cached before roadmap files were judged has no thresholds field at all, and one
  // cached before parsing became opt-in has no detectedPath field.
  if (roadmap.thresholds === undefined) return null;
  return roadmap.detectedPath === undefined ? null : roadmap;
}

// Git

const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;

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

/** Whole units of a length from a timestamp to the observation time, never negative. */
function wholeUnitsSince(
  since: string,
  observedAt: Date,
  unitMs: number,
): number {
  const elapsed = observedAt.getTime() - new Date(since).getTime();
  return Math.max(0, Math.floor(elapsed / unitMs));
}

/** Whole days from a timestamp to the observation time, never negative. */
export function daysSince(since: string, observedAt: Date): number {
  return wholeUnitsSince(since, observedAt, dayMs);
}

/** Whole hours from a timestamp to the observation time, never negative. */
export function hoursSince(since: string, observedAt: Date): number {
  return wholeUnitsSince(since, observedAt, hourMs);
}

/** Red at or beyond the red window, amber at or beyond the amber window, else green. */
export function levelFor(age: number, amber: number, red: number): HealthLevel {
  if (age >= red) return "red";
  if (age >= amber) return "amber";
  return "green";
}

const levelRank: Record<HealthLevel, number> = { green: 0, amber: 1, red: 2 };

/** The worse of health levels; green for none. */
export function worstLevel(levels: readonly HealthLevel[]): HealthLevel {
  return levels.reduce<HealthLevel>(
    (worst, level) => (levelRank[level] > levelRank[worst] ? level : worst),
    "green",
  );
}

/** Orders health levels worst first. */
export function compareLevels(a: HealthLevel, b: HealthLevel): number {
  return levelRank[b] - levelRank[a];
}

function agedWork(
  since: string | null,
  thresholds: HourThresholds,
  observedAt: Date,
): AgedWork | null {
  if (since === null) return null;
  const hours = hoursSince(since, observedAt);
  return {
    since,
    hours,
    level: levelFor(hours, thresholds.amberHours, thresholds.redHours),
  };
}

/**
 * Unsafe work is uncommitted changes and unpushed commits, each aged in hours from its oldest
 * change at the time git was read and judged against the item's windows. The level is the worse
 * of the two, so continuing to edit never resets the clock on an older backlog.
 */
export function deriveDrift(
  ages: { oldestUncommittedAt: string | null; oldestUnpushedAt: string | null },
  thresholds: HourThresholds,
  observedAt: Date,
): Drift {
  const uncommitted = agedWork(
    ages.oldestUncommittedAt,
    thresholds,
    observedAt,
  );
  const unpushed = agedWork(ages.oldestUnpushedAt, thresholds, observedAt);
  return {
    uncommitted,
    unpushed,
    level: worstLevel(
      [uncommitted, unpushed].flatMap((work) => (work ? [work.level] : [])),
    ),
    thresholds,
  };
}

/**
 * Stalled flight: HEAD parked on a branch other than the default, aged in days from that
 * branch's newest commit, so a fresh commit on the branch restarts the clock. Null on the
 * default branch, on a detached HEAD, or without a default branch to compare against.
 */
export function deriveStall(
  head: {
    branch: string | null;
    defaultBranch: string | null;
    branchLastCommitAt: string | null;
  },
  thresholds: DayThresholds,
  observedAt: Date,
): Stall | null {
  const { branch, defaultBranch, branchLastCommitAt } = head;
  if (branch === null || branch === defaultBranch) return null;
  if (defaultBranch === null || branchLastCommitAt === null) return null;
  const days = daysSince(branchLastCommitAt, observedAt);
  return {
    branch,
    since: branchLastCommitAt,
    days,
    level: levelFor(days, thresholds.amberDays, thresholds.redDays),
    thresholds,
  };
}

/** The windows git data is judged against. */
export interface GitThresholds {
  unsafe: HourThresholds;
  stalled: DayThresholds;
}

function earliest(timestamps: readonly string[]): string | null {
  if (timestamps.length === 0) return null;
  return timestamps.reduce((a, b) => (new Date(a) <= new Date(b) ? a : b));
}

/**
 * Git data for an item. The oldest uncommitted change is the earliest mtime among dirty files
 * that still exist; deleted files have none. Unpushed work is every commit on a local branch
 * that no remote-tracking ref holds. It only drifts against a joined forge presence; a clone
 * with no remote at all is local only, one disk, with no unpushed work and no unpushed drift.
 * Ahead and behind come from the current branch's tracking branch, when it has one.
 */
export function deriveGit(
  raw: RawGit,
  thresholds: GitThresholds,
  observedAt: Date,
  backup: Backup,
): GitData {
  const branch = raw.head.state === "branch" ? raw.head.name : null;
  const branchNames = raw.branches.map((entry) => entry.name);
  const defaultBranch = chooseDefaultBranch(raw.originHead, branchNames);
  const current = raw.branches.find((entry) => entry.name === branch);
  const tracking = current?.tracking;
  const tracked = tracking?.state === "tracking" ? tracking : null;
  const unpushed = backup === "local-only" ? [] : raw.unpushedCommits;
  const oldestUncommittedAt = earliest(
    raw.dirtyFiles.flatMap((file) =>
      file.mtime.state === "observed" ? [file.mtime.value] : [],
    ),
  );
  const oldestUnpushedAt = earliest(
    unpushed.map((commit) => commit.committedAt),
  );
  return {
    backup,
    branch,
    defaultBranch,
    upstream: tracked?.upstream ?? null,
    uncommittedCount: raw.dirtyFiles.length,
    ahead: tracked?.ahead ?? null,
    behind: tracked?.behind ?? null,
    unpushedCount: unpushed.length,
    lastCommitAt:
      raw.lastCommit.state === "observed"
        ? raw.lastCommit.value.committedAt
        : null,
    oldestUncommittedAt,
    oldestUnpushedAt,
    unpushedBranches:
      backup === "joined"
        ? raw.branches.flatMap((entry): UnpushedBranch[] => {
            const work = agedWork(
              earliest(
                entry.unpushedCommits.map((commit) => commit.committedAt),
              ),
              thresholds.unsafe,
              observedAt,
            );
            if (work === null) return [];
            return [
              {
                name: entry.name,
                upstream:
                  entry.tracking.state === "tracking"
                    ? entry.tracking.upstream
                    : null,
                count: entry.unpushedCommits.length,
                work,
              },
            ];
          })
        : [],
    branches: raw.branches.map((entry) => ({
      name: entry.name,
      lastCommitAt: entry.lastCommit.committedAt,
      subject: entry.lastCommit.subject,
      upstream:
        entry.tracking.state === "tracking" ? entry.tracking.upstream : null,
    })),
    defaultBranchCommits:
      raw.defaultBranchCommits.state === "observed"
        ? raw.defaultBranchCommits.value
        : null,
    remotes: raw.remotes.state === "observed" ? raw.remotes.value : [],
    activity: deriveActivity({
      uncommittedCount: raw.dirtyFiles.length,
      unpushedCount: unpushed.length,
      branch,
      defaultBranch,
      branchNames,
    }),
    drift: deriveDrift(
      {
        oldestUncommittedAt,
        oldestUnpushedAt: backup === "joined" ? oldestUnpushedAt : null,
      },
      thresholds.unsafe,
      observedAt,
    ),
    stall: deriveStall(
      {
        branch,
        defaultBranch,
        branchLastCommitAt: current?.lastCommit.committedAt ?? null,
      },
      thresholds.stalled,
      observedAt,
    ),
  };
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

/** Forgejo combined status to CI state: success, failure or error, pending, else neutral. */
export function forgejoCiState(state: string): CiState {
  if (state === "success") return "success";
  if (state === "failure" || state === "error") return "failure";
  if (state === "pending") return "pending";
  return "neutral";
}

/**
 * CI from a forge. GitHub's is its latest run on the default branch. Forgejo's is the combined
 * commit status, named after its newest individual status, whose target URL Forgejo may give
 * relative to the instance; it is resolved against the repository URL. None is null.
 */
function deriveCi(ci: RawCi, repoUrl: string): CiRun | null {
  if (ci.forge === "github") {
    if (ci.latestRun.state === "absent") return null;
    const run = ci.latestRun.value;
    const conclusion =
      run.conclusion.state === "observed" ? run.conclusion.value : null;
    return {
      name: run.name,
      state: githubCiState(run.status, conclusion),
      forgeState:
        conclusion === null ? run.status : `${run.status}/${conclusion}`,
      url: run.url,
      createdAt: run.createdAt,
    };
  }
  const newest = ci.combinedStatus.statuses
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (newest === undefined) return null;
  return {
    name: newest.context,
    state: forgejoCiState(ci.combinedStatus.state),
    forgeState: ci.combinedStatus.state,
    url:
      newest.targetUrl.state === "observed"
        ? new URL(newest.targetUrl.value, repoUrl).href
        : null,
    createdAt: newest.createdAt,
  };
}

/** One part of a forge repository's detail, derived when it was read, else its error. */
function deriveFacet<T, U>(
  facet: Entry<T, never>,
  derive: (value: T) => U,
): U | ItemError {
  return facet.state === "observed"
    ? derive(facet.value)
    : { error: facet.state === "error" ? facet.error : "couldn't read" };
}

/**
 * Forge data for a presence; details that could not be read at all are the item's error, and a
 * part that could not be read is that part's error.
 */
export function deriveForge(repo: RawForgeRepo): ForgeData | ForgeError {
  if (repo.details.state === "error")
    return { error: repo.details.error, cause: "read-failed" };
  if (repo.details.state === "absent")
    return { error: "details not read: archived", cause: "read-failed" };
  const { openPullRequests, ci, finalisedCommits } = repo.details.value;
  return {
    fullName: repo.info.fullName,
    url: repo.info.url,
    defaultBranch: repo.info.defaultBranch,
    openPullRequests: deriveFacet(openPullRequests, (pulls) =>
      pulls.map(pullRequest),
    ),
    latestCi: deriveFacet(ci, (value) => deriveCi(value, repo.info.url)),
    finalisedCommits: deriveFacet(finalisedCommits, (commits) => commits),
  };
}

/** A forge's newest CI run when its CI was read and it has one; null otherwise. */
export function latestRunOf(data: ForgeData): CiRun | null {
  const ci = data.latestCi;
  return ci === null || "error" in ci ? null : ci;
}

// Health

/** A roadmap file's bug cause: the worse of its two levels, its critical bugs when they are as bad. */
export function bugCause(
  file: RoadmapFile,
  thresholds: BugThresholds,
): Extract<HealthCause, { kind: "bugs" }> {
  const levels = bugLevelsOf(file.counts, thresholds);
  const critical = compareLevels(levels.criticalBugs, levels.bugs) <= 0;
  return {
    kind: "bugs",
    level: critical ? levels.criticalBugs : levels.bugs,
    path: file.path,
    critical,
    count: critical ? file.counts["critical-bug"] : file.counts.bug,
  };
}

/**
 * An item's health: the worst of its inputs. Failing CI is red. Each roadmap file is judged on its
 * own, the worse of its open bugs and open critical bugs against their windows. A remote the clone
 * pushes to that no card can read is amber; a forge whose read failed this scan is not an input.
 * Uncommitted changes, unpushed commits and stalled flight take the level already judged against
 * the item's windows. Only amber and red inputs are causes; they come worst first, ties in the
 * order CI, unreadable remotes, bugs, uncommitted, unpushed, stalled. Flags are not inputs: the
 * one with a level, not set up, is the fence's own situation.
 */
export function deriveHealth(item: Item): Health {
  const candidates: HealthCause[] = [];
  for (const forge of ["github", "forgejo"] as const) {
    const data = item.sources[forge];
    if (data === undefined || "error" in data) continue;
    const run = latestRunOf(data);
    if (run?.state !== "failure") continue;
    candidates.push({
      kind: "ci-failing",
      level: "red",
      forge,
      branch: data.defaultBranch,
      run,
    });
  }
  for (const forge of ["github", "forgejo"] as const) {
    const data = item.sources[forge];
    if (data === undefined || !("cause" in data) || data.cause !== "no-card")
      continue;
    // The source is the first presence's of its forge, as aggregation assigns it.
    const presence = item.presences.forges.find(
      (entry) => entry.forge === forge,
    );
    if (presence === undefined) continue;
    candidates.push({
      kind: "unreadable-remote",
      level: "amber",
      forge,
      fullName: presence.fullName,
    });
  }
  const roadmap = roadmapOf(item);
  if (roadmap !== null) {
    candidates.push(
      ...roadmap.files.map((file) => bugCause(file, roadmap.thresholds)),
    );
  }
  const git = item.sources.git;
  if (git !== undefined && !("error" in git)) {
    const { drift } = git;
    if (drift.uncommitted) {
      candidates.push({
        kind: "uncommitted",
        level: drift.uncommitted.level,
        count: git.uncommittedCount,
        work: drift.uncommitted,
        thresholds: drift.thresholds,
      });
    }
    if (drift.unpushed) {
      candidates.push({
        kind: "unpushed",
        level: drift.unpushed.level,
        count: git.unpushedCount,
        work: drift.unpushed,
        thresholds: drift.thresholds,
      });
    }
    if (git.stall) {
      candidates.push({
        kind: "stalled",
        level: git.stall.level,
        stall: git.stall,
        everythingPushed: git.uncommittedCount === 0 && git.unpushedCount === 0,
      });
    }
  }
  const causes = candidates
    .filter((cause) => cause.level !== "green")
    .sort((a, b) => compareLevels(a.level, b.level));
  return { level: causes[0]?.level ?? "green", causes };
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

// Source cards

/** What the raw files hold for one card: nothing yet, an error, or what it read. */
type CardGrain =
  | null
  | { state: "error"; message: string }
  | { state: "read"; count: number; missingIncludes: string[] };

/** A configured source table: its identity, the raw file it lands in, and how to find its grain. */
export interface ConfiguredCard {
  id: string;
  kind: SourceCardKind;
  label: string;
  polled: "local" | "githubAccounts" | "forgejoAccounts" | "kuma";
  grain: (files: Partial<RawFiles>) => CardGrain;
}

/** A URL's host and port, or the text itself when it does not parse as a URL. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function entryGrain<T>(
  entry: Entry<T, never> | undefined,
  count: (value: T) => number,
): CardGrain {
  if (entry === undefined || entry.state === "absent") return null;
  if (entry.state === "error") return { state: "error", message: entry.error };
  return { state: "read", count: count(entry.value), missingIncludes: [] };
}

/**
 * A local card is read once every one of its include paths has a recorded outcome: its count is
 * the repositories found under them, and the ones not found are listed.
 */
function localGrain(
  include: readonly string[],
  local: RawLocal | undefined,
  home: string,
): CardGrain {
  if (local === undefined) return null;
  const outcomes = include.map((path) => ({
    path,
    outcome: local.includes[path],
  }));
  if (outcomes.some(({ outcome }) => outcome === undefined)) return null;
  return {
    state: "read",
    count: Object.values(local.presences).filter((presence) =>
      include.includes(presence.include),
    ).length,
    missingIncludes: outcomes
      .filter(({ outcome }) => outcome?.state === "absent")
      .map(({ path }) => collapseHome(path, home)),
  };
}

/** A forgejo card's heading: its account at its base URL's host and port. */
export function forgejoCardLabel(card: {
  account: string;
  baseUrl: string;
}): string {
  return `${card.account}@${hostOf(card.baseUrl)}`;
}

/** Each kind's card id, from a source table whose paths are written with ~. */
export const sourceCardIds: {
  [Kind in SourceCardKind]: (card: SourcesConfig[Kind][number]) => string;
} = {
  local: (card) => `local:${card.include[0] ?? ""}`,
  github: (card) => `github:${card.account}`,
  forgejo: (card) => `forgejo:${forgejoCardLabel(card)}`,
  kuma: (card) => `kuma:${card.name}`,
};

/** Every configured source table in config order, local, github, forgejo, then kuma. */
export function configuredCards(
  sources: SourcesConfig,
  home: string,
): ConfiguredCard[] {
  return [
    ...sources.local.map((card): ConfiguredCard => {
      const paths = card.include.map((path) => collapseHome(path, home));
      return {
        id: sourceCardIds.local({ ...card, include: paths }),
        kind: "local",
        label: paths.join(", "),
        polled: "local",
        grain: (files) => localGrain(card.include, files.local?.data, home),
      };
    }),
    ...sources.github.map(
      (card): ConfiguredCard => ({
        id: sourceCardIds.github(card),
        kind: "github",
        label: card.account,
        polled: "githubAccounts",
        grain: (files) =>
          entryGrain(
            files.githubAccounts?.data[card.key],
            (value) => value.repos.length,
          ),
      }),
    ),
    ...sources.forgejo.map((card): ConfiguredCard => {
      return {
        id: sourceCardIds.forgejo(card),
        kind: "forgejo",
        label: forgejoCardLabel(card),
        polled: "forgejoAccounts",
        grain: (files) =>
          entryGrain(
            files.forgejoAccounts?.data[card.key],
            (value) => value.repos.length,
          ),
      };
    }),
    ...sources.kuma.map(
      (card): ConfiguredCard => ({
        id: sourceCardIds.kuma(card),
        kind: "kuma",
        label: card.name,
        polled: "kuma",
        grain: (files) =>
          entryGrain(
            files.kuma?.data[card.name],
            (value) => value.monitors.length,
          ),
      }),
    ),
  ];
}

/** When a card last read, from its record in the previous snapshot; null when it has none. */
function lastRead(previous: SourceCard | undefined): string | null {
  if (previous?.result.state === "ok") return previous.result.at;
  if (previous?.result.state === "failed") {
    return previous.result.lastSucceededAt;
  }
  return null;
}

export interface SourceCardInput {
  sources: SourcesConfig;
  files: Partial<RawFiles>;
  status: StatusFile;
  /** The previous snapshot's cards, which carry each card's last read through a failure. */
  previous: readonly SourceCard[];
  home: string;
}

/**
 * One card's last scan. A card the gather never ran or whose raw file holds nothing for it, such
 * as one added since, is never scanned. A source that failed fails every card it holds; otherwise
 * the card's own error fails it. An ok card counts what it read, as of its raw file's gather.
 */
function cardResult(
  card: ConfiguredCard,
  input: SourceCardInput,
  previous: SourceCard | undefined,
): SourceCardResult {
  const failed = (message: string): SourceCardResult => ({
    state: "failed",
    message,
    lastSucceededAt: lastRead(previous),
  });
  const status = input.status.sources[card.polled];
  const file = input.files[card.polled];
  if (status === undefined) return { state: "never-scanned" };
  if (status.state === "error") return failed(status.message);
  const grain = card.grain(input.files);
  if (file === undefined || grain === null) return { state: "never-scanned" };
  if (grain.state === "error") return failed(grain.message);
  return {
    state: "ok",
    at: file.gatheredAt,
    count: grain.count,
    missingIncludes: grain.missingIncludes,
  };
}

/** Each configured card with its last scan, in config order. */
export function deriveSourceCards(input: SourceCardInput): SourceCard[] {
  const previous = new Map(input.previous.map((card) => [card.id, card]));
  return configuredCards(input.sources, input.home).map((card) => ({
    id: card.id,
    kind: card.kind,
    label: card.label,
    result: cardResult(card, input, previous.get(card.id)),
  }));
}
