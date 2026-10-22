import { basename } from "node:path";
import { type Config, importanceFor, thresholdsFor } from "./config.ts";
import {
  deriveClaudeSessions,
  deriveExpectation,
  deriveForge,
  deriveGit,
  deriveKuma,
  deriveRoadmap,
  emptyRoadmap,
  expectationMet,
} from "./derivations.ts";
import { polledSourceOrder, type RawStore } from "./gather.ts";
import {
  type ForgeInput,
  forgeRef,
  joinPresences,
  type LocalInput,
  localRef,
  normaliseRef,
  type Project,
} from "./join.ts";
import type {
  Entry,
  ForgeName,
  PolledSourceName,
  RawFiles,
  RawForgeRepo,
  SourceStatus as RawSourceStatus,
  StatusFile,
} from "./raw.ts";
import type {
  Backup,
  ConfigConflict,
  Expectation,
  ExpectationName,
  ForgeListing,
  Item,
  ItemError,
  ItemSources,
  LiveSourceName,
  Snapshot,
  SourceStatus,
} from "./snapshot.ts";
import type { LiveSource } from "./sources/source.ts";

/** Any live source, whatever data it returns. */
export type AnyLiveSource = LiveSource<LiveSourceName, unknown>;

/** Id of the one server item. */
export const serverItemId = "server";

const forgeNames: readonly ForgeName[] = ["github", "forgejo"];

/** Everything aggregation reads: the status file and each source's raw file. */
export interface RawBundle {
  status: StatusFile;
  files: Partial<RawFiles>;
}

export interface AggregateInput {
  config: Config;
  configPath: string;
  liveSources: readonly AnyLiveSource[];
  /** The previous snapshot, which carries each unmet expectation's first-seen time; null for none. */
  previous: Snapshot | null;
}

/** When an expectation was first found unmet, from a previous snapshot, keyed by item and name. */
type FirstSeen = Map<string, string>;

const firstSeenKey = (itemId: string, name: ExpectationName) =>
  `${itemId}\u0000${name}`;

/**
 * The unmet expectations a previous snapshot recorded. A snapshot written before expectations
 * existed has none, which restarts every clock: losing the record is harmless by design.
 */
function firstSeenFrom(previous: Snapshot | null): FirstSeen {
  const firstSeen: FirstSeen = new Map();
  for (const item of previous?.items ?? []) {
    for (const expectation of item.expectations ?? []) {
      if (expectation.unmetSince === null) continue;
      firstSeen.set(
        firstSeenKey(item.id, expectation.name),
        expectation.unmetSince,
      );
    }
  }
  return firstSeen;
}

function expectationsFor(
  itemId: string,
  sources: ItemSources,
  config: Config,
  firstSeen: FirstSeen,
  observedAt: Date,
): Expectation[] {
  const thresholds = thresholdsFor(config, itemId).expectation;
  return (config.items[itemId]?.expect ?? []).map((name) =>
    deriveExpectation(
      name,
      expectationMet(name, sources),
      firstSeen.get(firstSeenKey(itemId, name)) ?? null,
      thresholds,
      observedAt,
    ),
  );
}

/** Reads the raw directory; a source with no raw file yet is left out. */
export async function readRawBundle(store: RawStore): Promise<RawBundle> {
  const status = (await store.read("status")) as StatusFile | null;
  if (status === null) {
    throw new Error("no raw files to aggregate: run pnpm gather first");
  }
  const files: Partial<RawFiles> = {};
  for (const name of polledSourceOrder) {
    const file = await store.read(name);
    if (file !== null) Object.assign(files, { [name]: file });
  }
  return { status, files };
}

/** Maps one raw entry: an error stays an error, absence maps through its own rule. */
function fromEntry<T, R extends string, D>(
  entry: Entry<T, R> | undefined,
  observed: (value: T) => D | ItemError,
  absent: (reason: R) => D | undefined,
): D | ItemError | undefined {
  if (entry === undefined) return undefined;
  if (entry.state === "error") return { error: entry.error };
  if (entry.state === "absent") return absent(entry.reason);
  return observed(entry.value);
}

/**
 * Forge presences from the account listings, overlaid with the forge enricher's file, which adds
 * repositories found through local remotes and the details of each.
 */
