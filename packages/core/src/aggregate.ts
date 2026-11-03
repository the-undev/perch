import { basename } from "node:path";
import {
  type Config,
  hostsOf,
  type ItemEntry,
  type ResolvedEntry,
  resolveEntry,
  thresholdsFor,
} from "./config.ts";
import {
  deriveClaudeSessions,
  deriveForge,
  deriveGit,
  deriveKuma,
  deriveRoadmap,
  deriveSourceCards,
  emptyRoadmap,
} from "./derivations.ts";
import { polledSourceOrder, type RawStore } from "./gather.ts";
import {
  type ForgeInput,
  fullNameOf,
  isArchived,
  type JoinResult,
  joinPresences,
  type LocalInput,
  type Project,
} from "./join.ts";
import type {
  Entry,
  ForgeName,
  PolledSourceName,
  RawFiles,
  SourceStatus as RawSourceStatus,
  StatusFile,
} from "./raw.ts";
import { forgeRef, localRef } from "./refs.ts";
import type {
  Backup,
  ConfigConflict,
  ForgeData,
  ForgeError,
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

/** Id of the server item a kuma source monitors, by the source's name. */
export function serverItemId(name: string): string {
  return `server:${name}`;
}

const forgeNames: readonly ForgeName[] = ["github", "forgejo"];

/** Everything aggregation reads: the status file and each source's raw file. */
export interface RawBundle {
  status: StatusFile;
  files: Partial<RawFiles>;
}

export interface AggregateInput {
  config: Config;
  configPath: string;
  /** The home directory, written as ~ in the source cards' paths. */
  home: string;
  liveSources: readonly AnyLiveSource[];
  /** The previous snapshot, which carries each source card's last read; null for none. */
  previous: Snapshot | null;
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
 * repositories found through local remotes and the details of each. A remote's repository the
 * enricher could not read is a presence carrying its error; an untracked fork is left out.
 */
function forgePresences(
  forge: ForgeName,
  files: Partial<RawFiles>,
): ForgeInput[] {
  const accounts =
    files[forge === "github" ? "githubAccounts" : "forgejoAccounts"];
  const repos = new Map<string, ForgeInput["repo"]>();
  for (const entry of Object.values(accounts?.data ?? {})) {
    if (entry.state !== "observed") continue;
    for (const info of entry.value.repos) {
      repos.set(`${info.owner}/${info.name}`.toLowerCase(), {
        state: "observed",
        value: {
          info,
          foundBy: "account-listing",
          account: info.owner,
          aliases: [],
          details: { state: "error", error: "details not gathered" },
        },
      });
    }
  }
  for (const [key, entry] of Object.entries(files[forge]?.data ?? {})) {
    if (entry.state !== "absent") repos.set(key, entry);
  }
  return [...repos]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, repo]) => ({ forge, key, repo }));
}

