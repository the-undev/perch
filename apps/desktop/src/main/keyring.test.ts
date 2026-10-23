import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { HttpStatusError, NoAnswerError } from "@perch/core/http.ts";
import type { TokenLookup } from "@perch/core/secrets.ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStoreToken, testSource } from "./keyring.ts";
import type { Spawn } from "./launch.ts";

const token = "github_pat_11SECRETSECRETSECRET";

/** Every console call made during a test, so none can be shown to carry the token. */
let consoleCalls: unknown[][] = [];

beforeEach(() => {
  consoleCalls = [];
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      consoleCalls.push(args);
    });
  }
});

afterEach(() => {
  expect(JSON.stringify(consoleCalls)).not.toContain(token);
  vi.restoreAllMocks();
});

/**
 * A secret-tool that reads its stdin to the end, then writes stderr and exits with the code, or
 * one that fails to start with the error.
 */
function fakeSecretTool(outcome: { code: number; stderr: string } | Error) {
  const stdin = new PassThrough();
  const stderr = new PassThrough();
  const child = Object.assign(new EventEmitter(), {
    stdin,
    stderr,
    kill: vi.fn(),
  });
  let written = "";
  stdin.on("data", (chunk: Buffer) => {
    written += chunk.toString("utf8");
  });
  if (outcome instanceof Error) {
    setTimeout(() => {
      child.emit("error", outcome);
      child.emit("close", null);
    }, 0);
  } else {
    stdin.on("end", () => {
      stderr.end(outcome.stderr);
      setTimeout(() => child.emit("close", outcome.code), 0);
    });
  }
  const calls: {
    command: string;
    args: readonly string[];
    options: SpawnOptions;
  }[] = [];
  const spawn: Spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return child as unknown as ChildProcess;
  };
  return { spawn, calls, written: () => written };
}

const env = {
  PATH: "/usr/bin",
  DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/bus",
};

describe("storing a token", () => {
  it("writes it to secret-tool's stdin, never to its arguments or environment", async () => {
    const tool = fakeSecretTool({ code: 0, stderr: "" });

    const stored = await createStoreToken(tool.spawn, {
      cwd: "/home/owner",
      env,
    })("github-someone", `  ${token}\n`);

    expect(stored).toEqual({ ok: true });
    expect(tool.written()).toBe(token);
    expect(tool.calls).toEqual([
      {
        command: "secret-tool",
        args: [
          "store",
          "--label",
          "perch",
          "service",
          "perch",
          "key",
          "github-someone",
        ],
        options: {
          cwd: "/home/owner",
          env,
          stdio: ["pipe", "ignore", "pipe"],
        },
      },
    ]);
    expect(JSON.stringify(tool.calls)).not.toContain(token);
  });

  it("refuses an empty key or token without starting secret-tool", async () => {
    const tool = fakeSecretTool({ code: 0, stderr: "" });
    const store = createStoreToken(tool.spawn, { cwd: "/", env });

    expect(await store(" ", token)).toEqual({
      ok: false,
      problem: "there is no keyring key to store it under",
    });
    expect(await store("github-someone", "  \n")).toEqual({
      ok: false,
      problem: "there is no token to store",
    });
    expect(tool.calls).toEqual([]);
  });

  it("says what the keyring answered when it refuses", async () => {
    const tool = fakeSecretTool({
      code: 1,
      stderr: "secret-tool: Cannot create an item in a locked collection\n",
    });

    expect(
      await createStoreToken(tool.spawn, { cwd: "/", env })(
        "github-someone",
        token,
      ),
    ).toEqual({
      ok: false,
      problem:
        "the keyring did not take it: secret-tool: Cannot create an item in a locked collection",
    });
  });

  it("says why when secret-tool cannot start", async () => {
    const tool = fakeSecretTool(new Error("spawn secret-tool ENOENT"));

    expect(
      await createStoreToken(tool.spawn, { cwd: "/", env })(
        "github-someone",
        token,
      ),
    ).toEqual({
      ok: false,
      problem: "the keyring did not take it: spawn secret-tool ENOENT",
    });
  });
});

