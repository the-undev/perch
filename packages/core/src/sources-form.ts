// The sources as the settings page edits them: the kinds a card may be, a blank card of each, a
// card's heading and scan record id, and what a card's fields cannot be. The values are config's
// own source tables with paths written with ~. No Node modules, so the renderer may import it.

import type {
  ForgejoSourceConfig,
  GithubSourceConfig,
  KumaSourceConfig,
  LocalSourceConfig,
  SourcesConfig,
} from "./config.ts";
import { hostOf, sourceCardIds } from "./derivations.ts";
import type { SourceCardKind } from "./snapshot.ts";

/** One kind of source as the picker offers it. */
export interface SourceKindWords {
  kind: SourceCardKind;
  name: string;
  /** What a source of the kind reads, in one sentence. */
  reads: string;
  needs: string;
}

/** The kinds the picker offers, in its order; Uptime Kuma waits for server monitoring. */
export const pickerKinds: readonly SourceKindWords[] = [
  {
    kind: "local",
    name: "Local folders",
    reads:
      "Git repositories and Obsidian vaults under folders on this machine.",
    needs: "needs nothing",
  },
  {
    kind: "github",
    name: "GitHub",
    reads: "The repositories your accounts own: branches, CI, pull requests.",
    needs: "needs a read-only token",
  },
  {
    kind: "forgejo",
    name: "Forgejo",
    reads: "The same, from a Forgejo or Gitea server you run.",
    needs: "needs an address and a token",
  },
];

/** Every kind of source perch can read: the picker's, then Uptime Kuma, which a config may still declare. */
export const sourceKinds: readonly SourceKindWords[] = [
  ...pickerKinds,
  {
    kind: "kuma",
    name: "Uptime Kuma",
    reads: "One server's monitors, shown as a single bird.",
    needs: "needs an address",
  },
];

/** A kind's name on the page. */
export function kindName(kind: SourceCardKind): string {
  return sourceKinds.find((words) => words.kind === kind)?.name ?? kind;
}

/** One configured source table and where it sits among its kind's tables. */
export type SourceCardValues =
  | { kind: "local"; index: number; source: LocalSourceConfig }
  | { kind: "github"; index: number; source: GithubSourceConfig }
  | { kind: "forgejo"; index: number; source: ForgejoSourceConfig }
  | { kind: "kuma"; index: number; source: KumaSourceConfig };

/** Every source table as a card, in config order: local, github, forgejo, then kuma. */
export function sourceCardsOf(sources: SourcesConfig): SourceCardValues[] {
  return [
    ...sources.local.map(
      (source, index): SourceCardValues => ({ kind: "local", index, source }),
    ),
    ...sources.github.map(
      (source, index): SourceCardValues => ({ kind: "github", index, source }),
    ),
    ...sources.forgejo.map(
      (source, index): SourceCardValues => ({
        kind: "forgejo",
        index,
        source,
      }),
    ),
    ...sources.kuma.map(
      (source, index): SourceCardValues => ({ kind: "kuma", index, source }),
    ),
  ];
}

const replaced = <T>(list: readonly T[], index: number, entry: T): T[] =>
  list.map((candidate, at) => (at === index ? entry : candidate));

/** The sources with one card's table set to its values. */
export function withSourceCard(
  sources: SourcesConfig,
  card: SourceCardValues,
): SourcesConfig {
  switch (card.kind) {
    case "local":
      return {
        ...sources,
        local: replaced(sources.local, card.index, card.source),
      };
    case "github":
      return {
        ...sources,
        github: replaced(sources.github, card.index, card.source),
      };
    case "forgejo":
      return {
        ...sources,
        forgejo: replaced(sources.forgejo, card.index, card.source),
      };
    case "kuma":
      return {
        ...sources,
        kuma: replaced(sources.kuma, card.index, card.source),
      };
  }
}

