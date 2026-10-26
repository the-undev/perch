// The view model: everything the renderer draws, in the design's own words, derived from a
// snapshot and the config by pure functions. The renderer reads only these types, never the raw
// or snapshot types. Every value traces to a snapshot field; the sky follows the clock at render
// and is not part of the model. No Node modules, so the renderer can import it.

import {
  type Config,
  hostsOf,
  type ItemEntry,
  resolveEntry,
  wireFor,
  zellijSessionFor,
} from "./config.ts";
import { deriveHealth, hoursSince } from "./derivations.ts";
import { itemRefs } from "./refs.ts";
import { parseRemoteUrl } from "./remote-url.ts";
import type {
  AgedWork,
  CiRun,
  CiState,
  FailureReason,
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

export type ChipKind =
  | "ci"
  | "bugs"
  | "uncommitted"
  | "unpushed"
  | "pull-requests"
  | "open-items";

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

/** One fact in full words. A clean count of zero reads "none" in green. */
export type LedgerEntry =
  | { kind: "count"; label: string; count: number; text: string; tone: Tone }
  | {
      kind: "state";
      label: string;
      text: string;
      tone: Tone;
      url: string | null;
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

export interface CommitLine {
  sha: string;
  shortSha: string;
  subject: string;
  committedAt: string;
  url: string;
}

/** The newest commits on one forge's default branch, headed by the actual thing: "main on GitHub". */
export interface ForgeCommits {
  forge: ForgeName;
  heading: string;
  branchUrl: string;
  commits: CommitLine[];
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
  ledger: LedgerEntry[];
  branches: BranchLine[];
  newestCommits: ForgeCommits[];
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

function countEntry(label: string, count: number, tone: Tone): LedgerEntry {
  return count === 0
    ? { kind: "count", label, count, text: "none", tone: "green" }
    : { kind: "count", label, count, text: String(count), tone };
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
  const runs = forgeData(item).flatMap(({ data }) =>
    data.latestCi ? [data.latestCi] : [],
  );
  const worstCi = ciSeverityOrder.find((state) =>
    runs.some((run) => run.state === state),
  );
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

function ledgerFor(item: Item): LedgerEntry[] {
  const ledger: LedgerEntry[] = [];
  const git = readable<GitData>(item.sources.git);
  if (git) {
    ledger.push(
      countEntry(
        "uncommitted changes",
        git.uncommittedCount,
        git.drift.uncommitted ? severity(git.drift.uncommitted.level) : null,
      ),
    );
    if (git.backup === "local-only") {
      ledger.push({
        kind: "state",
        label: "remote",
        text: "none, one disk only",
        tone: null,
        url: null,
      });
    } else {
      ledger.push(
        countEntry(
          "unpushed commits",
          git.unpushedCount,
          git.drift.unpushed ? severity(git.drift.unpushed.level) : null,
        ),
      );
    }
  }
  const roadmap = readable<RoadmapData>(item.sources.roadmap);
  if (roadmap) {
    ledger.push(countEntry("open bugs", roadmap.counts.bug, "red"));
    ledger.push(countEntry("open roadmap items", openItemsOf(roadmap), null));
  }
  for (const { forge, data } of forgeData(item)) {
    ledger.push(
      countEntry(
        `open pull requests on ${forgeLabel[forge]}`,
        data.openPullRequests.length,
        null,
      ),
    );
    if (data.latestCi) {
      const { state } = data.latestCi;
      ledger.push({
        kind: "state",
        label: `CI on ${forgeLabel[forge]}`,
        text: `${state} on ${data.defaultBranch}`,
        tone:
          state === "failure" ? "red" : state === "success" ? "green" : null,
        url: data.latestCi.url,
      });
    }
  }
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

function newestCommitsFor(item: Item): ForgeCommits[] {
  return forgeData(item)
    .filter(({ data }) => data.finalisedCommits.length > 0)
    .map(({ forge, data }) => ({
      forge,
      heading: `${data.defaultBranch} on ${forgeLabel[forge]}`,
      branchUrl: branchUrl(forge, data.url, data.defaultBranch),
      commits: data.finalisedCommits.map((commit) => ({
        sha: commit.sha,
        shortSha: commit.sha.slice(0, 7),
        subject: commit.subject,
        committedAt: commit.committedAt,
        url: `${data.url}/commit/${commit.sha}`,
      })),
    }));
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

/** One bird, before it is placed: its position is set when the wire is ordered. */
export function deriveBird(
  item: BirdItem,
  config: Config,
  scannedAt: Date,
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
      chips: adopted ? chipsFor(item, health) : [],
    },
    detail: {
      ledger: ledgerFor(item),
      branches: branchesFor(item, config),
      newestCommits: newestCommitsFor(item),
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
 * The aviary from a snapshot and the config. Every configured wire appears, empty or not, in
 * config order. The server item waits for server monitoring and is not a bird. The fence is
 * ordered by name: it holds no priority.
 */
export function deriveAviary(snapshot: Snapshot, config: Config): Aviary {
  const scannedAt = new Date(snapshot.scannedAt);
  const birds = snapshot.items
    .filter(isBirdItem)
    .map((item) => deriveBird(item, config, scannedAt));
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
