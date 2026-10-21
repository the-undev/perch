import { errorMessage } from "../fs.ts";
import type { FetchJson } from "../http.ts";
import { asArray, asRecord, optionalString, stringField } from "../json.ts";
import { forgeTargets, type RemoteLocation } from "../remote-url.ts";
import type { CiRun, CiState, ForgeData, ItemError } from "../snapshot.ts";
import { readPullRequest } from "./pull-request.ts";
import type { PolledSource } from "./source.ts";

const apiBase = "https://api.github.com";

export interface GithubSourceDeps {
  fetchJson: FetchJson;
  tokenFor: (account: string) => Promise<string>;
  /** The gh account whose token reads each remote host, such as github-work to the-undev. */
  hostAccounts: Readonly<Record<string, string>>;
}

/** Maps a GitHub Actions run's status and conclusion to perch's CI state. */
export function githubCiState(
  status: string,
  conclusion: string | null,
): CiState {
  if (status !== "completed") return "pending";
  if (conclusion === "success") return "success";
  if (
    conclusion === "failure" ||
    conclusion === "timed_out" ||
    conclusion === "startup_failure" ||
    conclusion === "action_required"
  ) {
    return "failure";
  }
  return "neutral";
}

function latestRun(value: unknown): CiRun | null {
  const runs = asArray(asRecord(value, "runs").workflow_runs, "workflow_runs");
  if (runs.length === 0) return null;
  const run = asRecord(runs[0], "workflow run");
  const status = stringField(run, "status");
  const conclusion = optionalString(run, "conclusion");
  return {
    name: optionalString(run, "name") ?? "workflow",
    state: githubCiState(status, conclusion),
    forgeState: conclusion === null ? status : `${status}/${conclusion}`,
    url: optionalString(run, "html_url"),
    createdAt: optionalString(run, "created_at"),
  };
}

async function readRepository(
  location: RemoteLocation,
  token: string,
  fetchJson: FetchJson,
): Promise<ForgeData> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "perch",
  };
  const base = `${apiBase}/repos/${location.owner}/${location.repo}`;
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
    host: location.host,
    owner: location.owner,
    repo: location.repo,
    defaultBranch,
    openPullRequests: asArray(pulls, "pulls").map(readPullRequest),
    latestCi: latestRun(runs),
  };
}

/** Reads open pull requests and the latest default-branch CI run for repositories on GitHub. */
export function createGithubSource(
  deps: GithubSourceDeps,
): PolledSource<"github"> {
  return {
    name: "github",
    async scan(items) {
      const results = new Map<string, ForgeData | ItemError>();
      const tokens = new Map<string, Promise<string>>();
      const tokenFor = (account: string): Promise<string> => {
        const cached = tokens.get(account) ?? deps.tokenFor(account);
        tokens.set(account, cached);
        return cached;
      };
      const targets = forgeTargets(items, Object.keys(deps.hostAccounts));
      await Promise.all(
        targets.map(async ({ itemId, location }) => {
          try {
            const account = deps.hostAccounts[location.host] ?? "";
            const token = await tokenFor(account);
            results.set(
              itemId,
              await readRepository(location, token, deps.fetchJson),
            );
          } catch (error) {
            results.set(itemId, { error: errorMessage(error) });
          }
        }),
      );
      return results;
    },
  };
}
