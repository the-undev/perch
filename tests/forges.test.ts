import { describe, expect, it } from "vitest";
import { deriveForge, githubCiState } from "../src/derivations.ts";
import type { FetchJson } from "../src/http.ts";
import type { RawFiles, RawForgeRepoInfo } from "../src/raw.ts";
import { parseRemoteUrl } from "../src/remote-url.ts";
import { tokenMissing } from "../src/secrets.ts";
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

/** A client whose token stands for an account: it lists and reads what that token may. */
function fakeClient(readable: Record<string, RawForgeRepoInfo[]>): {
  client: ForgeClient;
  calls: string[];
} {
  const calls: string[] = [];
  const visible = (token: string) => readable[token] ?? [];
  const client: ForgeClient = {
    forge: "github",
    listRepos: async (token) => {
      calls.push(`list with ${token}`);
      return visible(token);
    },
    getRepo: async (owner, name, token) => {
      calls.push(`get ${owner}/${name} with ${token}`);
      const found = visible(token).find(
        (repo) =>
          repo.fullName.toLowerCase() === `${owner}/${name}`.toLowerCase(),
      );
      if (found === undefined) throw new Error(`HTTP 404 for ${owner}/${name}`);
      return found;
    },
    readDetails: async (repo, token) => {
      calls.push(`details ${repo.fullName} with ${token}`);
      return {
        openPullRequests: [],
        ci: {
          forge: "github",
          latestRun: { state: "absent", reason: "no-runs-on-default-branch" },
        },
        finalisedCommits: [],
      };
    },
  };
  return { client, calls };
}

/** Keyring entries by key; a key with no entry rejects as the real lookup does. */
function fakeKeyring(entries: Record<string, string>) {
  const asked: string[] = [];
  const tokenFor = async (key: string) => {
    asked.push(key);
    const token = entries[key];
    if (token === undefined) throw new Error(tokenMissing(key));
    return token;
  };
  return { tokenFor, asked };
}

const github = {
  hosts: ["github.com", "github-work"],
  accounts: [
    { account: "finch", key: "github-finch" },
    { account: "the-undev", key: "github-the-undev" },
    { account: "skiff-app", key: "github-skiff-app" },
  ],
  trackedForks: ["finch/kept-fork"],
};

const allKeys = {
  "github-finch": "finch-token",
  "github-the-undev": "undev-token",
  "github-skiff-app": "org-token",
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
  it("lists each account with its own key's token, keeping only what the account owns", async () => {
    const { client, calls } = fakeClient({
      "finch-token": [
        info("finch/perch", {}),
        info("finch/old", { archived: true }),
        info("finch/someone-elses", { fork: true }),
        info("finch/kept-fork", { fork: true }),
      ],
      "org-token": [
        info("skiff-app/skiff", {}),
        info("the-undev/harbour", {}),
      ],
    });
    const { tokenFor, asked } = fakeKeyring({
      "github-finch": "finch-token",
      "github-skiff-app": "org-token",
    });

    const data = await createForgeAccountsSource("githubAccounts", {
      client,
      forge: github,
      tokenFor,
    }).gather({});

    expect(asked).toEqual([
      "github-finch",
      "github-the-undev",
      "github-skiff-app",
    ]);
    expect(calls).toEqual(["list with finch-token", "list with org-token"]);
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
    expect(data["skiff-app"]).toEqual({
      state: "observed",
      value: { repos: [info("skiff-app/skiff", {})], skippedForks: [] },
    });
  });

  it("records a missing keyring entry as that account's error, naming the key to store", async () => {
    const { client } = fakeClient({});
    const { tokenFor } = fakeKeyring({});

    const data = await createForgeAccountsSource("githubAccounts", {
      client,
      forge: {
        ...github,
        accounts: [{ account: "the-undev", key: "github-the-undev" }],
      },
      tokenFor,
    }).gather({});

    expect(data["the-undev"]).toEqual({
      state: "error",
      error: tokenMissing("github-the-undev"),
    });
    expect(tokenMissing("github-the-undev")).toContain(
      'secret-tool store --label "perch github-the-undev" service perch key github-the-undev',
    );
  });
});

