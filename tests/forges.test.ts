import { describe, expect, it } from "vitest";
import {
  deriveForgejo,
  deriveGithub,
  githubCiState,
} from "../src/derivations.ts";
import { SourceFailure } from "../src/failure.ts";
import type { FetchJson } from "../src/http.ts";
import type {
  DiscoveredItem,
  RawEntries,
  RawFiles,
  RawGithub,
  RawRemote,
} from "../src/raw.ts";
import { parseRemoteUrl } from "../src/remote-url.ts";
import { forgejoTokenMissing } from "../src/secrets.ts";
import { createForgejoSource } from "../src/sources/forgejo.ts";
import { createGithubSource } from "../src/sources/github.ts";

function repo(id: string): DiscoveredItem {
  return { id, name: id, kind: "repo", path: `/work/${id}` };
}

/** Git raw data holding only the remotes, which is all the forge sources read. */
function earlierGit(remotes: Record<string, RawRemote[]>): Partial<RawFiles> {
  const items: Record<string, RawEntries["git"]> = {};
  for (const [id, list] of Object.entries(remotes)) {
    items[id] = {
      state: "observed",
      value: {
        head: { state: "branch", name: "main" },
        lastCommit: { state: "absent", reason: "no-commits" },
        dirtyFiles: [],
        branches: [],
        remotes:
          list.length === 0
            ? { state: "absent", reason: "no-remote" }
            : { state: "observed", value: list },
        originHead: { state: "absent", reason: "no-origin-head" },
        unpushedCommits: [],
      },
    };
  }
  return {
    git: { source: "git", gatheredAt: "2026-10-21T08:00:00.000Z", items },
  };
}

function fakeFetch(responses: Record<string, unknown>): {
  fetchJson: FetchJson;
  calls: { url: string; headers: Record<string, string> }[];
} {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  return {
    calls,
    fetchJson: async (url, headers) => {
      calls.push({ url, headers });
      if (!(url in responses)) throw new Error(`HTTP 404 from ${url}`);
      return responses[url];
    },
  };
}

describe("parseRemoteUrl", () => {
  it.each([
    [
      "https://github.com/finch/mixed-bag.git",
      "github.com",
      "finch",
      "mixed-bag",
    ],
    ["git@github.com:finch/perch.git", "github.com", "finch", "perch"],
    [
      "git@github-work:skiff-app/skiff.git",
      "github-work",
      "skiff-app",
      "skiff",
    ],
    [
      "ssh://git@forgejo:2222/finch/Hothouse.git",
      "forgejo",
      "finch",
      "Hothouse",
    ],
    ["forge-work:the-undev/spool.git", "forge-work", "the-undev", "spool"],
    [
      "http://192.0.2.10:3000/finch/dotfiles",
      "192.0.2.10",
      "finch",
      "dotfiles",
    ],
  ])("parses %s", (url, host, owner, name) => {
    expect(parseRemoteUrl(url)).toEqual({ host, owner, repo: name });
  });

  it("returns null for a local path", () => {
    expect(parseRemoteUrl("/tmp/remote.git")).toBeNull();
  });
});

describe("gathering from github", () => {
  const api = "https://api.github.com/repos";

  it("records raw pull requests and the latest run, with reasons for what is missing", async () => {
    const { fetchJson, calls } = fakeFetch({
      [`${api}/the-undev/harbour`]: { default_branch: "main" },
      [`${api}/the-undev/harbour/pulls?state=open&per_page=100`]: [
        {
          number: 7,
          title: "Add tiles",
          user: null,
          draft: false,
          updated_at: "2026-10-20T10:00:00Z",
          html_url: "https://github.com/the-undev/harbour/pull/7",
        },
      ],
      [`${api}/the-undev/harbour/actions/runs?branch=main&per_page=1`]: {
        workflow_runs: [
          {
            name: "ci",
            status: "in_progress",
            conclusion: null,
            html_url: "https://github.com/the-undev/harbour/actions/runs/1",
            created_at: "2026-10-20T09:00:00Z",
          },
        ],
      },
    });
    const accounts: string[] = [];
    const source = createGithubSource({
      fetchJson,
      tokenFor: async (account) => {
        accounts.push(account);
        if (account === "the-undev") return "undev-token";
        throw new Error(`gh has no token for ${account}`);
      },
      hostAccounts: { "github.com": "finch", "github-work": "the-undev" },
    });

    const entries = await source.gather(
      [repo("harbour"), repo("perch"), repo("vault"), repo("ungathered")],
      earlierGit({
        harbour: [
          { name: "origin", url: "git@github-work:the-undev/harbour.git" },
        ],
        perch: [{ name: "origin", url: "git@github.com:finch/perch.git" }],
        vault: [
          { name: "origin", url: "ssh://git@forgejo:2222/finch/Vault.git" },
        ],
      }),
    );

    expect(entries.harbour).toEqual({
      state: "observed",
      value: {
        remote: {
          remoteName: "origin",
          host: "github-work",
          owner: "the-undev",
          repo: "harbour",
        },
        account: "the-undev",
        defaultBranch: "main",
        openPullRequests: [
          {
            number: 7,
            title: "Add tiles",
            author: { state: "absent", reason: "no-user" },
            draft: false,
            updatedAt: "2026-10-20T10:00:00Z",
            url: "https://github.com/the-undev/harbour/pull/7",
          },
        ],
        latestRun: {
          state: "observed",
          value: {
            name: "ci",
            status: "in_progress",
            conclusion: { state: "absent", reason: "run-not-completed" },
            url: "https://github.com/the-undev/harbour/actions/runs/1",
            createdAt: "2026-10-20T09:00:00Z",
          },
        },
      },
    });
    expect(entries.perch).toEqual({
      state: "error",
      error: "gh has no token for finch",
    });
    expect(entries.vault).toEqual({
      state: "absent",
      reason: "no-github-remote",
    });
    expect(entries.ungathered).toEqual({
      state: "error",
      error: "no git data for this item",
    });
    expect(calls[0]?.headers.Authorization).toBe("Bearer undev-token");
    expect(accounts.sort()).toEqual(["finch", "the-undev"]);
  });

  it("fails as a whole when no git data exists to read remotes from", async () => {
    const source = createGithubSource({
      fetchJson: fakeFetch({}).fetchJson,
      tokenFor: async () => "t",
      hostAccounts: {},
    });

    await expect(source.gather([repo("perch")], {})).rejects.toThrow(
      /no git data/,
    );
  });
});

