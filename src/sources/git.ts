import { join } from "node:path";
import { runCommand } from "../exec.ts";
import type {
  RawBranch,
  RawCommit,
  RawDirtyFile,
  RawGit,
  RawRemote,
  Tracking,
} from "../raw.ts";

export type GitRunner = (
  cwd: string,
  args: readonly string[],
) => Promise<string>;

export interface GitReadDeps {
  runGit: GitRunner;
  mtimeOf: (path: string) => Promise<Date | null>;
}

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

interface StatusSummary {
  head: RawGit["head"];
  hasCommits: boolean;
  changes: { path: string; code: string }[];
}

/** Parses `git status --porcelain=v2 --branch -z` output. */
export function parseStatus(output: string): StatusSummary {
  const records = output.split("\0");
  let oid = "";
  let headName = "";
  const changes: { path: string; code: string }[] = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index] ?? "";
    const fields = record.split(" ");
    if (record.startsWith("# branch.oid ")) {
      oid = record.slice("# branch.oid ".length);
    } else if (record.startsWith("# branch.head ")) {
      headName = record.slice("# branch.head ".length);
    } else if (record.startsWith("1 ")) {
      changes.push({ code: fields[1] ?? "", path: fields.slice(8).join(" ") });
    } else if (record.startsWith("2 ")) {
      changes.push({ code: fields[1] ?? "", path: fields.slice(9).join(" ") });
      index++;
    } else if (record.startsWith("u ")) {
      changes.push({ code: fields[1] ?? "", path: fields.slice(10).join(" ") });
    } else if (record.startsWith("? ")) {
      changes.push({ code: "??", path: record.slice(2) });
    }
  }
  return {
    head:
      headName === "(detached)"
        ? { state: "absent", reason: "detached-head", commit: oid }
        : { state: "branch", name: headName },
    hasCommits: oid !== "(initial)",
    changes,
  };
}

/** Parses for-each-ref's upstream and upstream:track,nobracket fields into a tracking state. */
export function parseTracking(upstream: string, track: string): Tracking {
  if (upstream === "") return { state: "absent", reason: "no-tracking-branch" };
  if (track === "gone")
    return { state: "absent", reason: "upstream-gone", upstream };
  const ahead = /ahead (\d+)/.exec(track)?.[1] ?? "0";
  const behind = /behind (\d+)/.exec(track)?.[1] ?? "0";
  return {
    state: "tracking",
    upstream,
    ahead: Number(ahead),
    behind: Number(behind),
  };
}

function unixToIso(unix: string): string {
  return new Date(Number(unix) * 1000).toISOString();
}

function parseCommits(output: string): RawCommit[] {
  return output
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [sha = "", unix = "0", subject = ""] = line.split("\0");
      return { sha, committedAt: unixToIso(unix), subject };
    });
}

function parseBranches(output: string): RawBranch[] {
  return output
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [
        name = "",
        sha = "",
        unix = "0",
        upstream = "",
        track = "",
        subject = "",
      ] = line.split("\0");
      return {
        name,
        lastCommit: { sha, committedAt: unixToIso(unix), subject },
        tracking: parseTracking(upstream, track),
      };
    });
}

/** Parses `git remote -v`, which prints one fetch line and one line per push URL per remote. */
export function parseRemotes(output: string): RawRemote[] {
  const remotes = new Map<string, RawRemote>();
  for (const line of output.split("\n")) {
    const match = /^(\S+)\t(\S+) \((fetch|push)\)$/.exec(line);
    if (!match) continue;
    const [, name = "", url = "", kind] = match;
    const remote = remotes.get(name) ?? { name, fetchUrl: "", pushUrls: [] };
    if (kind === "fetch") remote.fetchUrl = url;
    else remote.pushUrls.push(url);
    remotes.set(name, remote);
  }
  return [...remotes.values()];
}

const commitFormat = "--format=%H%x00%ct%x00%s";

/** Reads one repository's working-copy facts without changing it. */
export async function readRepository(
  path: string,
  deps: GitReadDeps,
): Promise<RawGit> {
  const git = (args: readonly string[]) => deps.runGit(path, args);
  const [
    statusOutput,
    branchOutput,
    remoteOutput,
    originHeadOutput,
    unpushedOutput,
  ] = await Promise.all([
    git(["status", "--porcelain=v2", "--branch", "-z"]),
    git([
      "for-each-ref",
      "--sort=-committerdate",
      "--format=%(refname:short)%00%(objectname)%00%(committerdate:unix)%00%(upstream:short)%00%(upstream:track,nobracket)%00%(subject)",
      "refs/heads",
    ]),
    git(["remote", "-v"]),
    git([
      "for-each-ref",
      "--format=%(symref:lstrip=3)",
      "refs/remotes/origin/HEAD",
    ]),
    git(["log", "--branches", "--not", "--remotes", commitFormat]),
  ]);
  const status = parseStatus(statusOutput);
  const remotes = parseRemotes(remoteOutput);
  const originHead = originHeadOutput.trim();

  const [lastCommitOutput, dirtyFiles] = await Promise.all([
    status.hasCommits ? git(["log", "-1", commitFormat]) : "",
    Promise.all(
      status.changes.map(async (change): Promise<RawDirtyFile> => {
        const mtime = await deps.mtimeOf(join(path, change.path));
        return {
          ...change,
          mtime:
            mtime === null
              ? { state: "absent", reason: "file-deleted" }
              : { state: "observed", value: mtime.toISOString() },
        };
      }),
    ),
  ]);
  const lastCommit = parseCommits(lastCommitOutput)[0];

  return {
    head: status.head,
    lastCommit:
      lastCommit === undefined
        ? { state: "absent", reason: "no-commits" }
        : { state: "observed", value: lastCommit },
    dirtyFiles,
    branches: parseBranches(branchOutput),
    remotes:
      remotes.length === 0
        ? { state: "absent", reason: "no-remote" }
        : { state: "observed", value: remotes },
    originHead:
      originHead === ""
        ? { state: "absent", reason: "no-origin-head" }
        : { state: "observed", value: originHead },
    unpushedCommits: parseCommits(unpushedOutput),
  };
}
