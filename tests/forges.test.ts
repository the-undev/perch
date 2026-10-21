import { describe, expect, it } from "vitest";
import { deriveForge, githubCiState } from "../src/derivations.ts";
import { SourceFailure } from "../src/failure.ts";
import type { FetchJson } from "../src/http.ts";
import type { RawFiles, RawForgeRepoInfo } from "../src/raw.ts";
import { parseRemoteUrl } from "../src/remote-url.ts";
import { forgejoTokenMissing } from "../src/secrets.ts";
import {
  createForgeAccountsSource,
  createForgeSource,
  type ForgeClient,
} from "../src/sources/forge.ts";
import { createForgejoClient } from "../src/sources/forgejo.ts";
import { createGithubClient } from "../src/sources/github.ts";
import { forgeRepo, localPresence, withRemotes } from "./helpers/raw.ts";

function info(
  fullName: string,
  extra: Partial<RawForgeRepoInfo>,
): RawForgeRepoInfo {
  return { ...forgeRepo(fullName, {}).info, ...extra };
}

function fakeClient(
  repos: Record<string, RawForgeRepoInfo[]>,
  lookups: Record<string, RawForgeRepoInfo>,
) {
  const calls: string[] = [];
  const client: ForgeClient = {
    forge: "github",
    listRepos: async (account) => {
      calls.push(`list ${account}`);
      const listed = repos[account];
      if (listed === undefined) throw new Error(`no such account ${account}`);
      return listed;
    },
    getRepo: async (owner, name, account) => {
      calls.push(`get ${owner}/${name} as ${account}`);
      const found = lookups[`${owner}/${name}`];
      if (found === undefined) throw new Error(`HTTP 404 for ${owner}/${name}`);
      return found;
    },
    readDetails: async (repo) => {
      calls.push(`details ${repo.fullName}`);
      return {
        openPullRequests: [],
        ci: {
          forge: "github",
          latestRun: { state: "absent", reason: "no-runs-on-default-branch" },
        },
      };
    },
  };
  return { client, calls };
}

const github = {
  accounts: [
    { account: "finch", hosts: ["github.com"] },
    { account: "the-undev", hosts: ["github-work"] },
  ],
  trackedForks: ["finch/kept-fork"],
};

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

describe("forge accounts source", () => {
  it("lists each account, skipping untracked forks by name and keeping archived repositories", async () => {
    const { client } = fakeClient(
      {
        finch: [
          info("finch/perch", {}),
          info("finch/old", { archived: true }),
          info("finch/someone-elses", { fork: true }),
          info("finch/kept-fork", { fork: true }),
        ],
      },
      {},
    );

    const data = await createForgeAccountsSource(
      "githubAccounts",
      client,
      github,
    ).gather({});

    expect(data.finch).toEqual({
      state: "observed",
      value: {
        repos: [
          info("finch/kept-fork", { fork: true }),
          info("finch/old", { archived: true }),
          info("finch/perch", {}),
        ],
        skippedForks: ["finch/someone-elses"],
      },
    });
    expect(data["the-undev"]).toEqual({
      state: "error",
      error: "no such account the-undev",
    });
  });

  it("fails as a whole with the client's reason when the token is missing", async () => {
    const client = createForgejoClient({
      fetchJson: async () => [],
      token: async () => {
        throw new SourceFailure("token-not-stored", forgejoTokenMissing);
      },
      baseUrl: "http://forgejo.test",
    });
    const failure = await createForgeAccountsSource("forgejoAccounts", client, {
      accounts: [{ account: "finch", hosts: ["forgejo"] }],
      trackedForks: [],
    })
      .gather({})
      .catch((error: unknown) => error);

    expect((failure as SourceFailure).reason).toBe("token-not-stored");
  });
});

describe("forge source", () => {
  const earlier = (
    remotes: string[],
    listed: RawForgeRepoInfo[],
  ): Partial<RawFiles> => ({
    local: {
      source: "local",
      gatheredAt: "2026-10-21T09:00:00.000Z",
      data: {
        includes: {},
        presences: Object.fromEntries(
          remotes.map((url, index) => [
            `dev/r${index}`,
            localPresence(`/home/test/dev/r${index}`, {
              include: "/home/test/dev",
              git: withRemotes([{ name: "origin", url }]),
            }),
          ]),
        ),
      },
    },
    githubAccounts: {
      source: "githubAccounts",
      gatheredAt: "2026-10-21T09:00:00.000Z",
      data: {
        finch: {
          state: "observed",
          value: { repos: listed, skippedForks: [] },
        },
      },
    },
  });

  it("reads details for listed repositories, and looks up remotes the listings missed", async () => {
    const { client, calls } = fakeClient(
      {},
      {
        "skiff-app/skiff": info("skiff-app/skiff", {}),
        "finch/camera-mover": info("finch/PhotoMover", {}),
        "finch/forked": info("finch/forked", { fork: true }),
      },
    );

    const data = await createForgeSource(
      "github",
      "githubAccounts",
      client,
      github,
    ).gather(
      earlier(
        [
          "git@github.com:finch/perch.git",
          "git@github-work:skiff-app/skiff.git",
          "https://github.com/finch/camera-mover.git",
          "https://github.com/finch/forked.git",
          "https://github.com/finch/deleted.git",
          "git@gitlab.com:someone/elsewhere.git",
        ],
        [info("finch/perch", {}), info("finch/old", { archived: true })],
      ),
    );

    expect(Object.keys(data)).toEqual([
      "finch/deleted",
      "finch/forked",
      "finch/old",
      "finch/perch",
      "finch/photomover",
      "skiff-app/skiff",
    ]);
    expect(data["skiff-app/skiff"]).toMatchObject({
      state: "observed",
      value: {
        foundBy: "local-remote",
        account: "the-undev",
        details: { state: "observed" },
      },
    });
    expect(data["finch/photomover"]).toMatchObject({
      value: { aliases: ["finch/camera-mover"] },
    });
    expect(data["finch/forked"]).toEqual({
      state: "absent",
      reason: "fork-not-tracked",
    });
    expect(data["finch/deleted"]).toEqual({
      state: "error",
      error: "HTTP 404 for finch/deleted",
    });
    expect(data["finch/old"]).toMatchObject({
      value: { details: { state: "absent", reason: "archived-slow-lane" } },
    });
    expect(calls).not.toContain("get finch/perch as finch");
    expect(calls).not.toContain("details finch/old");
  });

  it("fails as a whole without local presences to read remotes from", async () => {
    const { client } = fakeClient({}, {});

    await expect(
      createForgeSource("github", "githubAccounts", client, github).gather({}),
    ).rejects.toThrow(/no local presences/);
  });
});

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