/** The sources with a card of the kind, its fields empty, after the kind's last. */
export function withSourceAdded(
  sources: SourcesConfig,
  kind: SourceCardKind,
): SourcesConfig {
  const account = { account: "", key: "", hosts: [], trackedForks: [] };
  switch (kind) {
    case "local":
      return {
        ...sources,
        local: [...sources.local, { include: [], exclude: [] }],
      };
    case "github":
      return { ...sources, github: [...sources.github, account] };
    case "forgejo":
      return {
        ...sources,
        forgejo: [...sources.forgejo, { ...account, baseUrl: "" }],
      };
    case "kuma":
      return {
        ...sources,
        kuma: [...sources.kuma, { name: "", baseUrl: "", statusPage: "" }],
      };
  }
}

/** The sources without one card. */
export function withSourceRemoved(
  sources: SourcesConfig,
  kind: SourceCardKind,
  index: number,
): SourcesConfig {
  const without = <T>(list: readonly T[]) =>
    list.filter((_, at) => at !== index);
  switch (kind) {
    case "local":
      return { ...sources, local: without(sources.local) };
    case "github":
      return { ...sources, github: without(sources.github) };
    case "forgejo":
      return { ...sources, forgejo: without(sources.forgejo) };
    case "kuma":
      return { ...sources, kuma: without(sources.kuma) };
  }
}

/** The id of the scan record a card's values match, as the snapshot's source cards carry it. */
export function sourceCardId(card: SourceCardValues): string {
  switch (card.kind) {
    case "local":
      return sourceCardIds.local(card.source);
    case "github":
      return sourceCardIds.github(card.source);
    case "forgejo":
      return sourceCardIds.forgejo(card.source);
    case "kuma":
      return sourceCardIds.kuma(card.source);
  }
}

/** A card's heading: the kind, then the account, the host or the name once there is one. */
export function sourceHeading(card: SourceCardValues): string {
  const name = kindName(card.kind);
  const detail = (() => {
    switch (card.kind) {
      case "local":
        return "";
      case "github":
        return card.source.account.trim();
      case "forgejo":
        return hostOf(card.source.baseUrl.trim());
      case "kuma":
        return card.source.name.trim();
    }
  })();
  return detail === "" ? name : `${name} · ${detail}`;
}

/** A field of some kind of source table. */
export type SourceField =
  | "include"
  | "exclude"
  | "account"
  | "key"
  | "hosts"
  | "trackedForks"
  | "baseUrl"
  | "name"
  | "statusPage";

/** Each field's label on its card. */
export const sourceFieldLabels: Record<SourceField, string> = {
  include: "Folders perch searches",
  exclude: "Folders it excludes",
  account: "Account",
  key: "Keyring key",
  hosts: "Hosts",
  trackedForks: "Tracked forks",
  baseUrl: "Base URL",
  name: "Name",
  statusPage: "Status page",
};

/** Why one field of one card cannot be written. */
export interface SourceProblem {
  kind: SourceCardKind;
  index: number;
  field: SourceField;
  problem: string;
}

const isBlank = (text: string) => text.trim() === "";

const isAbsolute = (path: string) =>
  path.startsWith("/") || path === "~" || path.startsWith("~/");

/** Why a list of folders cannot be written, or null when it can. */
function foldersProblem(paths: readonly string[]): string | null {
  if (paths.some(isBlank)) return "a folder cannot be empty";
  if (!paths.every(isAbsolute)) return "each folder must start with / or ~";
  return null;
}

/** Why a base URL cannot be written, or null when it can. */
function addressProblem(url: string): string | null {
  if (isBlank(url)) return "needs an address";
  if (!/^https?:\/\//.test(url.trim())) {
    return "must start with http:// or https://";
  }
  return null;
}

/**
 * The cards whose identity repeats an earlier card's, by position, as the config parser refuses
 * them; a card with no identity yet (null) is left to the empty-field problems.
 */
