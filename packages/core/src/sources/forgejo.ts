import type { FetchJson } from "../http.ts";
import { asArray, asRecord, optionalString, stringField } from "../json.ts";
import type { RawCommitStatus } from "../raw.ts";
import type { ForgeClient } from "./forge.ts";
import { readAllPages, readRepoInfo } from "./github.ts";
import { readCommit, readPullRequest } from "./pull-request.ts";

const pageSize = 50;

export interface ForgejoClientDeps {
  fetchJson: FetchJson;
  baseUrl: string;
  /** How many default-branch commits to read as finalised. */
  finalisedCommits: number;
}

function readCommitStatus(value: unknown): RawCommitStatus {
  const record = asRecord(value, "status");
  const targetUrl = optionalString(record, "target_url");
  return {
    context: stringField(record, "context"),
    status: stringField(record, "status"),
    targetUrl:
      targetUrl === null
        ? { state: "absent", reason: "no-target-url" }
        : { state: "observed", value: targetUrl },
    createdAt: stringField(record, "created_at"),
  };
}

/**
 * Forgejo over its v1 API, with read-only tokens sent as token. Its CI is the default branch's combined
 * commit status, since its Actions API cannot filter runs by branch.
 */
export function createForgejoClient(deps: ForgejoClientDeps): ForgeClient {
  const api = `${deps.baseUrl}/api/v1`;
  const headers = (token: string) => ({
    Authorization: `token ${token}`,
    Accept: "application/json",
  });
  return {
    forge: "forgejo",
    async listRepos(token) {
      const auth = headers(token);
      const repos = await readAllPages(
        (page) => `${api}/user/repos?limit=${pageSize}&page=${page}`,
        pageSize,
        (url) => deps.fetchJson(url, auth),
      );
      return repos.map(readRepoInfo);
    },
    async getRepo(owner, name, token) {
      return readRepoInfo(
        await deps.fetchJson(`${api}/repos/${owner}/${name}`, headers(token)),
      );
    },
    async readDetails(info, token) {
      const auth = headers(token);
      const base = `${api}/repos/${info.fullName}`;
      const branch = encodeURIComponent(info.defaultBranch);
      const [pulls, status, commits] = await Promise.all([
        deps.fetchJson(`${base}/pulls?state=open&limit=50`, auth),
        deps.fetchJson(`${base}/commits/${branch}/status`, auth),
        deps.fetchJson(
          `${base}/commits?sha=${branch}&limit=${deps.finalisedCommits}&stat=false&verification=false&files=false`,
          auth,
        ),
      ]);
      const combined = asRecord(status, "combined status");
      return {
        openPullRequests: asArray(pulls, "pulls").map(readPullRequest),
        ci: {
          forge: "forgejo",
          combinedStatus: {
            state: typeof combined.state === "string" ? combined.state : "",
            // Forgejo sends null, not an empty list, for a commit with no statuses.
            statuses: asArray(combined.statuses ?? [], "statuses").map(
              readCommitStatus,
            ),
          },
        },
        finalisedCommits: asArray(commits, "commits").map(readCommit),
      };
    },
  };
}