/** A repository as the GitHub and Forgejo listings send one. */
const repo = (owner: string, name: string) => ({
  full_name: `${owner}/${name}`,
  owner: { login: owner },
  name,
  default_branch: "main",
  html_url: `https://example.com/${owner}/${name}`,
});

const lookup: TokenLookup = async (key) => {
  if (key === "github-someone" || key === "forgejo-someone") return token;
  throw new Error(`no token under ${key}`);
};

describe("testing a connection", () => {
  it("counts the account's own repositories the stored token reads", async () => {
    const requests: { url: string; headers: Record<string, string> }[] = [];
    const fetchJson = vi.fn(
      async (url: string, headers: Record<string, string>) => {
        requests.push({ url, headers });
        return [
          repo("Someone", "a"),
          repo("someone", "b"),
          repo("someorg", "c"),
        ];
      },
    );

    const github = await testSource(
      { kind: "github", account: "someone", key: "github-someone" },
      { lookupToken: lookup, fetchJson },
    );
    const forgejo = await testSource(
      {
        kind: "forgejo",
        account: "someone",
        key: "forgejo-someone",
        baseUrl: "http://forge.example.lan:3000",
      },
      { lookupToken: lookup, fetchJson },
    );

    expect(github).toEqual({ ok: true, count: 2 });
    expect(forgejo).toEqual({ ok: true, count: 2 });
    expect(requests.map((request) => request.url)).toEqual([
      "https://api.github.com/user/repos?per_page=100&page=1",
      "http://forge.example.lan:3000/api/v1/user/repos?limit=50&page=1",
    ]);
    expect(requests[0]?.headers.Authorization).toBe(`Bearer ${token}`);
    expect(JSON.stringify([github, forgejo])).not.toContain(token);
  });

  it("says when the keyring holds no token under the key, and asks no forge", async () => {
    const fetchJson = vi.fn(async () => []);

    expect(
      await testSource(
        { kind: "github", account: "someone", key: "github-nobody" },
        { lookupToken: lookup, fetchJson },
      ),
    ).toEqual({
      ok: false,
      problem: "no token in the keyring under github-nobody",
    });
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("names the host that did not answer, and the status a forge answered", async () => {
    const unreachable = await testSource(
      {
        kind: "forgejo",
        account: "someone",
        key: "forgejo-someone",
        baseUrl: "http://forge.example.lan:3000",
      },
      {
        lookupToken: lookup,
        fetchJson: async (url) => {
          throw new NoAnswerError(url, { cause: new Error("ECONNREFUSED") });
        },
      },
    );
    const refused = await testSource(
      { kind: "github", account: "someone", key: "github-someone" },
      {
        lookupToken: lookup,
        fetchJson: async (url) => {
          throw new HttpStatusError(url, 401);
        },
      },
    );

    expect(unreachable).toEqual({
      ok: false,
      problem: "no answer from forge.example.lan:3000",
    });
    expect(refused).toEqual({
      ok: false,
      problem: "api.github.com answered HTTP 401",
    });
  });

  it("refuses a Forgejo address that is not a web address before reading the keyring", async () => {
    const lookupToken = vi.fn(lookup);

    expect(
      await testSource(
        {
          kind: "forgejo",
          account: "someone",
          key: "forgejo-someone",
          baseUrl: "forge",
        },
        { lookupToken, fetchJson: async () => [] },
      ),
    ).toEqual({
      ok: false,
      problem: "the server's address must start with http:// or https://",
    });
    expect(lookupToken).not.toHaveBeenCalled();
  });

  it("never answers with the token, even when a failure would carry it", async () => {
    const tested = await testSource(
      { kind: "github", account: "someone", key: "github-someone" },
      {
        lookupToken: lookup,
        fetchJson: async () => {
          throw new Error(`bad header Bearer ${token}`);
        },
      },
    );

    expect(tested).toEqual({
      ok: false,
      problem:
        "api.github.com answered with something perch cannot read: bad header Bearer [token]",
    });
  });
});
