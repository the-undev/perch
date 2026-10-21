import { runCommand } from "./exec.ts";

/** Message recorded when the Forgejo token has not been put in the keyring. */
export const forgejoTokenMissing =
  "Forgejo token is not yet stored in the keyring (secret-tool lookup service perch key forgejo-token found nothing)";

/** Reads a GitHub account's token from gh, which keeps it in the desktop keyring. */
export function createGithubTokenLookup(
  home: string,
  env: NodeJS.ProcessEnv,
): (account: string) => Promise<string> {
  return async (account) => {
    const token = (
      await runCommand("gh", ["auth", "token", "--user", account], {
        cwd: home,
        env,
      })
    ).trim();
    if (token === "") throw new Error(`gh has no token for ${account}`);
    return token;
  };
}

/** Reads the Forgejo token from the keyring, rejecting with forgejoTokenMissing when absent. */
export function createForgejoTokenLookup(
  home: string,
  env: NodeJS.ProcessEnv,
): () => Promise<string> {
  return async () => {
    const output = await runCommand(
      "secret-tool",
      ["lookup", "service", "perch", "key", "forgejo-token"],
      { cwd: home, env },
    ).catch(() => "");
    const token = output.trim();
    if (token === "") throw new Error(forgejoTokenMissing);
    return token;
  };
}
