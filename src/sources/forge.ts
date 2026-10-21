import { type ForgeConfig, hostAccounts } from "../config.ts";
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
import type { PolledSource } from "./source.ts";

/** What perch reads from a forge; GitHub and Forgejo each implement it. */
export interface ForgeClient {
  readonly forge: ForgeName;
  /** Every repository the account owns, forks and archived ones included. */
  listRepos(account: string): Promise<RawForgeRepoInfo[]>;
  getRepo(
    owner: string,
    name: string,
    account: string,
  ): Promise<RawForgeRepoInfo>;
  readDetails(
    info: RawForgeRepoInfo,
    account: string,
  ): Promise<RawForgeDetails>;
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

/**
 * Root collector: lists each configured account's repositories. Untracked forks are left out by
 * name; archived repositories are kept with their flag. A missing token fails the source.
 */
export function createForgeAccountsSource<
  N extends "githubAccounts" | "forgejoAccounts",
>(name: N, client: ForgeClient, forge: ForgeConfig): PolledSource<N> {
  return {
    name,
    async gather() {
      const entries: Record<string, Entry<RawForgeAccount, never>> = {};
      for (const { account } of forge.accounts) {
        try {
          const repos = await client.listRepos(account);
          const kept = repos.filter(
            (info) => !info.fork || isTracked(info, forge.trackedForks),
          );
          entries[account] = {
            state: "observed",
            value: {
              repos: kept.sort((a, b) => a.fullName.localeCompare(b.fullName)),
              skippedForks: repos
                .filter((info) => !kept.includes(info))
                .map((info) => info.fullName)
                .sort(),
            },
          };
        } catch (error) {
          if (error instanceof SourceFailure) throw error;
          entries[account] = { state: "error", error: errorMessage(error) };
        }
      }
      return entries as RawData[N];
    },
  };
}

interface Candidate {
  info: RawForgeRepoInfo;
  foundBy: RawForgeRepo["foundBy"];
  account: string;
  aliases: string[];
}

/**
 * Enricher: every listed repository, plus any repository a local clone's remote names on one of
 * this forge's hosts that the listings missed, with pull requests and CI for those not archived.
 */
export function createForgeSource<N extends ForgeName>(
  name: N,
  accountsName: N extends "github" ? "githubAccounts" : "forgejoAccounts",
  client: ForgeClient,
  forge: ForgeConfig,
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
      const accountFor = hostAccounts(forge);
      const candidates = new Map<string, Candidate>();
      for (const [account, entry] of Object.entries(
        earlier[accountsName]?.data ?? {},
      )) {
        if (entry.state !== "observed") continue;
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
          const account = location ? accountFor[location.host] : undefined;
          if (location === null || account === undefined) continue;
          const key = repoKey(location.owner, location.repo);
          if (candidates.has(key) || lookedUp.has(key)) continue;
          lookedUp.add(key);
          try {
            const info = await client.getRepo(
              location.owner,
              location.repo,
              account,
            );
            if (info.fork && !isTracked(info, forge.trackedForks)) {
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
            if (error instanceof SourceFailure) throw error;
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
            details = {
              state: "observed",
              value: await client.readDetails(
                candidate.info,
                candidate.account,
              ),
            };
          } catch (error) {
            if (error instanceof SourceFailure) throw error;
            details = { state: "error", error: errorMessage(error) };
          }
        }
        entries[key] = { state: "observed", value: { ...candidate, details } };
      });
      return sortedRecord(entries) as RawData[N];
    },
  };
}