describe("deriving github data", () => {
  const raw: RawGithub = {
    remote: {
      remoteName: "origin",
      host: "github.com",
      owner: "finch",
      repo: "perch",
    },
    account: "finch",
    defaultBranch: "main",
    openPullRequests: [],
    latestRun: {
      state: "observed",
      value: {
        name: "ci",
        status: "completed",
        conclusion: { state: "observed", value: "failure" },
        url: "u",
        createdAt: "2026-10-20T09:00:00Z",
      },
    },
  };

  it("maps the latest run to a CI state and keeps the forge's own words", () => {
    expect(deriveGithub(raw).latestCi).toEqual({
      name: "ci",
      state: "failure",
      forgeState: "completed/failure",
      url: "u",
      createdAt: "2026-10-20T09:00:00Z",
    });
    expect(
      deriveGithub({
        ...raw,
        latestRun: { state: "absent", reason: "no-runs-on-default-branch" },
      }).latestCi,
    ).toBeNull();
  });

  it("maps run status and conclusion to a CI state", () => {
    expect(githubCiState("in_progress", null)).toBe("pending");
    expect(githubCiState("completed", "success")).toBe("success");
    expect(githubCiState("completed", "timed_out")).toBe("failure");
    expect(githubCiState("completed", "cancelled")).toBe("neutral");
  });
});

describe("gathering from forgejo", () => {
  const hothouse = earlierGit({
    hothouse: [
      { name: "origin", url: "ssh://git@forgejo:2222/finch/Hothouse.git" },
    ],
    perch: [{ name: "origin", url: "git@github.com:finch/perch.git" }],
  });
  const deps = {
    baseUrl: "http://forgejo.test",
    remoteHosts: ["forgejo", "forge-work"],
  };

  it("fails as a whole with token-not-stored when the token is missing", async () => {
    const source = createForgejoSource({
      ...deps,
      fetchJson: fakeFetch({}).fetchJson,
      token: async () => {
        throw new SourceFailure("token-not-stored", forgejoTokenMissing);
      },
    });

    const failure = await source
      .gather([repo("hothouse")], hothouse)
      .catch((error: unknown) => error);

    expect((failure as SourceFailure).reason).toBe("token-not-stored");
  });

  it("states no forgejo remote without asking for the token", async () => {
    let asked = false;
    const source = createForgejoSource({
      ...deps,
      fetchJson: fakeFetch({}).fetchJson,
      token: async () => {
        asked = true;
        return "token";
      },
    });

    const entries = await source.gather([repo("perch")], hothouse);

    expect(entries.perch).toEqual({
      state: "absent",
      reason: "no-forgejo-remote",
    });
    expect(asked).toBe(false);
  });

  it("records the combined status raw, and derives CI from its newest status", async () => {
    const base = "http://forgejo.test/api/v1/repos/finch/Hothouse";
    const { fetchJson } = fakeFetch({
      [base]: { default_branch: "main" },
      [`${base}/pulls?state=open&limit=50`]: [],
      [`${base}/commits/main/status`]: {
        state: "pending",
        statuses: [
          {
            context: "build",
            status: "success",
            created_at: "2026-10-20T09:00:00Z",
            target_url: "a",
          },
          {
            context: "test",
            status: "pending",
            created_at: "2026-10-20T09:05:00Z",
            target_url: "",
          },
        ],
      },
    });
    const source = createForgejoSource({
      ...deps,
      fetchJson,
      token: async () => "t",
    });

    const entry = (await source.gather([repo("hothouse")], hothouse))
      .hothouse;

    expect(entry?.state).toBe("observed");
    if (entry?.state !== "observed") return;
    expect(entry.value.combinedStatus.statuses[1]?.targetUrl).toEqual({
      state: "absent",
      reason: "no-target-url",
    });
    expect(deriveForgejo(entry.value).latestCi).toEqual({
      name: "test",
      state: "pending",
      forgeState: "pending",
      url: null,
      createdAt: "2026-10-20T09:05:00Z",
    });
  });
});
