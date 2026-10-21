import { SourceFailure } from "../failure.ts";
import { errorMessage } from "../fs.ts";
import type { FetchJson } from "../http.ts";
import { asArray, asRecord, optionalString, stringField } from "../json.ts";
import type {
  Observed,
  RawEntries,
  RawForgeRemote,
  RawGithub,
  RawGithubRun,
} from "../raw.ts";
import { forgeRemoteFor } from "../remote-url.ts";
import { readPullRequest } from "./pull-request.ts";
import type { PolledSource } from "./source.ts";

const apiBase = "https://api.github.com";

export interface GithubSourceDeps {
  fetchJson: FetchJson;
  tokenFor: (account: string) => Promise<string>;
  /** The gh account whose token reads each remote host, such as github-work to the-undev. */
  hostAccounts: Readonly<Record<string, string>>;
}

function latestRun(
  value: unknown,
): Observed<RawGithubRun, "no-runs-on-default-branch"> {
  const runs = asArray(asRecord(value, "runs").workflow_runs, "workflow_runs");
  if (runs.length === 0) {
    return { state: "absent", reason: "no-runs-on-default-branch" };
  }
  const run = asRecord(runs[0], "workflow run");
  const conclusion = optionalString(run, "conclusion");
  return {
    state: "observed",
    value: {
      name: stringField(run, "name"),
      status: stringField(run, "status"),
      conclusion:
        conclusion === null
          ? { state: "absent", reason: "run-not-completed" }
          : { state: "observed", value: conclusion },
      url: stringField(run, "html_url"),
      createdAt: stringField(run, "created_at"),
    },
  };
}

async function readRepository(
  remote: RawForgeRemote,
  account: string,
  token: string,
  fetchJson: FetchJson,
): Promise<RawGithub> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "perch",
  };
  const base = `${apiBase}/repos/${remote.owner}/${remote.repo}`;
  const repository = asRecord(await fetchJson(base, headers), "repository");
  const defaultBranch = stringField(repository, "default_branch");
  const [pulls, runs] = await Promise.all([
    fetchJson(`${base}/pulls?state=open&per_page=100`, headers),
    fetchJson(
      `${base}/actions/runs?branch=${encodeURIComponent(defaultBranch)}&per_page=1`,
      headers,
    ),
  ]);
  return {
    remote,
    account,
    defaultBranch,
    openPullRequests: asArray(pulls, "pulls").map(readPullRequest),
    latestRun: latestRun(runs),
  };
}

/** Reads open pull requests and the latest default-branch run for repositories on GitHub. */
export function createGithubSource(
  deps: GithubSourceDeps,
): PolledSource<"github"> {
  return {
    name: "github",
    async gather(items, earlier) {
      const git = earlier.git;
      if (git === undefined) {
        throw new SourceFailure("unexpected", "no git data to find remotes in");
      }
      const tokens = new Map<string, Promise<string>>();
      const tokenFor = (account: string): Promise<string> => {
        const cached = tokens.get(account) ?? deps.tokenFor(account);
        tokens.set(account, cached);
        return cached;
      };
      const hosts = Object.keys(deps.hostAccounts);
      const entries: Record<string, RawEntries["github"]> = {};
      await Promise.all(
        items.map(async (item) => {
          if (item.kind === "server") return;
          const lookup = forgeRemoteFor(git.items[item.id], hosts);
          if (lookup.state === "no-git-data") {
            entries[item.id] = {
              state: "error",
              error: "no git data for this item",
            };
            return;
          }
          if (lookup.state === "no-remote") {
            entries[item.id] = { state: "absent", reason: "no-github-remote" };
            return;
          }
          try {
            const account = deps.hostAccounts[lookup.remote.host] ?? "";
            const token = await tokenFor(account);
            entries[item.id] = {
              state: "observed",
              value: await readRepository(
                lookup.remote,
                account,
                token,
                deps.fetchJson,
              ),
            };
          } catch (error) {
            entries[item.id] = { state: "error", error: errorMessage(error) };
          }
        }),
      );
      return entries;
    },
  };
}
