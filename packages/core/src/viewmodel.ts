// The view model: everything the renderer draws, in the design's own words, derived from a
// snapshot and the config by pure functions. The renderer reads only these types, never the raw
// or snapshot types. Every value traces to a snapshot field; the sky follows the clock at render
// and is not part of the model. No Node modules, so the renderer can import it.

import {
  type Config,
  collapseHome,
  hostsOf,
  type ItemEntry,
  resolveEntry,
  wireFor,
  zellijSessionFor,
} from "./config.ts";
import { countOpenItems, deriveHealth, hoursSince } from "./derivations.ts";
import { itemRefs } from "./refs.ts";
import { parseRemoteUrl } from "./remote-url.ts";
import type {
  AgedWork,
  CiRun,
  CiState,
  FailureReason,
  FinalisedCommit,
  ForgeData,
  ForgeName,
  GitData,
  HealthLevel,
  HourThresholds,
  Item,
  ItemError,
  ItemFlagName,
  ItemKind,
  ItemSourceData,
  PolledSourceName,
  RoadmapData,
  Snapshot,
  SourceCard,
  SourceCardKind,
  SourceCardResult,
  Stall,
  WorkItemCounts,
} from "./snapshot.ts";
import {
  type FenceSituation,
  type SpeechSubject,
  speak,
  wakingPrefix,
} from "./speech.ts";

/** The source cards pass to the renderer as the snapshot holds them; the settings page words them. */
export type { HealthLevel, SourceCard, SourceCardKind, SourceCardResult };

// Health

/** One amber or red input to a bird's health, with the facts its speech and chips need. */
export type HealthCause =
  | {
      kind: "ci-failing";
      level: HealthLevel;
      forge: ForgeName;
      branch: string;
      run: CiRun;
    }
  | { kind: "bugs"; level: HealthLevel; count: number }
  | {
      kind: "uncommitted" | "unpushed";
      level: HealthLevel;
      count: number;
      work: AgedWork;
      thresholds: HourThresholds;
    }
  | {
      kind: "stalled";
      level: HealthLevel;
      stall: Stall;
      /** Nothing uncommitted and nothing unpushed while parked. */
      everythingPushed: boolean;
    };

/** The fact behind the mood: the worst level, and the causes worst first. */
export interface Health {
  level: HealthLevel;
  causes: HealthCause[];
}

// The scene

/** How the bird wears its health: green content, amber restless, red distressed. */
export type Mood = "content" | "restless" | "distressed";

/** What the bird is doing, apart from how it feels: from the git work-state. */
export type Activity = "editing" | "in-flight" | "settled";

/** The whole scene: the wires top to bottom, then the fence beneath. */
export interface Aviary {
  scannedAt: string;
  wires: Wire[];
  fence: Fence;
  /** Sources whose latest gather failed; their previous results stand. */
  sourceErrors: SourceError[];
  /** Problems outside any one bird, such as an include path that does not exist. */
  warnings: string[];
}

/** One priority band from config, its birds leftmost first: leftmost needs attention first. */
export interface Wire {
  name: string;
  birds: Bird[];
}

/** The ground for every bird config does not adopt, dimmed. */
export interface Fence {
  birds: Bird[];
}

export interface SourceError {
  source: PolledSourceName;
  reason: FailureReason | null;
  error: string | null;
  lastSucceededAt: string | null;
}

/** Plumpness from outstanding work: the open roadmap items, and their share of the cap. */
export interface Plumpness {
  outstanding: number;
  /** Outstanding over the cap, at most 1. */
  fullness: number;
}

/** Outstanding work at which a bird is as plump as it gets. */
export const plumpnessCap = 50;

export interface Bird {
  id: string;
  /** The display name from config, else the scanned name. */
  name: string;
  kind: Exclude<ItemKind, "server">;
  adopted: boolean;
  /** Null on the fence. */
  wire: string | null;
  /** Index along the wire or fence, 0 leftmost. */
  position: number;
  health: Health;
  mood: Mood;
  /** Null without a local clone, which has no work-state. */
  activity: Activity | null;
  plumpness: Plumpness;
  /** At night a content bird not being edited sleeps, as does every fence bird. */
  sleepsAtNight: boolean;
  bubble: Bubble;
  detail: Detail;
}

// The bubble

