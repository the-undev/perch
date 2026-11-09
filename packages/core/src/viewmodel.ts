// The view model: everything the renderer draws, in the design's own words, derived from a
// snapshot and the config by pure functions. The renderer reads only these types, never the raw
// or snapshot types. Every value traces to a snapshot field; the sky follows the clock at render
// and is not part of the model. No Node modules, so the renderer can import it.

import {
  type Config,
  collapseHome,
  hostsOf,
  type ItemEntry,
  obsidianOnly,
  resolveEntry,
  wireFor,
  zellijSessionFor,
} from "./config.ts";
import {
  countOpenItems,
  deriveHealth,
  hoursSince,
  latestRunOf,
} from "./derivations.ts";
import { commandKinds, type IconName, zellijKind } from "./launch-kinds.ts";
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
  PullRequest,
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
  | {
      kind: "unreadable-remote";
      level: HealthLevel;
      forge: ForgeName;
      /** The repository the clone pushes to, as its remote names it. */
      fullName: string;
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
  /** Where a fence bird lives, for its hover tip; null on a wire or while undecided. */
  lives: string | null;
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
  "unreadable",
  "ci",
  "bugs",
  "uncommitted",
  "unpushed",
  "stalled",
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
 * that working out per source: each source with something to say, or that it couldn't be read.
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

/** A commit's spread: green on every forge read, amber short of one or when none could be read, null without a forge. */
export type SpreadTone = Exclude<HealthLevel, "red"> | null;

/** One commit on the default branch, told once however many places hold it. */
export interface RiverCommit {
  sha: string;
  shortSha: string;
  subject: string;
  committedAt: string;
  /** The commit on the first forge holding it; null when no forge does. */
  url: string | null;
  tone: SpreadTone;
  /** The spread in words, such as "on github and forgejo" or "no remote could be read". */
  spread: string;
}

/** The newest commits on the default branch, each once, with how far each has spread. */
export interface River {
  /** The default branch the river judges, the clone's else a forge's; null when none names it. */
  branch: string | null;
  /** Newest first, at most the configured number of finalised commits. */
  commits: RiverCommit[];
  /** A line per forge whose list couldn't be read, such as "couldn't read github", with why when no card covers it. */
  notes: string[];
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

/**
 * Launch actions open things and change nothing. Each wears its line icon and carries its commands
 * from config with the values that fill their placeholders at launch.
 */
export type LaunchAction =
  | {
      kind: "zellij";
      verb: string;
      icon: IconName;
      zellij: string[];
      terminal: string[];
      session: string;
      tab: string;
      cwd: string;
    }
  | {
      kind: "command";
      verb: string;
      icon: IconName;
      command: string[];
      path: string;
    }
  | {
      /** An action offered on Obsidian birds only, which may fill in {obsidian}. */
      kind: "obsidian";
      verb: string;
      icon: IconName;
      command: string[];
      path: string;
      /** The Obsidian vault's folder name. */
      obsidianVault: string;
    };

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

/**
 * A remote the clone pushes to that no card can read, said under the page's heading: what perch
 * knows and could not do, then the fix, which ends on the link to the settings page's Sources.
 */
export interface RemoteNotice {
  /** Such as "The clone pushes to skiff-app/skiff on github, which no GitHub card reads." */
  text: string;
  /** Such as "Add a card for skiff-app under", before the link. */
  fix: string;
}

/** What the slip says for a bird seen on its forges with no clone on this machine. */
export interface NoClone {
  /** The forges holding the repository, as the slip names them: "Forgejo", or "GitHub and Forgejo". */
  forges: string;
  /** The repository a clone's remote points at to join the bird, such as finch/pocket. */
  reference: string;
  /** The SSH address to clone from, the first a forge gives; null while unknown. */
  cloneAddress: string | null;
  /** Whether the meta line says "no local clone": config holds at least one launch action. */
  onMetaLine: boolean;
}

/** Everything about one bird beyond its look and bubble, which the detail page also shows. */
export interface Detail {
  /** Where the clone is on disk, home as ~; null for a bird with no clone here. */
  clonePath: string | null;
  /** The forges that hold the bird, each once, in the order its presences were found. */
  forges: ForgeName[];
  /** One per remote no card can read; where the can't-read chip lands. */
  notices: RemoteNotice[];
  /** The sentence that opens the ledger when nothing waits; null when something does. */
  quiet: string | null;
  ledger: LedgerEntry[];
  branches: BranchLine[];
  river: River;
  pullRequests: PullRequestLine[];
  flags: FlagLine[];
  actions: LaunchAction[];
  links: LinkOut[];
  keyFiles: KeyFile[];
  /** The slip where the key files would be: null for a bird with a clone here or on no forge. */
  noClone: NoClone | null;
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

/** Each forge the item holds a source for: its data, or null when it couldn't be read. */
function forgeSources(
  item: Item,
): { forge: ForgeName; data: ForgeData | null }[] {
  return forgeNames.flatMap((forge) => {
    const source = item.sources[forge];
    if (source === undefined) return [];
    return [{ forge, data: "error" in source ? null : source }];
  });
}

/** Each part of a forge's data, named in full for a working that says it couldn't be read. */
const forgePartLabel = {
  openPullRequests: "pull requests",
  latestCi: "CI",
  finalisedCommits: "commits",
} as const;

type ForgePart = keyof typeof forgePartLabel;

const forgeParts = Object.keys(forgePartLabel) as ForgePart[];

/** Whether a part of a forge's data failed to read. */
function failed(part: object | null): part is ItemError {
  return part !== null && "error" in part;
}

function couldNotRead(source: string, part: ForgePart): Working {
  return {
    source,
    text: `couldn't read ${forgePartLabel[part]}`,
    tone: "amber",
    url: null,
    at: null,
  };
}

/** Each forge whose open pull requests were read, with them. */
function forgePullRequests(
  item: Item,
): { forge: ForgeName; pulls: PullRequest[] }[] {
  return forgeData(item).flatMap(({ forge, data }) => {
    const pulls = readable<PullRequest[]>(data.openPullRequests);
    return pulls ? [{ forge, pulls }] : [];
  });
}

/** The worst state among the forges' newest runs; undefined when no forge has a run. */
function worstCiState(item: Item): CiState | undefined {
  const runs = forgeData(item).flatMap(({ data }) => {
    const run = latestRunOf(data);
    return run ? [run] : [];
  });
  return ciSeverityOrder.find((state) =>
    runs.some((run) => run.state === state),
  );
}

function ciTone(state: CiState): Tone {
  if (state === "failure") return "red";
  return state === "success" ? "green" : null;
}

/** Whether the item has a forge and none of them had this part read. */
function noneRead(item: Item, part: ForgePart): boolean {
  const sources = forgeSources(item);
  return (
    sources.length > 0 &&
    sources.every(({ data }) => data === null || failed(data[part]))
  );
}

/** A row no forge could be read for: "couldn't read" in amber, each forge's working saying so. */
function unreadRow(label: string, workings: Working[]): LedgerEntry {
  return {
    kind: "state",
    label,
    text: "couldn't read",
    tone: "amber",
    url: null,
    chip: null,
    workings,
  };
}

/**
 * The CI row: the worst state, as the chip says it, then each forge's newest run, named and linked.
 * With no run anywhere it says "couldn't read" when no forge's CI could be read, else nothing.
 */
function ciEntry(item: Item, chip: ChipKind | null): LedgerEntry | null {
  const worst = worstCiState(item);
  const workings = ciWorkings(item);
  if (worst === undefined) {
    return noneRead(item, "latestCi") ? unreadRow("CI", workings) : null;
  }
  return {
    kind: "state",
    label: "CI",
    text: worst,
    tone: ciTone(worst),
    url: null,
    chip,
    workings,
  };
}

/** Each forge's newest run on the default branch, named and linked, or that its CI couldn't be read. */
function ciWorkings(item: Item): Working[] {
  return forgeSources(item).flatMap(({ forge, data }): Working[] => {
    if (data === null || failed(data.latestCi)) {
      return [couldNotRead(forge, "latestCi")];
    }
    const run = latestRunOf(data);
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
  });
}

/** Each forge's open pull requests, linked to its list; a forge with none is silent. */
function pullRequestWorkings(item: Item): Working[] {
  return forgeSources(item).flatMap(({ forge, data }): Working[] => {
    if (data === null || failed(data.openPullRequests)) {
      return [couldNotRead(forge, "openPullRequests")];
    }
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

/** Each branch's unpushed commits, oldest first, toned by age and linked to its upstream branch. */
function unpushedBranchWorkings(
  item: Item,
  git: GitData,
  config: Config,
): Working[] {
  return [...(git.unpushedBranches ?? [])]
    .sort(
      (a, b) =>
        a.work.since.localeCompare(b.work.since) ||
        a.name.localeCompare(b.name),
    )
    .map((branch) => ({
      source: "git",
      text:
        branch.upstream === null
          ? `${branch.name}, no upstream, ${plural(branch.count, "commit", "commits")}`
          : `${branch.name}, ${branch.count} ahead of ${branch.upstream}`,
      tone: severity(branch.work.level),
      url:
        branch.upstream === null
          ? null
          : upstreamUrl(item, git, branch.upstream, config),
      at: branch.work.since,
    }));
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
  return presence?.url
    ? branchUrl(presence.forge, presence.url, upstream.slice(slash + 1))
    : null;
}

function chipsFor(item: Item, health: Health): Chip[] {
  const chips: Chip[] = [];
  const unreadable = [
    ...new Set(
      health.causes.flatMap((cause) =>
        cause.kind === "unreadable-remote" ? [cause.forge] : [],
      ),
    ),
  ];
  if (unreadable.length > 0) {
    chips.push({
      kind: "unreadable",
      label: `can't read ${unreadable.join(" and ")}`,
      count: null,
      severity: "amber",
    });
  }
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
  const stall = health.causes.find(
    (cause): cause is Extract<HealthCause, { kind: "stalled" }> =>
      cause.kind === "stalled",
  );
  if (stall !== undefined) {
    chips.push({
      kind: "stalled",
      label: `parked ${plural(stall.stall.days, "day", "days")}`,
      count: stall.stall.days,
      severity: severity(stall.level),
    });
  }
  const pulls = forgePullRequests(item).reduce(
    (total, { pulls }) => total + pulls.length,
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
function ledgerFor(item: Item, chips: Chip[], config: Config): LedgerEntry[] {
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
          unpushedBranchWorkings(item, git, config),
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
  const pullForges = forgePullRequests(item);
  if (noneRead(item, "openPullRequests")) {
    ledger.push(unreadRow("open pull requests", pullRequestWorkings(item)));
  }
  if (pullForges.length > 0) {
    ledger.push(
      countEntry(
        "open pull requests",
        pullForges.reduce((total, { pulls }) => total + pulls.length, 0),
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

/** The ledger's opening sentence: only for a green bird's readable clone with nothing uncommitted or unpushed. */
function quietFor(item: Item, health: Health): string | null {
  if (health.level !== "green") return null;
  const git = readable<GitData>(item.sources.git);
  if (git === null) return null;
  if (git.uncommittedCount > 0 || git.unpushedCount > 0) return null;
  return git.backup === "local-only"
    ? "The working tree is clean; no remote holds a copy."
    : "The working tree is clean and everything is pushed.";
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

/** Whether a place holds a commit; lacking only within the place's list, unknown beyond it. */
type Reach = "held" | "lacking" | "unknown";

/** A place's list of commits on the default branch: null when unread, with a forge's address. */
interface PlaceList {
  name: "here" | ForgeName;
  commits: FinalisedCommit[] | null;
  repoUrl: string | null;
}

/** Local main's list: null when git couldn't be read, before a scan read it, or without main. */
function herePlace(item: Item): PlaceList {
  const git = readable<GitData>(item.sources.git);
  return {
    name: "here",
    commits: git?.defaultBranchCommits ?? null,
    repoUrl: null,
  };
}

/** A forge's list: null when the forge or its commits couldn't be read, whatever its other parts did. */
function forgePlace(item: Item, forge: ForgeName): PlaceList {
  const data = readable<ForgeData>(item.sources[forge]);
  return {
    name: forge,
    commits: data ? readable<FinalisedCommit[]>(data.finalisedCommits) : null,
    repoUrl: data?.url ?? null,
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
    const names = shortfalls.map(({ list }) => list.name);
    const lacks = shortfalls.map(
      ({ list, lacking }) =>
        `${list.name} lacks ${plural(lacking.length, "commit", "commits")}`,
    );
    return `${names.join(" and ")} have diverged: ${lacks.join(", ")}.`;
  }
  const holders = forgeLists.filter(
    (other) =>
      other !== only.list &&
      only.lacking.some((commit) => reachIn(other.commits, commit) === "held"),
  );
  return `${only.list.name} is ${plural(only.lacking.length, "commit", "commits")} behind ${holders.map(({ name }) => name).join(" and ")}.`;
}

/**
 * A commit's spread over the forges read. A forge holds it unless the commit is lacking there, so
 * one older than a forge's list counts as held. The clone only contributes commits. With forges
 * but none read the spread is unknown, in amber; only a bird with no forge is quiet.
 */
function spreadOf(
  forgeCount: number,
  forgeLists: PlaceList[],
  commit: FinalisedCommit,
): { tone: SpreadTone; spread: string } {
  if (forgeCount === 0) return { tone: null, spread: "no remote" };
  if (forgeLists.length === 0)
    return { tone: "amber", spread: "no remote could be read" };
  const holders = forgeLists
    .filter((list) => reachIn(list.commits, commit) !== "lacking")
    .map((list) => list.name);
  if (holders.length === forgeLists.length)
    return { tone: "green", spread: `on ${holders.join(" and ")}` };
  if (holders.length > 0)
    return { tone: "amber", spread: `only on ${holders.join(" and ")}` };
  if (forgeLists.length < forgeCount)
    return { tone: "amber", spread: "on no remote that could be read" };
  return { tone: "amber", spread: "not pushed to a remote" };
}

/**
 * A forge whose list couldn't be read, in a line: with the short why when no card covers its
 * owner, which only the standing gap has.
 */
function riverNote(item: Item, forge: ForgeName): string {
  const source = item.sources[forge];
  const presence = item.presences.forges.find((entry) => entry.forge === forge);
  if (
    source === undefined ||
    !("cause" in source) ||
    source.cause !== "no-card" ||
    presence === undefined
  ) {
    return `couldn't read ${forge}`;
  }
  const owner = presence.fullName.slice(0, presence.fullName.indexOf("/"));
  return `couldn't read ${forge} · no card covers ${owner}`;
}

/** The default branch the river judges: the clone's, else the first forge's read. */
function riverBranch(item: Item): string | null {
  const git = readable<GitData>(item.sources.git);
  return git?.defaultBranch ?? forgeData(item)[0]?.data.defaultBranch ?? null;
}

/**
 * The commit river: local main's and each forge's newest commits joined by hash, told once each,
 * newest first and capped, with each commit's spread over the forges and a sentence on divergence.
 */
function riverFor(item: Item, cap: number): River {
  const forgePlaces = forgeNames
    .filter((forge) =>
      item.presences.forges.some((presence) => presence.forge === forge),
    )
    .map((forge) => forgePlace(item, forge));
  const lists = [
    ...(item.path === null ? [] : [herePlace(item)]),
    ...forgePlaces,
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
  const forgeLists = forgePlaces.filter((list) => list.commits !== null);
  return {
    branch: riverBranch(item),
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
        ...spreadOf(forgePlaces.length, forgeLists, commit),
      };
    }),
    notes: forgeNames
      .filter((forge) =>
        forgePlaces.some(
          (list) => list.name === forge && list.commits === null,
        ),
      )
      .map((forge) => riverNote(item, forge)),
    divergence: divergenceOf(forgeLists, commits),
  };
}

function pullRequestsFor(item: Item): PullRequestLine[] {
  return forgePullRequests(item)
    .flatMap(({ forge, pulls }) => pulls.map((pull) => ({ forge, ...pull })))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * The launch actions for a local item, in config order: every action, bar one offered on Obsidian
 * birds only on a bird that is not one.
 */
function actionsFor(
  item: Item,
  entry: ItemEntry | null,
  config: Config,
): LaunchAction[] {
  const path = item.path;
  if (path === null) return [];
  return config.launch.actions.flatMap((action): LaunchAction[] => {
    if (action.kind === "zellij") {
      return [
        {
          kind: "zellij",
          verb: action.verb,
          icon: zellijKind.icon,
          zellij: action.zellij,
          terminal: action.terminal,
          session: zellijSessionFor(action, entry, path),
          tab: item.name,
          cwd: path,
        },
      ];
    }
    const { verb, command } = action;
    const icon =
      action.kind === "command" ? action.icon : commandKinds[action.kind].icon;
    if (!obsidianOnly(action)) {
      return [{ kind: "command", verb, icon, command, path }];
    }
    if (item.kind !== "obsidian") return [];
    const obsidianVault = path.slice(path.lastIndexOf("/") + 1);
    return [{ kind: "obsidian", verb, icon, command, path, obsidianVault }];
  });
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

/**
 * The slip for a bird held by at least one forge and cloned nowhere here: the forges by name, the
 * first presence's repository, and the first clone address a forge gave.
 */
function noCloneFor(item: Item, config: Config): NoClone | null {
  const [first] = item.presences.forges;
  if (item.path !== null || first === undefined) return null;
  const held = new Set(item.presences.forges.map((presence) => presence.forge));
  return {
    forges: forgeNames
      .filter((forge) => held.has(forge))
      .map((forge) => forgeLabel[forge])
      .join(" and "),
    reference: first.ref.slice(first.ref.indexOf(":") + 1),
    // A snapshot cached before the scanner kept the address has no field at all.
    cloneAddress:
      item.presences.forges
        .map((presence) => presence.sshUrl ?? null)
        .find((address) => address !== null) ?? null,
    onMetaLine: config.launch.actions.length > 0,
  };
}

/** Each source that couldn't be read for the bird, then each part of a forge read without it. */
function problemsFor(item: Item): SourceProblem[] {
  const sources = Object.entries(item.sources).flatMap(([source, data]) =>
    data && "error" in data
      ? [
          {
            source: sourceLabel[source as keyof ItemSourceData],
            error: data.error,
          },
        ]
      : [],
  );
  const parts = forgeData(item).flatMap(({ forge, data }) =>
    forgeParts.flatMap((part) => {
      const value = data[part];
      return failed(value)
        ? [
            {
              source: `${forgeLabel[forge]} ${forgePartLabel[part]}`,
              error: value.error,
            },
          ]
        : [];
    }),
  );
  return [...sources, ...parts];
}

/** A notice per remote no card can read, from the health causes that name them. */
function noticesFor(health: Health): RemoteNotice[] {
  return health.causes.flatMap((cause) =>
    cause.kind === "unreadable-remote"
      ? [
          {
            text: `The clone pushes to ${cause.fullName} on ${cause.forge}, which no ${forgeLabel[cause.forge]} card reads.`,
            fix: `Add a card for ${cause.fullName.slice(0, cause.fullName.indexOf("/"))} under`,
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

/** Where a fence bird lives, in the tip's lower-case words: its forge, or the one disk; null while undecided. */
function livesFor(situation: FenceSituation): string | null {
  switch (situation.kind) {
    case "forge-only":
      return `only on ${situation.forge}`;
    case "one-disk":
      return "one disk only";
    case "undecided":
      return null;
  }
}

/** Hours from the newest commit, local or on a forge's default branch, to the scan. */
function lastTouchedHours(item: Item, scannedAt: Date): number | null {
  const git = readable<GitData>(item.sources.git);
  const times = [
    git?.lastCommitAt ?? null,
    ...forgeData(item).flatMap(({ data }) =>
      (readable<FinalisedCommit[]>(data.finalisedCommits) ?? []).map(
        (commit) => commit.committedAt,
      ),
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
    lives: adopted ? null : livesFor(fenceSituation(item)),
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
      notices: noticesFor(health),
      quiet: quietFor(item, health),
      ledger: ledgerFor(item, chips, config),
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
      links: item.presences.forges.flatMap((presence) =>
        presence.url === null
          ? []
          : [
              {
                label: `${presence.fullName} on ${forgeLabel[presence.forge]}`,
                url: presence.url,
              },
            ],
      ),
      keyFiles: keyFilesFor(item, entry),
      noClone: noCloneFor(item, config),
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
