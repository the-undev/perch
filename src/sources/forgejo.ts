import { SourceFailure } from "../failure.ts";
import { errorMessage } from "../fs.ts";
import type { FetchJson } from "../http.ts";
import { asArray, asRecord, optionalString, stringField } from "../json.ts";
import type {
  RawCommitStatus,
  RawEntries,
  RawForgejo,
  RawForgeRemote,
} from "../raw.ts";
import { forgeRemoteFor } from "../remote-url.ts";
import { readPullRequest } from "./pull-request.ts";
import type { PolledSource } from "./source.ts";

export interface ForgejoSourceDeps {
  fetchJson: FetchJson;
  /** Resolves with the read-only API token, or rejects with a token-not-stored SourceFailure. */
  token: () => Promise<string>;
  baseUrl: string;
  remoteHosts: readonly string[];
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

async function readRepository(
  remote: RawForgeRemote,
  token: string,
  deps: ForgejoSourceDeps,
): Promise<RawForgejo> {
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/json",
  };
  const base = `${deps.baseUrl}/api/v1/repos/${remote.owner}/${remote.repo}`;
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
  const combined = asRecord(status, "combined status");
  return {
    remote,
    defaultBranch,
    openPullRequests: asArray(pulls, "pulls").map(readPullRequest),
    combinedStatus: {
      state: typeof combined.state === "string" ? combined.state : "",
      statuses: asArray(combined.statuses, "statuses").map(readCommitStatus),
    },
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
    async gather(items, earlier) {
      const git = earlier.git;
      if (git === undefined) {
        throw new SourceFailure("unexpected", "no git data to find remotes in");
      }
      const entries: Record<string, RawEntries["forgejo"]> = {};
      const targets: { id: string; remote: RawForgeRemote }[] = [];
      for (const item of items) {
        if (item.kind === "server") continue;
        const lookup = forgeRemoteFor(git.items[item.id], deps.remoteHosts);
        if (lookup.state === "no-git-data") {
          entries[item.id] = {
            state: "error",
            error: "no git data for this item",
          };
        } else if (lookup.state === "no-remote") {
          entries[item.id] = { state: "absent", reason: "no-forgejo-remote" };
        } else {
          targets.push({ id: item.id, remote: lookup.remote });
        }
      }
      if (targets.length === 0) return entries;
      const token = await deps.token();
      await Promise.all(
        targets.map(async ({ id, remote }) => {
          try {
            entries[id] = {
              state: "observed",
              value: await readRepository(remote, token, deps),
            };
          } catch (error) {
            entries[id] = { state: "error", error: errorMessage(error) };
          }
        }),
      );
      return entries;
    },
  };
}