/** The bubble's word beside the name: the mood, or where a fence bird stands. */
export type StateWord = Mood | "not adopted";

export interface Bubble {
  name: string;
  stateWord: StateWord;
  /** First person, the why behind the colour. */
  speech: string;
  /** The speech with the waking prefix, for a sleeping bird clicked at night; null when it stays awake. */
  wokenSpeech: string | null;
  chips: Chip[];
}

/** Every kind of chip, in the order chips run on a bubble. */
export const chipKinds = [
  "ci",
  "bugs",
  "uncommitted",
  "unpushed",
  "pull-requests",
  "open-items",
] as const;

export type ChipKind = (typeof chipKinds)[number];

/** A number the bird carries, with the severity of the fact behind it; null when it is not judged. */
export interface Chip {
  kind: ChipKind;
  label: string;
  /** Null for a state rather than a count. */
  count: number | null;
  severity: Exclude<HealthLevel, "green"> | null;
}

// The detail

/** A ledger tone: green for a clean zero or a good state, amber and red by severity, else null. */
export type Tone = HealthLevel | null;

/** One source's part in a ledger row: where it was read, what it says there, and its link out. */
export interface Working {
  /** A forge's lower-case name, a roadmap file's path, or git. */
  source: string;
  text: string;
  tone: Tone;
  url: string | null;
  /** When the fact dates from, shown as an age; null when it has no time. */
  at: string | null;
}

/**
 * One fact in full words. A clean count of zero reads "none" in green. A count or state row names
 * the bubble chip whose working it holds, null when the bubble carries no such chip, and spells
 * that working out per source: each source with something to say, or not read.
 */
export type LedgerEntry =
  | {
      kind: "count";
      label: string;
      count: number;
      text: string;
      tone: Tone;
      chip: ChipKind | null;
      workings: Working[];
    }
  | {
      kind: "state";
      label: string;
      text: string;
      tone: Tone;
      url: string | null;
      chip: ChipKind | null;
      workings: Working[];
    }
  | { kind: "time"; label: string; at: string };

export interface BranchLine {
  name: string;
  current: boolean;
  isDefault: boolean;
  lastCommitAt: string;
  subject: string;
  upstream: string | null;
  /** The branch on its forge, when it is pushed to a forge presence. */
  url: string | null;
}

/** Whether a place holds a commit; lacking only within the place's list, unknown beyond it. */
export type Reach = "held" | "lacking" | "unknown";

export type RiverPlaceName = "here" | ForgeName;

/** A place the river tells reach for: the clone here, then each forge holding the bird. */
export interface RiverPlace {
  name: RiverPlaceName;
  /** The default branch on the forge; null for here. */
  url: string | null;
  /** Why no reach can be told there, such as "not read"; null when its list was read. */
  note: string | null;
}

/** A commit's reach in one place. */
export interface PlaceReach {
  place: RiverPlaceName;
  reach: Reach;
}

/** One commit, told once however many places hold it. */
export interface RiverCommit {
  sha: string;
  shortSha: string;
  subject: string;
  committedAt: string;
  /** The commit on the first forge holding it; null when no forge does. */
  url: string | null;
  /** The commit's reach in each place, in the places' order. */
  reach: PlaceReach[];
}

/** The newest commits on the default branch, each once, with where each has reached. */
export interface River {
  places: RiverPlace[];
  /** Newest first, at most the configured number of finalised commits. */
  commits: RiverCommit[];
  /** One sentence when the forges hold different commits; null when they agree. */
  divergence: string | null;
}

export interface PullRequestLine {
  forge: ForgeName;
  number: number;
  title: string;
  author: string | null;
  draft: boolean;
  updatedAt: string;
  url: string;
}

export interface FlagLine {
  flag: ItemFlagName;
  text: string;
  detail: string;
  level: HealthLevel | null;
}

/** Launch actions open things and change nothing. */
export type LaunchAction =
  | {
      kind: "zellij-tab";
      verb: string;
      session: string;
      tab: string;
      cwd: string;
    }
  | { kind: "vscode"; verb: string; path: string }
  | { kind: "folder"; verb: string; path: string }
  | { kind: "obsidian"; verb: string; vault: string };

export interface LinkOut {
  label: string;
  url: string;
}

/** A file the detail page renders as paper, read at render time. */
export interface KeyFile {
  path: string;
  absolutePath: string;
}

