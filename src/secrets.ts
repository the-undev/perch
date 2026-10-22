import { runCommand } from "./exec.ts";

/** Reads read-only forge tokens from the desktop keyring by key, under service perch. */
export type TokenLookup = (key: string) => Promise<string>;

/** The error for a key with no keyring entry, naming the command that stores it. */
export function tokenMissing(key: string): string {
  return `no token in the keyring under service perch key ${key}; store it with: secret-tool store --label "perch ${key}" service perch key ${key}`;
}

/** Looks tokens up with secret-tool; a failed or empty lookup rejects with tokenMissing. */
export function createKeyringTokenLookup(
  home: string,
  env: NodeJS.ProcessEnv,
): TokenLookup {
  return async (key) => {
    const output = await runCommand(
      "secret-tool",
      ["lookup", "service", "perch", "key", key],
      { cwd: home, env },
    ).catch(() => "");
    const token = output.trim();
    if (token === "") throw new Error(tokenMissing(key));
    return token;
  };
}