const apiRepo = (fullName: string, extra: object) => ({
  full_name: fullName,
  owner: { login: fullName.split("/")[0] },
  name: fullName.split("/")[1],
  default_branch: "main",
  archived: false,
  fork: false,
  private: true,
  html_url: `https://github.com/${fullName}`,
  ...extra,
});

describe("github client", () => {
  const api = "https://api.github.com";

  it("lists the account's own repositories with its token, page by page", async () => {
    const { fetchJson, calls } = fakeFetch({
      [`${api}/user/repos?affiliation=owner&per_page=100&page=1`]: [
        apiRepo("finch/perch", {}),
        apiRepo("finch/old", { archived: true }),
      ],
    });
    const client = createGithubClient({
      fetchJson,
      tokenFor: async (account) => `${account}-token`,
    });

    const repos = await client.listRepos("finch");

    expect(
      repos.map((repo) => [repo.fullName, repo.archived, repo.private]),
    ).toEqual([
      ["finch/perch", false, true],
      ["finch/old", true, true],
    ]);
    expect(calls[0]?.headers.Authorization).toBe("Bearer finch-token");
  });

  it("reads pull requests and the latest default-branch run, with reasons for what is missing", async () => {
    const base = `${api}/repos/the-undev/harbour`;
    const { fetchJson } = fakeFetch({
      [`${base}/pulls?state=open&per_page=100`]: [
        {
          number: 7,
          title: "Add tiles",
          user: null,
          draft: false,
          updated_at: "2026-10-20T10:00:00Z",
          html_url: "https://github.com/the-undev/harbour/pull/7",
        },
      ],
      [`${base}/actions/runs?branch=main&per_page=1`]: {
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
    const client = createGithubClient({ fetchJson, tokenFor: async () => "t" });

    const details = await client.readDetails(
      info("the-undev/harbour", {}),
      "the-undev",
    );

    expect(details.openPullRequests[0]?.author).toEqual({
      state: "absent",
      reason: "no-user",
    });
    expect(details.ci).toEqual({
      forge: "github",
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
    });
  });
});

describe("forgejo client", () => {
  it("reads the default branch's combined status as CI", async () => {
    const base = "http://forgejo.test/api/v1/repos/finch/Hothouse";
    const { fetchJson, calls } = fakeFetch({
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
    const client = createForgejoClient({
      fetchJson,
      token: async () => "t",
      baseUrl: "http://forgejo.test",
    });

    const details = await client.readDetails(
      info("finch/Hothouse", {}),
      "finch",
    );

    expect(calls[0]?.headers.Authorization).toBe("token t");
    expect(details.ci).toMatchObject({
      forge: "forgejo",
      combinedStatus: {
        state: "pending",
        statuses: [
          { context: "build" },
          { targetUrl: { state: "absent", reason: "no-target-url" } },
        ],
      },
    });
  });
});

describe("deriving forge data", () => {
  it("maps a GitHub run and a Forgejo combined status to CI", () => {
    const githubRepo = forgeRepo("finch/perch", {});
    githubRepo.details = {
      state: "observed",
      value: {
        openPullRequests: [],
        ci: {
          forge: "github",
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
        },
      },
    };
    const forgejoRepo = forgeRepo("finch/Hothouse", {});
    forgejoRepo.details = {
      state: "observed",
      value: {
        openPullRequests: [],
        ci: {
          forge: "forgejo",
          combinedStatus: {
            state: "pending",
            statuses: [
              {
                context: "build",
                status: "success",
                targetUrl: { state: "observed", value: "a" },
                createdAt: "2026-10-20T09:00:00Z",
              },
              {
                context: "test",
                status: "pending",
                targetUrl: { state: "absent", reason: "no-target-url" },
                createdAt: "2026-10-20T09:05:00Z",
              },
            ],
          },
        },
      },
    };

    expect(deriveForge(githubRepo)).toMatchObject({
      fullName: "finch/perch",
      latestCi: {
        name: "ci",
        state: "failure",
        forgeState: "completed/failure",
      },
    });
    expect(deriveForge(forgejoRepo)).toMatchObject({
      latestCi: {
        name: "test",
        state: "pending",
        url: null,
        createdAt: "2026-10-20T09:05:00Z",
      },
    });
    expect(deriveForge(forgeRepo("finch/old", { archived: true }))).toEqual({
      error: "details not read: archived",
    });
  });

  it("maps run status and conclusion to a CI state", () => {
    expect(githubCiState("in_progress", null)).toBe("pending");
    expect(githubCiState("completed", "success")).toBe("success");
    expect(githubCiState("completed", "timed_out")).toBe("failure");
    expect(githubCiState("completed", "cancelled")).toBe("neutral");
  });
});