/** A source that could not be read for this bird. */
export interface SourceProblem {
  source: string;
  error: string;
}

/** Everything about one bird beyond its look and bubble, which the detail page also shows. */
export interface Detail {
  /** Where the clone is on disk, home as ~; null for a bird with no clone here. */
  clonePath: string | null;
  /** The forges that hold the bird, each once, in the order its presences were found. */
  forges: ForgeName[];
  ledger: LedgerEntry[];
  branches: BranchLine[];
  river: River;
  pullRequests: PullRequestLine[];
  flags: FlagLine[];
  actions: LaunchAction[];
  links: LinkOut[];
  keyFiles: KeyFile[];
  problems: SourceProblem[];
}

// Derivation

const forgeNames: readonly ForgeName[] = ["github", "forgejo"];

const forgeLabel: Record<ForgeName, string> = {
  github: "GitHub",
  forgejo: "Forgejo",
};

const sourceLabel: Record<keyof ItemSourceData, string> = {
  git: "git",
  roadmap: "roadmap",
  claudeSessions: "Claude sessions",
  github: "GitHub",
  forgejo: "Forgejo",
  kuma: "Uptime Kuma",
};

const flagText: Record<ItemFlagName, string> = {
  "not-set-up": "not set up",
  "remote-archived": "remote archived",
  "remote-joined-elsewhere": "remote joined elsewhere",
  "config-conflict": "config conflict",
};

const moodOf: Record<HealthLevel, Mood> = {
  green: "content",
  amber: "restless",
  red: "distressed",
};

const activityOf: Record<GitData["activity"], Activity> = {
  editing: "editing",
  "in-progress": "in-flight",
  settled: "settled",
};

/** Worst first, for the CI chip when two forges disagree. */
const ciSeverityOrder: readonly CiState[] = [
  "failure",
  "pending",
  "neutral",
  "success",
];

/** A source's data when it was read; null when it is absent or an error. */
function readable<T extends object>(
  value: T | ItemError | undefined,
): T | null {
  if (value === undefined || "error" in value) return null;
  return value;
}

type BirdItem = Item & { kind: Exclude<ItemKind, "server"> };

function isBirdItem(item: Item): item is BirdItem {
  return item.kind !== "server";
}

/** The config entry an item resolves to, by its id and every presence reference it holds. */
function entryFor(item: Item, config: Config): ItemEntry | null {
  return resolveEntry(config, item.id, itemRefs(item)).entry;
}

/** A level as a severity: amber and red stand, green is not judged. */
function severity(level: HealthLevel): Exclude<HealthLevel, "green"> | null {
  return level === "green" ? null : level;
}

function forgeData(item: Item): { forge: ForgeName; data: ForgeData }[] {
  return forgeNames.flatMap((forge) => {
    const data = readable<ForgeData>(item.sources[forge]);
    return data ? [{ forge, data }] : [];
  });
}

function openItemsOf(roadmap: RoadmapData | null): number {
  return roadmap ? roadmap.counts.bug + roadmap.counts.feature : 0;
}

