// The keyring calls a forge card makes: storing a pasted token, write-only, and testing the
// connection with the token stored. Neither answers, logs or echoes the token.

import { hostOf } from "@perch/core/derivations.ts";
import {
  type FetchJson,
  HttpStatusError,
  NoAnswerError,
} from "@perch/core/http.ts";
import type { TokenLookup } from "@perch/core/secrets.ts";
import { createForgejoClient } from "@perch/core/sources/forgejo.ts";
import { createGithubClient } from "@perch/core/sources/github.ts";
import type {
  SourceTested,
  SourceTestValues,
  TokenStored,
} from "@perch/core/sources-form.ts";
import type { Spawn } from "./launch.ts";

/** A message with every occurrence of the token taken out. */
function withoutToken(message: string, token: string): string {
  return message.replaceAll(token, "[token]");
}

const notTaken = (detail: string): TokenStored => ({
  ok: false,
  problem: `the keyring did not take it: ${detail}`,
});

/**
 * Stores tokens with `secret-tool store` under service perch, the token written to its stdin and
 * never to its arguments, its environment or a file. Whitespace around a pasted token is dropped.
 */
export function createStoreToken(
  spawn: Spawn,
  options: { cwd: string; env: NodeJS.ProcessEnv },
): (key: string, token: string) => Promise<TokenStored> {
  return (key, pasted) =>
    new Promise((resolve) => {
      const token = pasted.trim();
      if (key.trim() === "") {
        resolve({
          ok: false,
          problem: "there is no keyring key to store it under",
        });
        return;
      }
      if (token === "") {
        resolve({ ok: false, problem: "there is no token to store" });
        return;
      }
      const child = spawn(
        "secret-tool",
        ["store", "--label", "perch", "service", "perch", "key", key],
        {
          cwd: options.cwd,
          env: options.env,
          stdio: ["pipe", "ignore", "pipe"],
        },
      );
      const { stdin, stderr } = child;
      if (stdin === null || stderr === null) {
        child.kill();
        resolve(notTaken("secret-tool started without its pipes"));
        return;
      }
      let errorOutput = "";
      stderr.setEncoding("utf8");
      stderr.on("data", (chunk: string) => {
        errorOutput += chunk;
      });
      // A program that never started closes its stdin; the error event says why.
      stdin.on("error", () => {});
      child.once("error", (error) =>
        resolve(notTaken(withoutToken(error.message, token))),
      );
      child.once("close", (code) => {
        if (code === 0) {
          resolve({ ok: true });
          return;
        }
        const detail = errorOutput.trim() || `secret-tool exited with ${code}`;
        resolve(notTaken(withoutToken(detail, token)));
      });
      stdin.end(token);
    });
}

export interface TestSourceDeps {
  lookupToken: TokenLookup;
  fetchJson: FetchJson;
}

/** A failed listing as the forge's answer in words. */
function failureWords(error: unknown, host: string): string {
  if (error instanceof NoAnswerError) return `no answer from ${host}`;
  if (error instanceof HttpStatusError) {
    return `${host} answered HTTP ${error.status}`;
  }
  const detail = error instanceof Error ? error.message : String(error);
  return `${host} answered with a response that could not be read: ${detail}`;
}

/**
 * Lists the account's repositories with the token stored under the card's key, as a scan does,
 * and counts those the account owns.
 */
export async function testSource(
  values: SourceTestValues,
  deps: TestSourceDeps,
): Promise<SourceTested> {
  if (values.key.trim() === "") {
    return {
      ok: false,
      problem: "there is no keyring key to read the token from",
    };
  }
  if (
    values.kind === "forgejo" &&
    !/^https?:\/\//.test(values.baseUrl.trim())
  ) {
    return {
      ok: false,
      problem: "the server's address must start with http:// or https://",
    };
  }
  const token = await deps.lookupToken(values.key).catch(() => null);
  if (token === null) {
    return {
      ok: false,
      problem: `no token in the keyring under ${values.key}`,
    };
  }
  // A listing reads no commits, so the finalised count is never used.
  const client =
    values.kind === "github"
      ? createGithubClient({ fetchJson: deps.fetchJson, finalisedCommits: 1 })
      : createForgejoClient({
          fetchJson: deps.fetchJson,
          baseUrl: values.baseUrl.trim(),
          finalisedCommits: 1,
        });
  const host =
    values.kind === "github" ? "api.github.com" : hostOf(values.baseUrl.trim());
  try {
    const repos = await client.listRepos(token);
    const account = values.account.trim().toLowerCase();
    return {
      ok: true,
      count: repos.filter((info) => info.owner.toLowerCase() === account)
        .length,
    };
  } catch (error) {
    return {
      ok: false,
      problem: withoutToken(failureWords(error, host), token),
    };
  }
}
