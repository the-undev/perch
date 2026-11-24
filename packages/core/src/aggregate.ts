import { basename } from "node:path";
import {
  type Config,
  hostsOf,
  type Papers,
  type ResolvedPapers,
  resolvePapers,
  thresholdsFor,
  workWordsFor,
} from "./config.ts";
import {
  deriveForge,
  deriveGit,
  deriveRoadmap,
  deriveSourceCards,
  emptyRoadmap,
} from "./derivations.ts";
import { polledSourceOrder, type RawStore } from "./gather.ts";
import {
  type ForgeInput,
  fullNameOf,
  isArchived,
  type LinkResult,
  type LocalInput,
  linkRepositories,
  type Project,
} from "./link.ts";
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
  Entity,
  EntityError,
  EntitySources,
  ForgeData,
  ForgeError,
  ForgeListing,
  Snapshot,
  SourceStatus,
} from "./snapshot.ts";

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
  observed: (value: T) => D | EntityError,
  absent: (reason: R) => D | undefined,
): D | EntityError | undefined {
  if (entry === undefined) return undefined;
  if (entry.state === "error") return { error: entry.error };
  if (entry.state === "absent") return absent(entry.reason);
  return observed(entry.value);
}

/**
 * Forge repositories from the account listings, overlaid with the forge enricher's file, which adds
 * repositories found through local remotes and the details of each. A remote's repository the
 * enricher could not read is a repository carrying its error; an untracked fork is left out.
 */
