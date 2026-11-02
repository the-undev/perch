// Builders for raw-shaped data, for aggregation tests that never touch the machine.

import { polledSourceOrder } from "../../src/gather.ts";
import type {
  ForgeName,
  RawCi,
  RawCommit,
  RawFiles,
  RawForgeDetails,
  RawForgeRepo,
  RawGit,
  RawLocalPresence,
  RawPullRequest,
  RawRemote,
  SourceStatus,
  StatusFile,
} from "../../src/raw.ts";

export const gatheredAt = "2026-10-21T09:00:00.000Z";

export function rawGit(overrides: Partial<RawGit>): RawGit {
  return {
    head: { state: "branch", name: "main" },
    lastCommit: {
      state: "observed",
      value: {
        sha: "a",
        committedAt: "2026-10-01T09:00:00.000Z",
        subject: "First",
      },
    },
    dirtyFiles: [],
    branches: [],
    remotes: { state: "absent", reason: "no-remote" },
    originHead: { state: "absent", reason: "no-origin-head" },
    unpushedCommits: [],
    defaultBranchCommits: { state: "absent", reason: "no-default-branch" },
    ...overrides,
  };
}

/** Remotes from a fetch URL and, for a dual-push remote, its push URLs. */
export function withRemotes(
  remotes: { name: string; url: string; pushUrls?: string[] }[],
): Pick<RawGit, "remotes"> {
  return {
    remotes:
      remotes.length === 0
        ? { state: "absent", reason: "no-remote" }
        : {
            state: "observed",
            value: remotes.map(
              (remote): RawRemote => ({
                name: remote.name,
                fetchUrl: remote.url,
                pushUrls: remote.pushUrls ?? [remote.url],
              }),
            ),
          },
  };
}

export function localPresence(
  path: string,
  options: { include: string; git?: Partial<RawGit>; obsidian?: boolean },
): RawLocalPresence {
  return {
    path,
    include: options.include,
    obsidian: { folder: options.obsidian ?? false, livesyncPlugin: false },
    git: { state: "observed", value: rawGit(options.git ?? {}) },
  };
}

export function forgeRepo(
  fullName: string,
  options: Partial<Pick<RawForgeRepo, "foundBy" | "aliases">> & {
    archived?: boolean;
  },
): RawForgeRepo {
  const [owner = "", name = ""] = fullName.split("/");
  return {
    info: {
      fullName,
      owner,
      name,
      defaultBranch: "main",
      archived: options.archived ?? false,
      fork: false,
      private: false,
      url: `https://example.invalid/${fullName}`,
    },
    foundBy: options.foundBy ?? "account-listing",
    account: owner,
    aliases: options.aliases ?? [],
    details: options.archived
      ? { state: "absent", reason: "archived-slow-lane" }
      : { state: "observed", value: forgeDetails({}) },
  };
}

/** A repository's detail with every part observed: no pull requests, no runs, no commits unless given. */
export function forgeDetails(values: {
  openPullRequests?: RawPullRequest[];
  ci?: RawCi;
  finalisedCommits?: RawCommit[];
}): RawForgeDetails {
  return {
    openPullRequests: {
      state: "observed",
      value: values.openPullRequests ?? [],
    },
    ci: {
      state: "observed",
      value: values.ci ?? {
        forge: "github",
        latestRun: { state: "absent", reason: "no-runs-on-default-branch" },
      },
    },
    finalisedCommits: {
      state: "observed",
      value: values.finalisedCommits ?? [],
    },
  };
}

/** Raw files holding local presences and forge repositories, keyed as the sources key them. */
export function rawFiles(input: {
  includes: Record<string, "repo" | "directory">;
  locals: Record<string, RawLocalPresence>;
  forges: Partial<Record<ForgeName, RawForgeRepo[]>>;
}): Partial<RawFiles> {
  const files: Partial<RawFiles> = {
    local: {
      source: "local",
      gatheredAt,
      data: {
        includes: Object.fromEntries(
          Object.entries(input.includes).map(([path, kind]) => [
            path,
            { state: "observed", value: kind },
          ]),
        ),
        presences: input.locals,
      },
    },
  };
  for (const forge of ["github", "forgejo"] as const) {
    const repos = input.forges[forge];
    if (repos === undefined) continue;
    Object.assign(files, {
      [forge]: {
        source: forge,
        gatheredAt,
        data: Object.fromEntries(
          repos.map((repo) => [
            `${repo.info.owner}/${repo.info.name}`.toLowerCase(),
            { state: "observed", value: repo },
          ]),
        ),
      },
    });
  }
  return files;
}

/** A status file in which every source succeeded, with any overrides applied. */
export function okStatus(
  overrides: Partial<StatusFile["sources"]>,
): StatusFile {
  const ok: SourceStatus = {
    state: "ok",
    lastSucceededAt: gatheredAt,
    durationMs: 5,
  };
  const sources = Object.fromEntries(
    polledSourceOrder.map((name) => [name, overrides[name] ?? ok]),
  ) as StatusFile["sources"];
  return { gatheredAt, durationMs: 1234, sources };
}
