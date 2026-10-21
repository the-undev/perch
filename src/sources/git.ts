import { stat } from "node:fs/promises";
import { join } from "node:path";
import { mapWithLimit, runCommand } from "../exec.ts";
import { errorMessage, nullIfMissing } from "../fs.ts";
import type {
  ActivityState,
  Drift,
  DriftThresholds,
  GitData,
  HealthLevel,
  ItemError,
  LocalBranch,
  Remote,
} from "../snapshot.ts";
import type { PolledSource } from "./source.ts";

export type GitRunner = (
  cwd: string,
  args: readonly string[],
) => Promise<string>;

export interface GitSourceDeps {
  runGit: GitRunner;
  mtimeOf: (path: string) => Promise<Date | null>;
  now: () => Date;
  thresholdsFor: (itemId: string) => DriftThresholds;
  concurrency: number;
}

const dayMs = 24 * 60 * 60 * 1000;

/** Runs git without optional locks, so status never rewrites the index, and never prompts. */
export function createGitRunner(baseEnv: NodeJS.ProcessEnv): GitRunner {
  const env = {
    ...baseEnv,
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
  };
  return (cwd, args) => runCommand("git", args, { cwd, env });
}

/** The modification time of a path, or null when it no longer exists. */
export async function fileMtime(path: string): Promise<Date | null> {
  const stats = await nullIfMissing(() => stat(path));
  return stats?.mtime ?? null;
}

interface StatusSummary {
  branch: string | null;
  hasCommits: boolean;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  changedPaths: string[];
}

/** Parses `git status --porcelain=v2 --branch -z` output. */
export function parseStatus(output: string): StatusSummary {
  const records = output.split("\0");
  const summary: StatusSummary = {
    branch: null,
    hasCommits: true,
    upstream: null,
    ahead: null,
    behind: null,
    changedPaths: [],
  };
  for (let index = 0; index < records.length; index++) {
    const record = records[index] ?? "";
    if (record.startsWith("# branch.oid ")) {
      summary.hasCommits = record !== "# branch.oid (initial)";
    } else if (record.startsWith("# branch.head ")) {
      const head = record.slice("# branch.head ".length);
      summary.branch = head === "(detached)" ? null : head;
    } else if (record.startsWith("# branch.upstream ")) {
      summary.upstream = record.slice("# branch.upstream ".length);
    } else if (record.startsWith("# branch.ab ")) {
      const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(record);
      summary.ahead = Number(match?.[1]);
      summary.behind = Number(match?.[2]);
    } else if (record.startsWith("1 ")) {
      summary.changedPaths.push(record.split(" ").slice(8).join(" "));
    } else if (record.startsWith("2 ")) {
      summary.changedPaths.push(record.split(" ").slice(9).join(" "));
      index++;
    } else if (record.startsWith("u ")) {
      summary.changedPaths.push(record.split(" ").slice(10).join(" "));
    } else if (record.startsWith("? ")) {
      summary.changedPaths.push(record.slice(2));
    }
  }
  return summary;
}

function parseBranches(output: string): LocalBranch[] {
  return output
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [name = "", unix = "0", upstream = "", subject = ""] =
        line.split("\0");
      return {
        name,
        lastCommitAt: new Date(Number(unix) * 1000).toISOString(),
        subject,
        upstream: upstream === "" ? null : upstream,
      };
    });
}

function parseRemotes(output: string): Remote[] {
  const remotes: Remote[] = [];
  for (const line of output.split("\n")) {
    const match = /^(\S+)\t(\S+) \(fetch\)$/.exec(line);
    if (match) remotes.push({ name: match[1] ?? "", url: match[2] ?? "" });
  }
  return remotes;
}

function oldest(dates: readonly (Date | null)[]): Date | null {
  const times = dates
    .filter((date): date is Date => date !== null)
    .map((date) => date.getTime());
  return times.length === 0 ? null : new Date(Math.min(...times));
}

/** The default branch: the remote's HEAD when origin records one, else main or master if present. */
export function chooseDefaultBranch(
  originHead: string | null,
  branchNames: readonly string[],
): string | null {
  if (originHead !== null) return originHead;
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
 * The git work-state: editing with uncommitted changes, in progress with unpushed commits or any
 * branch other than the default, settled when everything is on the default branch and pushed.
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

function ageInDays(since: Date | null, now: Date): number | null {
  if (since === null) return null;
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / dayMs));
}

