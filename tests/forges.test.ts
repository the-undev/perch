import { describe, expect, it } from "vitest";
import type { FetchJson } from "../src/http.ts";
import { parseRemoteUrl } from "../src/remote-url.ts";
import { forgejoTokenMissing } from "../src/secrets.ts";
import type { GitData, Item, Remote } from "../src/snapshot.ts";
import { createForgejoSource } from "../src/sources/forgejo.ts";
import { createGithubSource, githubCiState } from "../src/sources/github.ts";

function repoItem(id: string, remotes: Remote[]): Item {
  const git = { remotes } as GitData;
  return {
    id,
    name: id,
    kind: "repo",
    path: `/work/${id}`,
    importance: "projects",
    liveSources: [],
    sources: { git },
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
      if (!(url in responses)) throw new Error(`404 Not Found from ${url}`);
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
  ])("parses %s", (url, host, owner, repo) => {
    expect(parseRemoteUrl(url)).toEqual({ host, owner, repo });
  });

  it("returns null for a local path", () => {
    expect(parseRemoteUrl("/tmp/remote.git")).toBeNull();
  });
});

describe("github source", () => {
  const api = "https://api.github.com/repos";

  it("reads pull requests and CI, choosing the token by remote host", async () => {
    const { fetchJson, calls } = fakeFetch({
      [`${api}/the-undev/harbour`]: { default_branch: "main" },
      [`${api}/the-undev/harbour/pulls?state=open&per_page=100`]: [
        {
          number: 7,
          title: "Add tiles",
          user: { login: "the-undev" },
          draft: false,
          updated_at: "2026-10-20T10:00:00Z",
          html_url: "https://github.com/the-undev/harbour/pull/7",
        },
      ],
      [`${api}/the-undev/harbour/actions/runs?branch=main&per_page=1`]: {
        workflow_runs: [
          {
            name: "ci",
            status: "completed",
            conclusion: "failure",
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

    const results = await source.scan([
      repoItem("harbour", [
        { name: "origin", url: "git@github-work:the-undev/harbour.git" },
      ]),
      repoItem("perch", [
        { name: "origin", url: "git@github.com:finch/perch.git" },
      ]),
      repoItem("vault", [
        { name: "origin", url: "ssh://git@forgejo:2222/finch/Vault.git" },
      ]),
    ]);

    expect(results.get("harbour")).toEqual({
      host: "github-work",
      owner: "the-undev",
      repo: "harbour",
      defaultBranch: "main",
      openPullRequests: [
        {
          number: 7,
          title: "Add tiles",
          author: "the-undev",
          draft: false,
          updatedAt: "2026-10-20T10:00:00Z",
          url: "https://github.com/the-undev/harbour/pull/7",
        },
      ],
      latestCi: {
        name: "ci",
        state: "failure",
        forgeState: "completed/failure",
        url: "https://github.com/the-undev/harbour/actions/runs/1",
        createdAt: "2026-10-20T09:00:00Z",
      },
    });
    expect(results.get("perch")).toEqual({
      error: "gh has no token for finch",
    });
    expect(results.has("vault")).toBe(false);
    expect(calls[0]?.headers.Authorization).toBe("Bearer undev-token");
    expect(accounts.sort()).toEqual(["finch", "the-undev"]);
  });

  it("maps run status and conclusion to a CI state", () => {
    expect(githubCiState("in_progress", null)).toBe("pending");
    expect(githubCiState("completed", "success")).toBe("success");
    expect(githubCiState("completed", "timed_out")).toBe("failure");
    expect(githubCiState("completed", "cancelled")).toBe("neutral");
  });
});

describe("forgejo source", () => {
  const forgejoRemote = [
    { name: "origin", url: "ssh://git@forgejo:2222/finch/Hothouse.git" },
  ];
  const deps = {
    baseUrl: "http://forgejo.test",
    remoteHosts: ["forgejo", "forge-work"],
  };

  it("fails as a whole when the token is not stored", async () => {
    const source = createForgejoSource({
      ...deps,
      fetchJson: fakeFetch({}).fetchJson,
      token: async () => {
        throw new Error(forgejoTokenMissing);
      },
    });

    await expect(
      source.scan([repoItem("hothouse", forgejoRemote)]),
    ).rejects.toThrow(/not yet stored/);
  });

  it("does not ask for the token when no repository is on Forgejo", async () => {
    let asked = false;
    const source = createForgejoSource({
      ...deps,
      fetchJson: fakeFetch({}).fetchJson,
      token: async () => {
        asked = true;
        return "token";
      },
    });

    const results = await source.scan([
      repoItem("perch", [
        { name: "origin", url: "git@github.com:finch/perch.git" },
      ]),
    ]);

    expect(results.size).toBe(0);
    expect(asked).toBe(false);
  });

  it("reads the combined status of the default branch as CI", async () => {
    const base = "http://forgejo.test/api/v1/repos/finch/Hothouse";
    const { fetchJson } = fakeFetch({
      [base]: { default_branch: "main" },
      [`${base}/pulls?state=open&limit=50`]: [],
      [`${base}/commits/main/status`]: {
        state: "pending",
        statuses: [
          {
            context: "build",
            created_at: "2026-10-20T09:00:00Z",
            target_url: "a",
          },
          {
            context: "test",
            created_at: "2026-10-20T09:05:00Z",
            target_url: "b",
          },
        ],
      },
    });
    const source = createForgejoSource({
      ...deps,
      fetchJson,
      token: async () => "t",
    });

    const results = await source.scan([repoItem("hothouse", forgejoRemote)]);

    expect(results.get("hothouse")).toMatchObject({
      openPullRequests: [],
      latestCi: {
        name: "test",
        state: "pending",
        forgeState: "pending",
        url: "b",
      },
    });
  });
});