function forgePresences(
  forge: ForgeName,
  files: Partial<RawFiles>,
): ForgeInput[] {
  const accounts =
    files[forge === "github" ? "githubAccounts" : "forgejoAccounts"];
  const repos = new Map<string, RawForgeRepo>();
  for (const [account, entry] of Object.entries(accounts?.data ?? {})) {
    if (entry.state !== "observed") continue;
    for (const info of entry.value.repos) {
      repos.set(`${info.owner}/${info.name}`.toLowerCase(), {
        info,
        foundBy: "account-listing",
        account,
        aliases: [],
        details: { state: "error", error: "details not gathered" },
      });
    }
  }
  for (const [key, entry] of Object.entries(files[forge]?.data ?? {})) {
    if (entry.state === "observed") repos.set(key, entry.value);
  }
  return [...repos]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, repo]) => ({ forge, key, repo }));
}

function backupOf(project: Project & { local: LocalInput }): Backup {
  if (project.forges.length > 0) return "joined";
  const git = project.local.presence.git;
  return git.state === "observed" && git.value.remotes.state === "observed"
    ? "unjoined-remote"
    : "local-only";
}

function localSources(
  project: Project & { local: LocalInput },
  files: Partial<RawFiles>,
  config: Config,
): ItemSources {
  const sources: ItemSources = {};
  const { id, presence } = project.local;
  const observedAt = new Date(files.local?.gatheredAt ?? 0);
  if (presence.git.state === "error") {
    sources.git = { error: presence.git.error };
  } else if (presence.git.state === "observed") {
    sources.git = deriveGit(
      presence.git.value,
      thresholdsFor(config, id),
      observedAt,
      backupOf(project),
    );
  }
  const roadmap = fromEntry(
    files.roadmap?.data[id],
    deriveRoadmap,
    () => emptyRoadmap,
  );
  if (roadmap !== undefined) sources.roadmap = roadmap;
  const sessions = fromEntry(
    files.claudeSessions?.data[id],
    deriveClaudeSessions,
    () => undefined,
  );
  if (sessions !== undefined) sources.claudeSessions = sessions;
  return sources;
}

function itemFor(
  project: Project,
  files: Partial<RawFiles>,
  config: Config,
  expectations: { firstSeen: FirstSeen; observedAt: Date },
): Item {
  const local = project.local;
  const first = project.forges[0];
  const id = local ? local.id : (project.refs[0] ?? "");
  const sources: ItemSources = local
    ? localSources({ ...project, local }, files, config)
    : {};
  for (const forge of forgeNames) {
    const presence = project.forges.find((entry) => entry.forge === forge);
    if (presence) sources[forge] = deriveForge(presence.repo);
  }
  const flags = [...project.flags];
  const include = local
    ? files.local?.data.includes[local.presence.include]
    : undefined;
  if (
    local &&
    include?.state === "observed" &&
    include.value === "directory" &&
    config.items[local.id] === undefined
  ) {
    flags.unshift({
      flag: "not-set-up",
      level: "red",
      detail: `found under ${local.presence.include} with no entry in config items`,
    });
  }
  return {
    id,
    name: local ? basename(local.presence.path) : (first?.repo.info.name ?? id),
    kind: local?.presence.obsidian.folder ? "vault" : "repo",
    path: local ? local.presence.path : null,
    importance: importanceFor(config, id),
    liveSources: [],
    presences: {
      local: local
        ? { ref: localRef(local.id), path: local.presence.path }
        : null,
      forges: project.forges.map((presence) => ({
        forge: presence.forge,
        ref: forgeRef(presence.forge, presence.key),
        fullName: presence.repo.info.fullName,
        url: presence.repo.info.url,
        foundBy: presence.repo.foundBy,
      })),
    },
    flags,
    expectations: expectationsFor(
      id,
      sources,
      config,
      expectations.firstSeen,
      expectations.observedAt,
    ),
    sources,
  };
}

function sourceStatus(raw: RawSourceStatus): SourceStatus {
  if (raw.state === "ok") {
    return {
      state: "ok",
      reason: null,
      error: null,
      lastSucceededAt: raw.lastSucceededAt,
      durationMs: raw.durationMs,
    };
  }
  return {
    state: "error",
    reason: raw.reason,
    error: raw.message,
    lastSucceededAt:
      raw.lastSucceededAt.state === "observed"
        ? raw.lastSucceededAt.value
        : null,
    durationMs: raw.durationMs,
  };
}

