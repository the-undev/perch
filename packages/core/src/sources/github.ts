import type { FetchJson } from "../http.ts";
import {
  asArray,
  asRecord,
  type JsonRecord,
  optionalString,
  stringField,
} from "../json.ts";
import type {
  Observed,
  RawCi,
  RawForgeRepoInfo,
  RawGithubRun,
} from "../raw.ts";
import { type ForgeClient, readFacet } from "./forge.ts";
import { readCommit, readPullRequest } from "./pull-request.ts";

const apiBase = "https://api.github.com";
const pageSize = 100;
const maxPages = 20;

export interface GithubClientDeps {
  fetchJson: FetchJson;
  /** How many default-branch commits to read as finalised. */
  finalisedCommits: number;
}

/** Reads a repository from a GitHub or Forgejo response, which share these fields. */
export function readRepoInfo(value: unknown): RawForgeRepoInfo {
  const record = asRecord(value, "repository");
  const owner = asRecord(record.owner, "owner") as JsonRecord;
  return {
    fullName: stringField(record, "full_name"),
    owner: stringField(owner, "login"),
    name: stringField(record, "name"),
    defaultBranch: stringField(record, "default_branch"),
    archived: record.archived === true,
    fork: record.fork === true,
    private: record.private === true,
    url: stringField(record, "html_url"),
  };
}

/** Reads every page of a list endpoint whose page size and page number are query parameters. */
export async function readAllPages(
  pageUrl: (page: number) => string,
  size: number,
  fetchPage: (url: string) => Promise<unknown>,
): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const entries = asArray(await fetchPage(pageUrl(page)), "page");
    all.push(...entries);
    if (entries.length < size) break;
  }
  return all;
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

/** GitHub over its REST API, with fine-grained read-only tokens sent as Bearer. */
export function createGithubClient(deps: GithubClientDeps): ForgeClient {
  const headersFor = (token: string) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "perch",
  });
  return {
    forge: "github",
    async listRepos(token) {
      const headers = headersFor(token);
      const repos = await readAllPages(
        (page) => `${apiBase}/user/repos?per_page=${pageSize}&page=${page}`,
        pageSize,
        (url) => deps.fetchJson(url, headers),
      );
      return repos.map(readRepoInfo);
    },
    async getRepo(owner, name, token) {
      const headers = headersFor(token);
      return readRepoInfo(
        await deps.fetchJson(`${apiBase}/repos/${owner}/${name}`, headers),
      );
    },
    async readDetails(info, token) {
      const headers = headersFor(token);
      const base = `${apiBase}/repos/${info.fullName}`;
      const branch = encodeURIComponent(info.defaultBranch);
      const [openPullRequests, ci, finalisedCommits] = await Promise.all([
        readFacet(async () =>
          asArray(
            await deps.fetchJson(
              `${base}/pulls?state=open&per_page=100`,
              headers,
            ),
            "pulls",
          ).map(readPullRequest),
        ),
        readFacet(
          async (): Promise<RawCi> => ({
            forge: "github",
            latestRun: latestRun(
              await deps.fetchJson(
                `${base}/actions/runs?branch=${branch}&per_page=1`,
                headers,
              ),
            ),
          }),
        ),
        readFacet(async () =>
          asArray(
            await deps.fetchJson(
              `${base}/commits?sha=${branch}&per_page=${deps.finalisedCommits}`,
              headers,
            ),
            "commits",
          ).map(readCommit),
        ),
      ]);
      return { openPullRequests, ci, finalisedCommits };
    },
  };
}