function branchUrl(forge: ForgeName, repoUrl: string, branch: string): string {
  return forge === "github"
    ? `${repoUrl}/tree/${branch}`
    : `${repoUrl}/src/branch/${branch}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function countEntry(
  label: string,
  count: number,
  tone: Tone,
  chip: ChipKind | null,
  workings: Working[],
): LedgerEntry {
  return count === 0
    ? {
        kind: "count",
        label,
        count,
        text: "none",
        tone: "green",
        chip,
        workings,
      }
    : {
        kind: "count",
        label,
        count,
        text: String(count),
        tone,
        chip,
        workings,
      };
}

/** Each forge the item holds a source for: its data, or null when it was not read. */
function forgeSources(
  item: Item,
): { forge: ForgeName; data: ForgeData | null }[] {
  return forgeNames.flatMap((forge) => {
    const source = item.sources[forge];
    if (source === undefined) return [];
    return [{ forge, data: "error" in source ? null : source }];
  });
}

function notRead(source: string): Working {
  return { source, text: "not read", tone: "amber", url: null, at: null };
}

/** The worst state among the forges' newest runs; undefined when no forge has a run. */
function worstCiState(item: Item): CiState | undefined {
  const runs = forgeData(item).flatMap(({ data }) =>
    data.latestCi ? [data.latestCi] : [],
  );
  return ciSeverityOrder.find((state) =>
    runs.some((run) => run.state === state),
  );
}

function ciTone(state: CiState): Tone {
  if (state === "failure") return "red";
  return state === "success" ? "green" : null;
}

/** The CI row: the worst state, as the chip says it, then each forge's newest run, named and linked. */
function ciEntry(item: Item, chip: ChipKind | null): LedgerEntry | null {
  const worst = worstCiState(item);
  if (worst === undefined) return null;
  return {
    kind: "state",
    label: "CI",
    text: worst,
    tone: ciTone(worst),
    url: null,
    chip,
    workings: forgeSources(item).flatMap(({ forge, data }): Working[] => {
      if (data === null) return [notRead(forge)];
      const run = data.latestCi;
      if (run === null) return [];
      return [
        {
          source: forge,
          text: `${run.state} on ${data.defaultBranch}, run “${run.name}”`,
          tone: ciTone(run.state),
          url: run.url,
          at: run.createdAt,
        },
      ];
    }),
  };
}

/** Each forge's open pull requests, linked to its list; a forge with none is silent. */
function pullRequestWorkings(item: Item): Working[] {
  return forgeSources(item).flatMap(({ forge, data }): Working[] => {
    if (data === null) return [notRead(forge)];
    const open = data.openPullRequests.length;
    if (open === 0) return [];
    return [
      {
        source: forge,
        text: `${open} open`,
        tone: null,
        url: `${data.url}/pulls`,
        at: null,
      },
    ];
  });
}

/** Each roadmap file's open items of the kinds counted; a file with none is silent. */
function roadmapWorkings(
  roadmap: RoadmapData,
  countOf: (counts: WorkItemCounts) => number,
): Working[] {
  return roadmap.files.flatMap((file): Working[] => {
    const open = countOf(countOpenItems([file]));
    if (open === 0) return [];
    return [
      {
        source: file.path,
        text: `${open} open`,
        tone: null,
        url: null,
        at: null,
      },
    ];
  });
}

/** Unsafe work's oldest change, toned by its age; nothing when there is none. */
function agedWorkings(work: AgedWork | null, text: string): Working[] {
  if (work === null) return [];
  return [
    {
      source: "git",
      text,
      tone: severity(work.level),
      url: null,
      at: work.since,
    },
  ];
}

/** The forge page for an upstream branch, found through its remote's URL; null when none matches. */
function upstreamUrl(
  item: Item,
  git: GitData,
  upstream: string,
  config: Config,
): string | null {
  const slash = upstream.indexOf("/");
  const remote = git.remotes.find(
    (entry) => entry.name === upstream.slice(0, slash),
  );
  const location = remote ? parseRemoteUrl(remote.fetchUrl) : null;
  if (location === null) return null;
  const forge = forgeNames.find((name) =>
    hostsOf(config.sources[name]).includes(location.host),
  );
  const fullName = `${location.owner}/${location.repo}`.toLowerCase();
  const presence = item.presences.forges.find(
    (entry) =>
      entry.forge === forge && entry.fullName.toLowerCase() === fullName,
  );
  return presence
    ? branchUrl(presence.forge, presence.url, upstream.slice(slash + 1))
    : null;
}

function chipsFor(item: Item, health: Health): Chip[] {
  const chips: Chip[] = [];
  const worstCi = worstCiState(item);
  if (worstCi !== undefined) {
    chips.push({
      kind: "ci",
      label: `ci ${worstCi}`,
      count: null,
      severity: worstCi === "failure" ? "red" : null,
    });
  }
  const roadmap = readable<RoadmapData>(item.sources.roadmap);
  const bugs = roadmap?.counts.bug ?? 0;
  if (bugs > 0) {
    chips.push({
      kind: "bugs",
      label: plural(bugs, "bug", "bugs"),
      count: bugs,
      severity: "red",
    });
  }
  const git = readable<GitData>(item.sources.git);
  const levelOf = (kind: "uncommitted" | "unpushed") =>
    health.causes.find((cause) => cause.kind === kind)?.level ?? "green";
  if (git && git.uncommittedCount > 0) {
    chips.push({
      kind: "uncommitted",
      label: `${git.uncommittedCount} uncommitted`,
      count: git.uncommittedCount,
      severity: severity(levelOf("uncommitted")),
    });
  }
  if (git && git.unpushedCount > 0) {
    chips.push({
      kind: "unpushed",
      label: `${git.unpushedCount} unpushed`,
      count: git.unpushedCount,
      severity: severity(levelOf("unpushed")),
    });
  }
  const pulls = forgeData(item).reduce(
    (total, { data }) => total + data.openPullRequests.length,
    0,
  );
  if (pulls > 0) {
    chips.push({
      kind: "pull-requests",
      label: plural(pulls, "open PR", "open PRs"),
      count: pulls,
      severity: null,
    });
  }
  const openItems = openItemsOf(roadmap);
  if (openItems > 0) {
    chips.push({
      kind: "open-items",
      label: plural(openItems, "open item", "open items"),
      count: openItems,
      severity: null,
    });
  }
  return chips;
}

/** The facts in full words, each chip's working on the row whose number it carries. */
function ledgerFor(item: Item, chips: Chip[]): LedgerEntry[] {
  const handle = (kind: ChipKind) =>
    chips.some((chip) => chip.kind === kind) ? kind : null;
  const ledger: LedgerEntry[] = [];
  const git = readable<GitData>(item.sources.git);
  if (git) {
    ledger.push(
      countEntry(
        "uncommitted changes",
        git.uncommittedCount,
        git.drift.uncommitted ? severity(git.drift.uncommitted.level) : null,
        handle("uncommitted"),
        agedWorkings(git.drift.uncommitted, "oldest change"),
      ),
    );
    if (git.backup === "local-only") {
      ledger.push({
        kind: "state",
        label: "remote",
        text: "none, one disk only",
        tone: null,
        url: null,
        chip: null,
        workings: [],
      });
    } else {
      ledger.push(
        countEntry(
          "unpushed commits",
          git.unpushedCount,
          git.drift.unpushed ? severity(git.drift.unpushed.level) : null,
          handle("unpushed"),
          agedWorkings(git.drift.unpushed, "oldest commit"),
        ),
      );
    }
  }
  const roadmap = readable<RoadmapData>(item.sources.roadmap);
  if (roadmap) {
    ledger.push(
      countEntry(
        "open bugs",
        roadmap.counts.bug,
        "red",
        handle("bugs"),
        roadmapWorkings(roadmap, (counts) => counts.bug),
      ),
    );
    ledger.push(
      countEntry(
        "open roadmap items",
        openItemsOf(roadmap),
        null,
        handle("open-items"),
        roadmapWorkings(roadmap, (counts) => counts.bug + counts.feature),
      ),
    );
  }
  const forges = forgeData(item);
  if (forges.length > 0) {
    ledger.push(
      countEntry(
        "open pull requests",
        forges.reduce(
          (total, { data }) => total + data.openPullRequests.length,
          0,
        ),
        null,
        handle("pull-requests"),
        pullRequestWorkings(item),
      ),
    );
  }
  const ci = ciEntry(item, handle("ci"));
  if (ci !== null) ledger.push(ci);
  if (git?.lastCommitAt) {
    ledger.push({ kind: "time", label: "last commit", at: git.lastCommitAt });
  }
  const sessions = item.sources.claudeSessions;
  if (sessions && !("error" in sessions) && sessions.lastSessionAt) {
    ledger.push({
      kind: "time",
      label: "last Claude session",
      at: sessions.lastSessionAt,
    });
  }
  return ledger;
}

function branchesFor(item: Item, config: Config): BranchLine[] {
  const git = readable<GitData>(item.sources.git);
  if (git === null) return [];
  return git.branches
    .map((branch) => ({
      name: branch.name,
      current: branch.name === git.branch,
      isDefault: branch.name === git.defaultBranch,
      lastCommitAt: branch.lastCommitAt,
      subject: branch.subject,
      upstream: branch.upstream,
      url: branch.upstream
        ? upstreamUrl(item, git, branch.upstream, config)
        : null,
    }))
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        b.lastCommitAt.localeCompare(a.lastCommitAt),
    );
}

/** A river place with the list its reach is read from: null when unread, with the forge's address. */
interface PlaceList {
  place: RiverPlace;
  commits: FinalisedCommit[] | null;
  repoUrl: string | null;
}

function unreadPlace(name: RiverPlaceName, note: string): PlaceList {
  return { place: { name, url: null, note }, commits: null, repoUrl: null };
}

/** Here's list: local main's, unknown when git was not read, before a scan read it, or without main. */
function herePlace(item: Item): PlaceList {
  const git = readable<GitData>(item.sources.git);
  if (git === null) return unreadPlace("here", "not read");
  if (git.defaultBranchCommits === undefined)
    return unreadPlace("here", "not read yet");
  if (git.defaultBranchCommits === null)
    return unreadPlace("here", "no default branch");
  return {
    place: { name: "here", url: null, note: null },
    commits: git.defaultBranchCommits,
    repoUrl: null,
  };
}

function forgePlace(item: Item, forge: ForgeName): PlaceList {
  const data = readable<ForgeData>(item.sources[forge]);
  if (data === null) return unreadPlace(forge, "not read");
  return {
    place: {
      name: forge,
      url: branchUrl(forge, data.url, data.defaultBranch),
      note: null,
    },
    commits: data.finalisedCommits,
    repoUrl: data.url,
  };
}

/**
 * A place's reach for a commit. Its list is the newest few commits, so a commit missing from it is
 * lacking only when no older than the list's oldest; an older one is beyond the list, unknown.
 */
function reachIn(
  commits: FinalisedCommit[] | null,
  commit: FinalisedCommit,
): Reach {
  if (commits === null || commits.length === 0) return "unknown";
  if (commits.some((listed) => listed.sha === commit.sha)) return "held";
  const oldest = Math.min(
    ...commits.map((listed) => Date.parse(listed.committedAt)),
  );
  return Date.parse(commit.committedAt) < oldest ? "unknown" : "lacking";
}

/** Commits a forge lacks that another forge holds, per forge, leaving out the forges lacking none. */
function forgeShortfalls(
  forgeLists: PlaceList[],
  commits: FinalisedCommit[],
): { list: PlaceList; lacking: FinalisedCommit[] }[] {
  return forgeLists
    .map((list) => ({
      list,
      lacking: commits.filter(
        (commit) =>
          reachIn(list.commits, commit) === "lacking" &&
          forgeLists.some(
            (other) =>
              other !== list && reachIn(other.commits, commit) === "held",
          ),
      ),
    }))
    .filter((shortfall) => shortfall.lacking.length > 0);
}

/**
 * The divergence sentence: a forge lacking commits another holds is behind it; two forges each
 * lacking commits have diverged. Counted over every listed commit, not only those the river shows.
 */
function divergenceOf(
  forgeLists: PlaceList[],
  commits: FinalisedCommit[],
): string | null {
  const shortfalls = forgeShortfalls(forgeLists, commits);
  const [only] = shortfalls;
  if (only === undefined) return null;
  if (shortfalls.length > 1) {
    const names = shortfalls.map(({ list }) => list.place.name);
    const lacks = shortfalls.map(
      ({ list, lacking }) =>
        `${list.place.name} lacks ${plural(lacking.length, "commit", "commits")}`,
    );
    return `${names.join(" and ")} have diverged: ${lacks.join(", ")}.`;
  }
  const holders = forgeLists.filter(
    (other) =>
      other !== only.list &&
      only.lacking.some((commit) => reachIn(other.commits, commit) === "held"),
  );
  return `${only.list.place.name} is ${plural(only.lacking.length, "commit", "commits")} behind ${holders.map(({ place }) => place.name).join(" and ")}.`;
}

/**
 * The commit river: local main's and each forge's newest commits joined by hash, told once each,
 * newest first and capped, with each commit's reach in every place and a sentence on divergence.
 */
function riverFor(item: Item, cap: number): River {
  const lists = [
    ...(item.path === null ? [] : [herePlace(item)]),
    ...forgeNames
      .filter((forge) =>
        item.presences.forges.some((presence) => presence.forge === forge),
      )
      .map((forge) => forgePlace(item, forge)),
  ];
  const joined = new Map<string, FinalisedCommit>();
  for (const { commits } of lists) {
    for (const commit of commits ?? []) {
      if (!joined.has(commit.sha)) joined.set(commit.sha, commit);
    }
  }
  const commits = [...joined.values()].sort(
    (a, b) => Date.parse(b.committedAt) - Date.parse(a.committedAt),
  );
  const forgeLists = lists.filter(
    (list) => list.repoUrl !== null && list.commits !== null,
  );
  return {
    places: lists.map(({ place }) => place),
    commits: commits.slice(0, cap).map((commit) => {
      const holderUrl =
        forgeLists.find((list) => reachIn(list.commits, commit) === "held")
          ?.repoUrl ?? null;
      return {
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        subject: commit.subject,
        committedAt: commit.committedAt,
        url: holderUrl === null ? null : `${holderUrl}/commit/${commit.sha}`,
        reach: lists.map((list) => ({
          place: list.place.name,
          reach: reachIn(list.commits, commit),
        })),
      };
    }),
    divergence: divergenceOf(forgeLists, commits),
  };
}

function pullRequestsFor(item: Item): PullRequestLine[] {
  return forgeData(item)
    .flatMap(({ forge, data }) =>
      data.openPullRequests.map((pull) => ({ forge, ...pull })),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** The launch actions for a local item; one whose command config leaves out is not offered. */
function actionsFor(
  item: Item,
  entry: ItemEntry | null,
  config: Config,
): LaunchAction[] {
  const path = item.path;
  if (path === null) return [];
  const commands = config.launch.commands;
  const offered: (LaunchAction | null)[] = [
    item.kind === "vault" && commands.obsidian
      ? {
          kind: "obsidian",
          verb: "Open in Obsidian",
          vault: path.slice(path.lastIndexOf("/") + 1),
        }
      : null,
    commands.zellij && commands.terminal
      ? {
          kind: "zellij-tab",
          verb: "Open the zellij tab",
          session: zellijSessionFor(config, entry, path),
          tab: item.name,
          cwd: path,
        }
      : null,
    commands.vscode ? { kind: "vscode", verb: "Open in VS Code", path } : null,
    commands.folder ? { kind: "folder", verb: "Open the folder", path } : null,
  ];
  return offered.filter((action) => action !== null);
}

function keyFilesFor(item: Item, entry: ItemEntry | null): KeyFile[] {
  const path = item.path;
  if (path === null) return [];
  const roadmap = readable<RoadmapData>(item.sources.roadmap);
  const files = entry?.keyFiles ?? [
    "README.md",
    ...(roadmap?.files.map((file) => file.path) ?? []),
  ];
  return files.map((file) => ({ path: file, absolutePath: `${path}/${file}` }));
}

function problemsFor(item: Item): SourceProblem[] {
  return Object.entries(item.sources).flatMap(([source, data]) =>
    data && "error" in data
      ? [
          {
            source: sourceLabel[source as keyof ItemSourceData],
            error: data.error,
          },
        ]
      : [],
  );
}

function fenceSituation(item: Item): FenceSituation {
  const first = item.presences.forges[0];
  if (item.presences.local === null && first) {
    return { kind: "forge-only", forge: first.forge, fullName: first.fullName };
  }
  const git = readable<GitData>(item.sources.git);
  return git?.backup === "local-only"
    ? { kind: "one-disk" }
    : { kind: "undecided" };
}

/** Hours from the newest commit, local or on a forge's default branch, to the scan. */
function lastTouchedHours(item: Item, scannedAt: Date): number | null {
  const git = readable<GitData>(item.sources.git);
  const times = [
    git?.lastCommitAt ?? null,
    ...forgeData(item).flatMap(({ data }) =>
      data.finalisedCommits.map((commit) => commit.committedAt),
    ),
  ].filter((time): time is string => time !== null);
  const newest = times.sort().at(-1);
  return newest === undefined ? null : hoursSince(newest, scannedAt);
}

/** Everything a bird's speech is chosen from, read off its snapshot item and the config. */
export function speechSubjectFor(
  item: Item,
  config: Config,
  scannedAt: Date,
): SpeechSubject {
  return speechSubject(
    item,
    wireFor(config, entryFor(item, config)),
    scannedAt,
  );
}

function speechSubject(
  item: Item,
  wire: string | null,
  scannedAt: Date,
): SpeechSubject {
  const git = readable<GitData>(item.sources.git);
  return {
    fence: wire === null ? fenceSituation(item) : null,
    causes: deriveHealth(item).causes,
    activity: git ? activityOf[git.activity] : null,
    branch: git?.branch ?? null,
    defaultBranch: git?.defaultBranch ?? null,
    unpushedCount: git?.unpushedCount ?? 0,
    openItems: openItemsOf(readable<RoadmapData>(item.sources.roadmap)),
    lastTouchedHours: lastTouchedHours(item, scannedAt),
  };
}

/** One bird, before it is placed: its position is set when the wire is ordered; paths show home as ~. */
export function deriveBird(
  item: BirdItem,
  config: Config,
  scannedAt: Date,
  home: string,
): Bird {
  const health = deriveHealth(item);
  const mood = moodOf[health.level];
  const git = readable<GitData>(item.sources.git);
  const activity = git ? activityOf[git.activity] : null;
  const entry = entryFor(item, config);
  const wire = wireFor(config, entry);
  const adopted = wire !== null;
  const name = entry?.name ?? item.name;
  const outstanding = openItemsOf(readable<RoadmapData>(item.sources.roadmap));
  const speech = speak(speechSubject(item, wire, scannedAt));
  const sleepsAtNight =
    !adopted || (mood === "content" && activity !== "editing");
  const chips = adopted ? chipsFor(item, health) : [];
  return {
    id: item.id,
    name,
    kind: item.kind,
    adopted,
    wire,
    position: 0,
    health,
    mood,
    activity,
    plumpness: {
      outstanding,
      fullness: Math.min(outstanding, plumpnessCap) / plumpnessCap,
    },
    sleepsAtNight,
    bubble: {
      name,
      stateWord: adopted ? mood : "not adopted",
      speech,
      wokenSpeech: sleepsAtNight ? `${wakingPrefix} ${speech}` : null,
      chips,
    },
    detail: {
      clonePath: item.path === null ? null : collapseHome(item.path, home),
      forges: [
        ...new Set(item.presences.forges.map((presence) => presence.forge)),
      ],
      ledger: ledgerFor(item, chips),
      branches: branchesFor(item, config),
      river: riverFor(item, config.scan.finalisedCommits),
      pullRequests: pullRequestsFor(item),
      flags: item.flags.map((flag) => ({
        flag: flag.flag,
        text: flagText[flag.flag],
        detail: flag.detail,
        level: flag.level,
      })),
      actions: actionsFor(item, entry, config),
      links: item.presences.forges.map((presence) => ({
        label: `${presence.fullName} on ${forgeLabel[presence.forge]}`,
        url: presence.url,
      })),
      keyFiles: keyFilesFor(item, entry),
      problems: problemsFor(item),
    },
  };
}

const moodRank: Record<Mood, number> = {
  distressed: 0,
  restless: 1,
  content: 2,
};

/** Along a wire: the worst mood leftmost, then by name. */
export function compareOnWire(a: Bird, b: Bird): number {
  return moodRank[a.mood] - moodRank[b.mood] || a.name.localeCompare(b.name);
}

function placed(birds: Bird[], compare: (a: Bird, b: Bird) => number): Bird[] {
  return birds.sort(compare).map((bird, position) => ({ ...bird, position }));
}

/**
 * The aviary from a snapshot and the config, paths under the home directory shown with ~. Every
 * configured wire appears, empty or not, in config order. The server item waits for server
 * monitoring and is not a bird. The fence is ordered by name: it holds no priority.
 */
export function deriveAviary(
  snapshot: Snapshot,
  config: Config,
  home: string,
): Aviary {
  const scannedAt = new Date(snapshot.scannedAt);
  const birds = snapshot.items
    .filter(isBirdItem)
    .map((item) => deriveBird(item, config, scannedAt, home));
  return {
    scannedAt: snapshot.scannedAt,
    wires: config.wires.names.map((name) => ({
      name,
      birds: placed(
        birds.filter((bird) => bird.wire === name),
        compareOnWire,
      ),
    })),
    fence: {
      birds: placed(
        birds.filter((bird) => !bird.adopted),
        (a, b) => a.name.localeCompare(b.name),
      ),
    },
    sourceErrors: Object.entries(snapshot.sources).flatMap(
      ([source, status]) =>
        status.state === "error"
          ? [
              {
                source: source as PolledSourceName,
                reason: status.reason,
                error: status.error,
                lastSucceededAt: status.lastSucceededAt,
              },
            ]
          : [],
    ),
    warnings: snapshot.warnings,
  };
}