/**
 * Builds the snapshot from raw files alone: joins presences into projects, derives each
 * project's data, and records where config and observation disagree. Ages are measured against
 * each source file's gatheredAt, so the same raw files always give the same snapshot.
 */
export function aggregate(
  bundle: RawBundle,
  input: AggregateInput,
  aggregatedAt: Date,
): Snapshot {
  const { config } = input;
  const files = bundle.files;
  const github = config.forges.github.hosts;
  const forgejo = config.forges.forgejo.hosts;
  const join = joinPresences({
    locals: Object.entries(files.local?.data.presences ?? {}).map(
      ([id, presence]) => ({
        id,
        presence,
      }),
    ),
    forges: forgeNames.flatMap((forge) => forgePresences(forge, files)),
    forgeForHost: (host) =>
      github.includes(host)
        ? "github"
        : forgejo.includes(host)
          ? "forgejo"
          : null,
    joins: config.joins,
    ignore: config.ignore,
  });

  const expectations = {
    firstSeen: firstSeenFrom(input.previous),
    observedAt: new Date(bundle.status.gatheredAt),
  };
  const items = join.projects.map((project) =>
    itemFor(project, files, config, expectations),
  );
  const idOf = new Map(
    join.projects.map((project, index) => [project, items[index]?.id ?? ""]),
  );
  if (config.server !== null) {
    items.push({
      id: serverItemId,
      name: config.server.name,
      kind: "server",
      path: null,
      importance: importanceFor(config, serverItemId),
      liveSources: [],
      presences: { local: null, forges: [] },
      flags: [],
      expectations: [],
      sources: files.kuma ? { kuma: deriveKuma(files.kuma.data) } : {},
    });
  }
  for (const item of items) {
    item.liveSources = input.liveSources
      .filter((source) => source.appliesTo(item))
      .map((source) => source.name);
  }

  const conflicts: ConfigConflict[] = [...join.conflicts];
  const itemIds = new Set(items.map((item) => item.id));
  for (const key of Object.keys(config.items)) {
    if (itemIds.has(key)) continue;
    const assertion = `items.${JSON.stringify(key)}`;
    const project =
      join.projectOf.get(normaliseRef(key)) ??
      join.projectOf.get(localRef(key));
    const owner = project
      ? items.find((item) => item.id === idOf.get(project))
      : undefined;
    const detail = owner
      ? `names a presence joined into ${owner.id}; key it by that id`
      : `${key} was not observed`;
    conflicts.push({ assertion, detail });
    owner?.flags.push({
      flag: "config-conflict",
      level: null,
      detail: `${assertion}: ${detail}`,
    });
  }

  const forges = {} as Record<ForgeName, ForgeListing>;
  for (const forge of forgeNames) {
    const listing: ForgeListing = { active: [], archived: [] };
    for (const presence of forgePresences(forge, files)) {
      const ref = forgeRef(forge, presence.key);
      const project = join.projectOf.get(ref);
      (presence.repo.info.archived ? listing.archived : listing.active).push({
        ref,
        fullName: presence.repo.info.fullName,
        url: presence.repo.info.url,
        itemId: project ? (idOf.get(project) ?? null) : null,
        ignored: join.ignored.has(ref),
      });
    }
    forges[forge] = listing;
  }

  const sources: Partial<Record<PolledSourceName, SourceStatus>> = {};
  for (const name of polledSourceOrder) {
    const raw = bundle.status.sources[name];
    if (raw !== undefined) sources[name] = sourceStatus(raw);
  }
  const includes = files.local?.data.includes ?? {};
  return {
    scannedAt: bundle.status.gatheredAt,
    durationMs: bundle.status.durationMs,
    aggregatedAt: aggregatedAt.toISOString(),
    configPath: input.configPath,
    warnings: Object.entries(includes)
      .filter(([, include]) => include.state === "absent")
      .map(([path]) => `include not found: ${path}`),
    conflicts,
    forges,
    sources,
    items,
  };
}