function levelFor(
  driftDays: number | null,
  thresholds: DriftThresholds,
): HealthLevel {
  if (driftDays === null) return "green";
  if (driftDays >= thresholds.redDays) return "red";
  if (driftDays >= thresholds.amberDays) return "amber";
  return "green";
}

/** Health input from drift: the age of the oldest uncommitted or unpushed work against thresholds. */
export function deriveDrift(
  ages: { oldestUncommittedAt: Date | null; oldestUnpushedAt: Date | null },
  thresholds: DriftThresholds,
  now: Date,
): Drift {
  const uncommittedDays = ageInDays(ages.oldestUncommittedAt, now);
  const unpushedDays = ageInDays(ages.oldestUnpushedAt, now);
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

/** Reads one repository's working-copy state without changing it. */
export async function scanRepository(
  path: string,
  thresholds: DriftThresholds,
  deps: Pick<GitSourceDeps, "runGit" | "mtimeOf" | "now">,
): Promise<GitData> {
  const git = (args: readonly string[]) => deps.runGit(path, args);
  const [statusOutput, branchOutput, remoteOutput, originHeadOutput] =
    await Promise.all([
      git(["status", "--porcelain=v2", "--branch", "-z"]),
      git([
        "for-each-ref",
        "--sort=-committerdate",
        "--format=%(refname:short)%00%(committerdate:unix)%00%(upstream:short)%00%(subject)",
        "refs/heads",
      ]),
      git(["remote", "-v"]),
      git([
        "for-each-ref",
        "--format=%(symref:lstrip=3)",
        "refs/remotes/origin/HEAD",
      ]),
    ]);
  const status = parseStatus(statusOutput);
  const branches = parseBranches(branchOutput);
  const remotes = parseRemotes(remoteOutput);

  const [lastCommitOutput, unpushedOutput, dirtyMtimes] = await Promise.all([
    status.hasCommits ? git(["log", "-1", "--format=%ct"]) : "",
    git(["log", "--branches", "--not", "--remotes", "--format=%ct"]),
    Promise.all(
      status.changedPaths.map((changed) => deps.mtimeOf(join(path, changed))),
    ),
  ]);
  const unpushedTimes = unpushedOutput
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => new Date(Number(line) * 1000));

  const branchNames = branches.map((branch) => branch.name);
  const originHead = originHeadOutput.trim();
  const defaultBranch = chooseDefaultBranch(
    originHead === "" ? null : originHead,
    branchNames,
  );
  const oldestUncommittedAt = oldest(dirtyMtimes);
  const oldestUnpushedAt = oldest(unpushedTimes);
  const lastCommit = lastCommitOutput.trim();

  return {
    branch: status.branch,
    defaultBranch,
    upstream: status.upstream,
    uncommittedCount: status.changedPaths.length,
    ahead: status.ahead,
    behind: status.behind,
    unpushedCount: unpushedTimes.length,
    lastCommitAt:
      lastCommit === ""
        ? null
        : new Date(Number(lastCommit) * 1000).toISOString(),
    oldestUncommittedAt: oldestUncommittedAt?.toISOString() ?? null,
    oldestUnpushedAt: oldestUnpushedAt?.toISOString() ?? null,
    branches,
    remotes,
    activity: deriveActivity({
      uncommittedCount: status.changedPaths.length,
      unpushedCount: unpushedTimes.length,
      branch: status.branch,
      defaultBranch,
      branchNames,
    }),
    drift: deriveDrift(
      { oldestUncommittedAt, oldestUnpushedAt },
      thresholds,
      deps.now(),
    ),
  };
}

/** Reads git state for every repository and vault item. */
export function createGitSource(deps: GitSourceDeps): PolledSource<"git"> {
  return {
    name: "git",
    async scan(items) {
      const results = new Map<string, GitData | ItemError>();
      const withPaths = items.flatMap((item) =>
        item.path === null ? [] : [{ id: item.id, path: item.path }],
      );
      await mapWithLimit(withPaths, deps.concurrency, async ({ id, path }) => {
        try {
          results.set(
            id,
            await scanRepository(path, deps.thresholdsFor(id), deps),
          );
        } catch (error) {
          results.set(id, { error: errorMessage(error) });
        }
      });
      return results;
    },
  };
}
