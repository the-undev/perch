import {
  accountForOwner,
  type ForgeAccount,
  type ForgeConfig,
} from "../config.ts";
import { mapWithLimit } from "../exec.ts";
import { SourceFailure } from "../failure.ts";
import { errorMessage } from "../fs.ts";
import type {
  Entry,
  ForgeName,
  RawData,
  RawFiles,
  RawForgeAccount,
  RawForgeDetails,
  RawForgeRepo,
  RawForgeRepoInfo,
} from "../raw.ts";
import { sortedRecord } from "../records.ts";
import { parseRemoteUrl } from "../remote-url.ts";
import type { TokenLookup } from "../secrets.ts";
import type { PolledSource } from "./source.ts";

/** What perch reads from a forge; GitHub and Forgejo each implement it. */
export interface ForgeClient {
  readonly forge: ForgeName;
  /** Every repository the token can read, whoever owns it. */
  listRepos(token: string): Promise<RawForgeRepoInfo[]>;
  getRepo(
    owner: string,
    name: string,
    token: string,
  ): Promise<RawForgeRepoInfo>;
  readDetails(info: RawForgeRepoInfo, token: string): Promise<RawForgeDetails>;
}

export interface ForgeSourceDeps {
  client: ForgeClient;
  forge: ForgeConfig;
  tokenFor: TokenLookup;
}

/** The lower-case owner/name a forge repository is keyed by. */
export function repoKey(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase();
}

function isTracked(
  info: RawForgeRepoInfo,
  trackedForks: readonly string[],
): boolean {
  return trackedForks.some(
    (fork) => fork.toLowerCase() === info.fullName.toLowerCase(),
  );
}

/** A token lookup that asks the keyring once per key for the length of one gather. */
function cachedTokens(
  tokenFor: TokenLookup,
): (account: ForgeAccount) => Promise<string> {
  const tokens = new Map<string, Promise<string>>();
  return (account) => {
    const cached = tokens.get(account.key) ?? tokenFor(account.key);
    tokens.set(account.key, cached);
    return cached;
  };
}

/**
 * Root collector: lists each configured account's own repositories, read with that account's
 * token and kept when the account owns them. Untracked forks are left out by name; archived
 * repositories are kept with their flag. A missing token is that account's error.
 */
export function createForgeAccountsSource<
  N extends "githubAccounts" | "forgejoAccounts",
>(name: N, deps: ForgeSourceDeps): PolledSource<N> {
  return {
    name,
    async gather() {
      const entries: Record<string, Entry<RawForgeAccount, never>> = {};
      for (const account of deps.forge.accounts) {
        try {
          const token = await deps.tokenFor(account.key);
          const owned = (await deps.client.listRepos(token)).filter(
            (info) =>
              info.owner.toLowerCase() === account.account.toLowerCase(),
          );
          const kept = owned.filter(
            (info) => !info.fork || isTracked(info, deps.forge.trackedForks),
          );
          entries[account.account] = {
            state: "observed",
            value: {
              repos: kept.sort((a, b) => a.fullName.localeCompare(b.fullName)),
              skippedForks: owned
                .filter((info) => !kept.includes(info))
                .map((info) => info.fullName)
                .sort(),
            },
          };
        } catch (error) {
          entries[account.account] = {
            state: "error",
            error: errorMessage(error),
          };
        }
      }
      return entries as RawData[N];
    },
  };
}

interface Candidate {
  info: RawForgeRepoInfo;
  foundBy: RawForgeRepo["foundBy"];
  account: ForgeAccount;
  aliases: string[];
}

/**
 * Enricher: every listed repository, plus any repository a local clone's remote names on one of
 * this forge's hosts that the listings missed, looked up with the token of the account that owns
 * it. Pull requests, CI and finalised commits are read for those not archived.
 */
export function createForgeSource<N extends ForgeName>(
  name: N,
  accountsName: N extends "github" ? "githubAccounts" : "forgejoAccounts",
  deps: ForgeSourceDeps,
): PolledSource<N> {
  return {
    name,
    async gather(earlier: Partial<RawFiles>) {
      const local = earlier.local;
      if (local === undefined) {
        throw new SourceFailure(
          "unexpected",
          "no local presences to read remotes from",
        );
      }
      const tokenFor = cachedTokens(deps.tokenFor);
      const candidates = new Map<string, Candidate>();
      for (const [owner, entry] of Object.entries(
        earlier[accountsName]?.data ?? {},
      )) {
        const account = accountForOwner(deps.forge, owner);
        if (entry.state !== "observed" || account === null) continue;
        for (const info of entry.value.repos) {
          candidates.set(repoKey(info.owner, info.name), {
            info,
            foundBy: "account-listing",
            account,
            aliases: [],
          });
        }
      }

      const entries: Record<
        string,
        Entry<RawForgeRepo, "fork-not-tracked">
      > = {};
      const lookedUp = new Set<string>();
      for (const presence of Object.values(local.data.presences)) {
        if (presence.git.state !== "observed") continue;
        const remotes = presence.git.value.remotes;
        if (remotes.state !== "observed") continue;
        for (const remote of remotes.value) {
          const location = parseRemoteUrl(remote.url);
          if (location === null || !deps.forge.hosts.includes(location.host))
            continue;
          const key = repoKey(location.owner, location.repo);
          if (candidates.has(key) || lookedUp.has(key)) continue;
          lookedUp.add(key);
          const account = accountForOwner(deps.forge, location.owner);
          if (account === null) {
            entries[key] = {
              state: "error",
              error: `no ${name} account is configured for owner ${location.owner}`,
            };
            continue;
          }
          try {
            const token = await tokenFor(account);
            const info = await deps.client.getRepo(
              location.owner,
              location.repo,
              token,
            );
            if (info.fork && !isTracked(info, deps.forge.trackedForks)) {
              entries[key] = { state: "absent", reason: "fork-not-tracked" };
              continue;
            }
            const canonical = repoKey(info.owner, info.name);
            const existing = candidates.get(canonical);
            if (existing) {
              existing.aliases.push(key);
              continue;
            }
            candidates.set(canonical, {
              info,
              foundBy: "local-remote",
              account,
              aliases: canonical === key ? [] : [key],
            });
          } catch (error) {
            entries[key] = { state: "error", error: errorMessage(error) };
          }
        }
      }

      await mapWithLimit([...candidates], 8, async ([key, candidate]) => {
        let details: RawForgeRepo["details"];
        if (candidate.info.archived) {
          details = { state: "absent", reason: "archived-slow-lane" };
        } else {
          try {
            const token = await tokenFor(candidate.account);
            details = {
              state: "observed",
              value: await deps.client.readDetails(candidate.info, token),
            };
          } catch (error) {
            details = { state: "error", error: errorMessage(error) };
          }
        }
        entries[key] = {
          state: "observed",
          value: {
            info: candidate.info,
            foundBy: candidate.foundBy,
            account: candidate.account.account,
            aliases: candidate.aliases,
            details,
          },
        };
      });
      return sortedRecord(entries) as RawData[N];
    },
  };
}