function repeats<T>(
  sources: readonly T[],
  identity: (source: T) => string | null,
): number[] {
  const seen = new Set<string>();
  const repeated: number[] = [];
  sources.forEach((source, index) => {
    const id = identity(source);
    if (id === null) return;
    if (seen.has(id)) repeated.push(index);
    seen.add(id);
  });
  return repeated;
}

/** Why the sources cannot be written, field by field; empty when they can. */
export function sourceProblems(sources: SourcesConfig): SourceProblem[] {
  const problems: SourceProblem[] = [];
  const at =
    (kind: SourceCardKind, index: number) =>
    (field: SourceField, problem: string | null) => {
      if (problem !== null) problems.push({ kind, index, field, problem });
    };
  sources.local.forEach((source, index) => {
    const add = at("local", index);
    add(
      "include",
      source.include.length === 0
        ? "name at least one folder"
        : foldersProblem(source.include),
    );
    add("exclude", foldersProblem(source.exclude));
  });
  const accountProblems = (
    kind: "github" | "forgejo",
    source: GithubSourceConfig,
    index: number,
  ) => {
    const add = at(kind, index);
    add("account", isBlank(source.account) ? "needs an account" : null);
    add(
      "key",
      isBlank(source.key) ? "needs the keyring key holding the token" : null,
    );
    add("hosts", source.hosts.some(isBlank) ? "a host cannot be empty" : null);
    add(
      "trackedForks",
      source.trackedForks.some(isBlank) ? "a fork cannot be empty" : null,
    );
  };
  sources.github.forEach((source, index) => {
    accountProblems("github", source, index);
  });
  for (const index of repeats(sources.github, (source) =>
    isBlank(source.account) ? null : source.account.toLowerCase(),
  )) {
    at("github", index)("account", "another GitHub source reads this account");
  }
  sources.forgejo.forEach((source, index) => {
    at("forgejo", index)("baseUrl", addressProblem(source.baseUrl));
    accountProblems("forgejo", source, index);
  });
  for (const index of repeats(sources.forgejo, (source) =>
    isBlank(source.account)
      ? null
      : `${source.account.toLowerCase()} ${source.baseUrl}`,
  )) {
    at("forgejo", index)(
      "account",
      "another Forgejo source reads this account at this address",
    );
  }
  sources.kuma.forEach((source, index) => {
    const add = at("kuma", index);
    add("name", isBlank(source.name) ? "needs a name" : null);
    add("baseUrl", addressProblem(source.baseUrl));
    add(
      "statusPage",
      isBlank(source.statusPage) ? "needs the status page's slug" : null,
    );
  });
  for (const index of repeats(sources.kuma, (source) =>
    isBlank(source.name) ? null : source.name,
  )) {
    at("kuma", index)("name", "another Uptime Kuma source has this name");
  }
  return problems;
}

/** A source problem as one line naming its card and field. */
export function sourceProblemLine({
  kind,
  index,
  field,
  problem,
}: SourceProblem): string {
  const label = sourceFieldLabels[field];
  return `${kindName(kind)} source ${index + 1}, ${label.charAt(0).toLowerCase()}${label.slice(1)}: ${problem}`;
}

/** A forge card's draft values, as a connection test reads them. */
export type SourceTestValues =
  | { kind: "github"; account: string; key: string }
  | { kind: "forgejo"; account: string; key: string; baseUrl: string };

/** What storing a token answered: stored, or why not in a sentence. */
export type TokenStored = { ok: true } | { ok: false; problem: string };

/** What a connection test answered: the account's repositories it read, or why not. */
export type SourceTested =
  | { ok: true; count: number }
  | { ok: false; problem: string };

/** The keyring calls a forge card makes; neither ever answers with the token. */
export interface KeyringCalls {
  /** Writes a token into the keyring under service perch and the key. */
  storeToken(key: string, token: string): Promise<TokenStored>;
  /** Lists the account's repositories with the token stored under the card's key. */
  testSource(values: SourceTestValues): Promise<SourceTested>;
}