/** A forge presence's data: derived when it was read, else its error and whether no card covers it. */
function forgeSource(presence: ForgeInput): ForgeData | ForgeError {
  if (presence.repo.state === "observed")
    return deriveForge(presence.repo.value);
  return {
    error: presence.repo.error,
    cause: presence.repo.reason === "no-card" ? "no-card" : "read-failed",
  };
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
  entry: ItemEntry | null,
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
      thresholdsFor(config, entry),
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

/** A project's item id: the local id when a clone exists, else its first reference. */
function projectId(project: Project): string {
  return project.local ? project.local.id : (project.refs[0] ?? "");
}

/** The config entry a project resolves to, by its id and every presence reference. */
function entryOf(project: Project, config: Config): ResolvedEntry {
  return resolveEntry(config, projectId(project), project.refs);
}

/** Joins the presences in a set of raw files into projects, with config's hosts, joins and ignores. */
export function joinRawFiles(
  files: Partial<RawFiles>,
  config: Config,
): JoinResult {
  const github = hostsOf(config.sources.github);
  const forgejo = hostsOf(config.sources.forgejo);
  return joinPresences({
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
}

/**
 * The config entry each local clone resolves to through the project it joins, for the gather
 * rounds that need an entry before aggregation.
 */
export function localEntries(
  files: Partial<RawFiles>,
  config: Config,
): Map<string, ItemEntry | null> {
  return new Map(
    joinRawFiles(files, config).projects.flatMap((project) =>
      project.local
        ? [[project.local.id, entryOf(project, config).entry] as const]
        : [],
    ),
  );
}

function itemFor(
  project: Project,
  entry: ItemEntry | null,
  files: Partial<RawFiles>,
  config: Config,
): Item {
  const local = project.local;
  const first = project.forges[0];
  const id = projectId(project);
  const sources: ItemSources = local
    ? localSources({ ...project, local }, entry, files, config)
    : {};
  for (const forge of forgeNames) {
    const presence = project.forges.find((entry) => entry.forge === forge);
    if (presence) sources[forge] = forgeSource(presence);
  }
  const flags = [...project.flags];
  const include = local
    ? files.local?.data.includes[local.presence.include]
    : undefined;
  if (
    local &&
    include?.state === "observed" &&
    include.value === "directory" &&
    entry === null
  ) {
    flags.unshift({
      flag: "not-set-up",
      level: "red",
      detail: `found under ${local.presence.include} with no entry in config items`,
    });
  }
  return {
    id,
    name: local
      ? basename(local.presence.path)
      : first?.repo.state === "observed"
        ? first.repo.value.info.name
        : id,
    kind: local?.presence.obsidian.folder ? "obsidian" : "git",
    path: local ? local.presence.path : null,
    liveSources: [],
    presences: {
      local: local
        ? { ref: localRef(local.id), path: local.presence.path }
        : null,
      forges: project.forges.map((presence) => ({
        forge: presence.forge,
        ref: forgeRef(presence.forge, presence.key),
        fullName: fullNameOf(presence),
        url:
          presence.repo.state === "observed"
            ? presence.repo.value.info.url
            : null,
        sshUrl:
          presence.repo.state === "observed" &&
          presence.repo.value.info.sshUrl.state === "observed"
            ? presence.repo.value.info.sshUrl.value
            : null,
        foundBy:
          presence.repo.state === "observed"
            ? presence.repo.value.foundBy
            : "local-remote",
      })),
    },
    flags,
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
  const join = joinRawFiles(files, config);

  const resolved: { item: Item; keys: string[] }[] = join.projects.map(
    (project) => {
      const { entry, keys } = entryOf(project, config);
      return {
        item: itemFor(project, entry, files, config),
        keys,
      };
    },
  );
  for (const card of config.sources.kuma) {
    const id = serverItemId(card.name);
    const { keys } = resolveEntry(config, id, []);
    const kuma = fromEntry(
      files.kuma?.data[card.name],
      deriveKuma,
      () => undefined,
    );
    resolved.push({
      item: {
        id,
        name: card.name,
        kind: "server",
        path: null,
        liveSources: [],
        presences: { local: null, forges: [] },
        flags: [],
        sources: kuma === undefined ? {} : { kuma },
      },
      keys,
    });
  }
  const items = resolved.map(({ item }) => item);
  for (const item of items) {
    item.liveSources = input.liveSources
      .filter((source) => source.appliesTo(item))
      .map((source) => source.name);
  }

  const conflicts: ConfigConflict[] = [...join.conflicts];
  for (const { item, keys } of resolved) {
    if (keys.length < 2) continue;
    const assertion = keys
      .map((key) => `items.${JSON.stringify(key)}`)
      .join(", ");
    const detail = `name one item, ${item.id}; items.${JSON.stringify(keys[0])} applies`;
    conflicts.push({ assertion, detail });
    item.flags.push({
      flag: "config-conflict",
      level: null,
      detail: `${assertion}: ${detail}`,
    });
  }
  const matched = new Set(resolved.flatMap(({ keys }) => keys));
  for (const key of Object.keys(config.items)) {
    if (matched.has(key)) continue;
    conflicts.push({
      assertion: `items.${JSON.stringify(key)}`,
      detail: `${key} was not observed`,
    });
  }

  const forges = {} as Record<ForgeName, ForgeListing>;
  for (const forge of forgeNames) {
    const listing: ForgeListing = { active: [], archived: [] };
    for (const presence of forgePresences(forge, files)) {
      if (presence.repo.state !== "observed") continue;
      const ref = forgeRef(forge, presence.key);
      const project = join.projectOf.get(ref);
      (isArchived(presence) ? listing.archived : listing.active).push({
        ref,
        fullName: presence.repo.value.info.fullName,
        url: presence.repo.value.info.url,
        itemId: project ? projectId(project) : null,
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
    sourceCards: deriveSourceCards({
      sources: config.sources,
      files,
      status: bundle.status,
      // A snapshot written before source cards existed has none to carry.
      previous: input.previous?.sourceCards ?? [],
      home: input.home,
    }),
    items,
  };
}
