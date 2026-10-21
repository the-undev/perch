import { errorMessage } from "../fs.ts";
import type { FetchJson } from "../http.ts";
import { asArray, asRecord, optionalString, stringField } from "../json.ts";
import { forgeTargets, type RemoteLocation } from "../remote-url.ts";
import type { CiRun, CiState, ForgeData, ItemError } from "../snapshot.ts";
import { readPullRequest } from "./pull-request.ts";
import type { PolledSource } from "./source.ts";

export interface ForgejoSourceDeps {
  fetchJson: FetchJson;
  /** Resolves with the read-only API token, or rejects when it is not available. */
  token: () => Promise<string>;
  baseUrl: string;
  remoteHosts: readonly string[];
}

/** Maps a Forgejo combined commit status to perch's CI state. */
export function forgejoCiState(state: string): CiState {
  if (state === "success") return "success";
  if (state === "failure" || state === "error") return "failure";
  if (state === "pending") return "pending";
  return "neutral";
}

/** The combined status of a commit, named after its newest individual status. */
function combinedStatus(value: unknown): CiRun | null {
  const combined = asRecord(value, "combined status");
  const statuses = asArray(combined.statuses, "statuses").map((status) =>
    asRecord(status, "status"),
  );
  const newest = statuses
    .slice()
    .sort((a, b) =>
      (optionalString(b, "created_at") ?? "").localeCompare(
        optionalString(a, "created_at") ?? "",
      ),
    )[0];
  if (newest === undefined) return null;
  const state = stringField(combined, "state");
  return {
    name: optionalString(newest, "context") ?? "status",
    state: forgejoCiState(state),
    forgeState: state,
    url: optionalString(newest, "target_url"),
    createdAt: optionalString(newest, "created_at"),
  };
}

async function readRepository(
  location: RemoteLocation,
  token: string,
  deps: ForgejoSourceDeps,
): Promise<ForgeData> {
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/json",
  };
  const base = `${deps.baseUrl}/api/v1/repos/${location.owner}/${location.repo}`;
  const repository = asRecord(
    await deps.fetchJson(base, headers),
    "repository",
  );
  const defaultBranch = stringField(repository, "default_branch");
  const [pulls, status] = await Promise.all([
    deps.fetchJson(`${base}/pulls?state=open&limit=50`, headers),
    deps.fetchJson(
      `${base}/commits/${encodeURIComponent(defaultBranch)}/status`,
      headers,
    ),
  ]);
  return {
    host: location.host,
    owner: location.owner,
    repo: location.repo,
    defaultBranch,
    openPullRequests: asArray(pulls, "pulls").map(readPullRequest),
    latestCi: combinedStatus(status),
  };
}

/**
 * Reads open pull requests and the default branch's commit status for repositories on Forgejo.
 * A missing token fails the whole source; a failure for one repository is recorded against it.
 */
export function createForgejoSource(
  deps: ForgejoSourceDeps,
): PolledSource<"forgejo"> {
  return {
    name: "forgejo",
    async scan(items) {
      const results = new Map<string, ForgeData | ItemError>();
      const targets = forgeTargets(items, deps.remoteHosts);
      if (targets.length === 0) return results;
      const token = await deps.token();
      await Promise.all(
        targets.map(async ({ itemId, location }) => {
          try {
            results.set(itemId, await readRepository(location, token, deps));
          } catch (error) {
            results.set(itemId, { error: errorMessage(error) });
          }
        }),
      );
      return results;
    },
  };
}