describe("forge source", () => {
  const earlier = (
    remotes: string[],
    listed: Record<string, RawForgeRepoInfo[]>,
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
      data: Object.fromEntries(
        Object.entries(listed).map(([account, repos]) => [
          account,
          { state: "observed", value: { repos, skippedForks: [] } },
        ]),
      ),
    },
  });

  it("reads each listed repository's details with its listing account's token", async () => {
    const { client, calls } = fakeClient({
      "finch-token": [info("finch/perch", {})],
      "org-token": [info("skiff-app/skiff", {})],
    });
    const { tokenFor } = fakeKeyring(allKeys);

    const data = await createForgeSource("github", "githubAccounts", {
      client,
      forge: github,
      tokenFor,
    }).gather(
      earlier([], {
        finch: [
          info("finch/perch", {}),
          info("finch/old", { archived: true }),
        ],
        "skiff-app": [info("skiff-app/skiff", {})],
      }),
    );

    expect(calls.sort()).toEqual([
      "details finch/perch with finch-token",
      "details skiff-app/skiff with org-token",
    ]);
    expect(data["skiff-app/skiff"]).toMatchObject({
      value: { foundBy: "account-listing", account: "skiff-app" },
    });
    expect(data["finch/old"]).toMatchObject({
      value: { details: { state: "absent", reason: "archived-slow-lane" } },
    });
  });

  it("looks up a remote the listings missed with the token of the account that owns it", async () => {
    const { client, calls } = fakeClient({
      "org-token": [info("skiff-app/skiff", {})],
      "finch-token": [
        info("finch/PhotoMover", {}),
        info("finch/forked", { fork: true }),
      ],
    });
    const { tokenFor } = fakeKeyring(allKeys);

    const data = await createForgeSource("github", "githubAccounts", {
      client,
      forge: github,
      tokenFor,
    }).gather(
      earlier(
        [
          "git@github-work:skiff-app/skiff.git",
          "https://github.com/finch/forked.git",
          "https://github.com/finch/deleted.git",
          "https://github.com/someone/elsewhere.git",
          "git@gitlab.com:someone/other-forge.git",
        ],
        {},
      ),
    );

    expect(calls).toContain("get skiff-app/skiff with org-token");
    expect(calls).toContain("details skiff-app/skiff with org-token");
    expect(data["skiff-app/skiff"]).toMatchObject({
      state: "observed",
      value: { foundBy: "local-remote", account: "skiff-app" },
    });
    expect(data["finch/forked"]).toEqual({
      state: "absent",
      reason: "fork-not-tracked",
    });
    expect(data["finch/deleted"]).toEqual({
      state: "error",
      error: "HTTP 404 for finch/deleted",
    });
    expect(data["someone/elsewhere"]).toEqual({
      state: "error",
      error: "no github account is configured for owner someone",
    });
    expect(Object.keys(data)).not.toContain("someone/other-forge");
  });

  it("records the alias a renamed repository was reached by", async () => {
    const renamed = info("finch/PhotoMover", {});
    const client: ForgeClient = {
      ...fakeClient({}).client,
      getRepo: async () => renamed,
    };
    const { tokenFor } = fakeKeyring(allKeys);

    const data = await createForgeSource("github", "githubAccounts", {
      client,
      forge: github,
      tokenFor,
    }).gather(
      earlier(["https://github.com/finch/camera-mover.git"], {}),
    );

    expect(data["finch/photomover"]).toMatchObject({
      value: { aliases: ["finch/camera-mover"] },
    });
  });

  it("records a lookup whose owner's key is missing as that repository's error", async () => {
    const { client } = fakeClient({});
    const { tokenFor } = fakeKeyring({ "github-finch": "finch-token" });

    const data = await createForgeSource("github", "githubAccounts", {
      client,
      forge: github,
      tokenFor,
    }).gather(earlier(["git@github-work:skiff-app/skiff.git"], {}));

    expect(data["skiff-app/skiff"]).toEqual({
      state: "error",
      error: tokenMissing("github-skiff-app"),
    });
  });

  it("fails as a whole without local presences to read remotes from", async () => {
    const { client } = fakeClient({});
    const { tokenFor } = fakeKeyring(allKeys);

    await expect(
      createForgeSource("github", "githubAccounts", {
        client,
        forge: github,
        tokenFor,
      }).gather({}),
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

  it("lists every repository the token reads, page by page", async () => {
    const { fetchJson, calls } = fakeFetch({
      [`${api}/user/repos?per_page=100&page=1`]: [
        apiRepo("finch/perch", {}),
        apiRepo("finch/old", { archived: true }),
      ],
    });
    const client = createGithubClient({ fetchJson, finalisedCommits: 2 });

    const repos = await client.listRepos("finch-token");

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
      [`${base}/commits?sha=main&per_page=2`]: [
        {
          sha: "abc",
          commit: {
            committer: { date: "2026-10-20T08:00:00Z" },
            message: "Add tiles\n\nWith a body.",
          },
        },
      ],
    });
    const client = createGithubClient({ fetchJson, finalisedCommits: 2 });

    const details = await client.readDetails(info("the-undev/harbour", {}), "t");

    expect(details.finalisedCommits).toEqual([
      { sha: "abc", committedAt: "2026-10-20T08:00:00Z", subject: "Add tiles" },
    ]);
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
      [`${base}/commits?sha=main&limit=2&stat=false&verification=false&files=false`]:
        [
          {
            sha: "def",
            commit: {
              committer: { date: "2026-10-19T08:00:00Z" },
              message: "Office lighting",
            },
          },
        ],
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
      baseUrl: "http://forgejo.test",
      finalisedCommits: 2,
    });

    const details = await client.readDetails(
      info("finch/Hothouse", {}),
      "t",
    );

    expect(calls[0]?.headers.Authorization).toBe("token t");
    expect(details.finalisedCommits).toEqual([
      {
        sha: "def",
        committedAt: "2026-10-19T08:00:00Z",
        subject: "Office lighting",
      },
    ]);
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

  it("reads a commit with no statuses, which Forgejo sends as null, as an empty list", async () => {
    const base = "http://forgejo.test/api/v1/repos/finch/Pocket";
    const { fetchJson } = fakeFetch({
      [`${base}/pulls?state=open&limit=50`]: [],
      [`${base}/commits/main/status`]: {
        state: "",
        statuses: null,
        total_count: 0,
      },
      [`${base}/commits?sha=main&limit=2&stat=false&verification=false&files=false`]:
        [],
    });
    const client = createForgejoClient({
      fetchJson,
      baseUrl: "http://forgejo.test",
      finalisedCommits: 2,
    });

    const details = await client.readDetails(
      info("finch/Pocket", {}),
      "t",
    );

    expect(details.ci).toEqual({
      forge: "forgejo",
      combinedStatus: { state: "", statuses: [] },
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
        finalisedCommits: [
          {
            sha: "abc",
            committedAt: "2026-10-20T08:00:00Z",
            subject: "Add tiles",
          },
        ],
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
        finalisedCommits: [],
      },
    };

    expect(deriveForge(githubRepo)).toMatchObject({
      fullName: "finch/perch",
      latestCi: {
        name: "ci",
        state: "failure",
        forgeState: "completed/failure",
      },
      finalisedCommits: [
        {
          sha: "abc",
          committedAt: "2026-10-20T08:00:00Z",
          subject: "Add tiles",
        },
      ],
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