function forgeRepositories(
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

/** A forge repository's data: derived when it was read, else its error and whether no card covers it. */
function forgeSource(repository: ForgeInput): ForgeData | ForgeError {
  if (repository.repo.state === "observed")
    return deriveForge(repository.repo.value);
  return {
    error: repository.repo.error,
    cause: repository.repo.reason === "no-card" ? "no-card" : "read-failed",
  };
}

function backupOf(project: Project & { local: LocalInput }): Backup {
  if (project.forges.length > 0) return "linked";
  const git = project.local.repository.git;
  return git.state === "observed" && git.value.remotes.state === "observed"
    ? "unlinked-remote"
    : "local-only";
}

function localSources(
  project: Project & { local: LocalInput },
  papers: Papers | null,
  files: Partial<RawFiles>,
  config: Config,
): EntitySources {
  const sources: EntitySources = {};
  const { id, repository } = project.local;
  const observedAt = new Date(files.local?.gatheredAt ?? 0);
  const thresholds = thresholdsFor(config, papers);
  if (repository.git.state === "error") {
    sources.git = { error: repository.git.error };
  } else if (repository.git.state === "observed") {
    sources.git = deriveGit(
      repository.git.value,
      thresholds,
      observedAt,
      backupOf(project),
    );
  }
  const bugThresholds = {
    bugs: thresholds.bugs,
    criticalBugs: thresholds.criticalBugs,
  };
  const roadmap = fromEntry(
    files.roadmap?.data[id],
    (raw) => deriveRoadmap(raw, workWordsFor(config, papers), bugThresholds),
    () => emptyRoadmap(bugThresholds),
  );
  if (roadmap !== undefined) sources.roadmap = roadmap;
  return sources;
}

/** A project's entity id: the local id when a local repository exists, else its first reference. */
function projectId(project: Project): string {
  return project.local ? project.local.id : (project.refs[0] ?? "");
}

/** The papers a project resolves to, by its id and every repository reference. */
function papersOf(project: Project, config: Config): ResolvedPapers {
  return resolvePapers(config, projectId(project), project.refs);
}

/** Links the repositories in a set of raw files into projects, with config's hosts, links and ignores. */
export function linkRawFiles(
  files: Partial<RawFiles>,
  config: Config,
): LinkResult {
  const github = hostsOf(config.sources.github);
  const forgejo = hostsOf(config.sources.forgejo);
  return linkRepositories({
    locals: Object.entries(files.local?.data.repositories ?? {}).map(
      ([id, repository]) => ({
        id,
        repository,
      }),
    ),
    forges: forgeNames.flatMap((forge) => forgeRepositories(forge, files)),
    forgeForHost: (host) =>
      github.includes(host)
        ? "github"
        : forgejo.includes(host)
          ? "forgejo"
          : null,
    links: config.links,
    ignore: config.ignore,
  });
}

/**
 * The papers each local repository resolves to through the project it links, for the gather
 * rounds that need papers before aggregation.
 */
export function localPapers(
  files: Partial<RawFiles>,
  config: Config,
): Map<string, Papers | null> {
  return new Map(
    linkRawFiles(files, config).projects.flatMap((project) =>
      project.local
        ? [[project.local.id, papersOf(project, config).papers] as const]
        : [],
    ),
  );
}

function entityFor(
  project: Project,
  papers: Papers | null,
  files: Partial<RawFiles>,
  config: Config,
): Entity {
  const local = project.local;
  const first = project.forges[0];
  const id = projectId(project);
  const sources: EntitySources = local
    ? localSources({ ...project, local }, papers, files, config)
    : {};
  for (const forge of forgeNames) {
    const repository = project.forges.find((entry) => entry.forge === forge);
    if (repository) sources[forge] = forgeSource(repository);
  }
  const flags = [...project.flags];
  const include = local
    ? files.local?.data.includes[local.repository.include]
    : undefined;
  if (
    local &&
    include?.state === "observed" &&
    include.value === "directory" &&
    papers === null
  ) {
    flags.unshift({
      flag: "not-set-up",
      level: "red",
      detail: `found under ${local.repository.include} with no papers in config`,
    });
  }
  return {
    id,
    name: local
      ? basename(local.repository.path)
      : first?.repo.state === "observed"
        ? first.repo.value.info.name
        : id,
    kind: local?.repository.obsidian.folder ? "obsidian" : "git",
    path: local ? local.repository.path : null,
    repositories: {
      local: local
        ? { ref: localRef(local.id), path: local.repository.path }
        : null,
      forges: project.forges.map((repository) => ({
        forge: repository.forge,
        ref: forgeRef(repository.forge, repository.key),
        fullName: fullNameOf(repository),
        url:
          repository.repo.state === "observed"
            ? repository.repo.value.info.url
            : null,
        sshUrl:
          repository.repo.state === "observed" &&
          repository.repo.value.info.sshUrl.state === "observed"
            ? repository.repo.value.info.sshUrl.value
            : null,
        foundBy:
          repository.repo.state === "observed"
            ? repository.repo.value.foundBy
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
 * Builds the snapshot from raw files alone: links repositories into projects, derives each
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
  const link = linkRawFiles(files, config);

  const resolved: { entity: Entity; keys: string[] }[] = link.projects.map(
    (project) => {
      const { papers, keys } = papersOf(project, config);
      return {
        entity: entityFor(project, papers, files, config),
        keys,
      };
    },
  );
  const entities = resolved.map(({ entity }) => entity);

  const conflicts: ConfigConflict[] = [...link.conflicts];
  for (const { entity, keys } of resolved) {
    if (keys.length < 2) continue;
    const assertion = keys
      .map((key) => `papers.${JSON.stringify(key)}`)
      .join(", ");
    const detail = `name one entity, ${entity.id}; papers.${JSON.stringify(keys[0])} applies`;
    conflicts.push({ assertion, detail });
    entity.flags.push({
      flag: "config-conflict",
      level: null,
      detail: `${assertion}: ${detail}`,
    });
  }
  const matched = new Set(resolved.flatMap(({ keys }) => keys));
  for (const key of Object.keys(config.entities)) {
    if (matched.has(key)) continue;
    conflicts.push({
      assertion: `papers.${JSON.stringify(key)}`,
      detail: `${key} was not observed`,
    });
  }

  const forges = {} as Record<ForgeName, ForgeListing>;
  for (const forge of forgeNames) {
    const listing: ForgeListing = { active: [], archived: [] };
    for (const repository of forgeRepositories(forge, files)) {
      if (repository.repo.state !== "observed") continue;
      const ref = forgeRef(forge, repository.key);
      const project = link.projectOf.get(ref);
      (isArchived(repository) ? listing.archived : listing.active).push({
        ref,
        fullName: repository.repo.value.info.fullName,
        url: repository.repo.value.info.url,
        entityId: project ? projectId(project) : null,
        ignored: link.ignored.has(ref),
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
    entities,
  };
}
