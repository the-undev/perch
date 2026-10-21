import type { RawEntries, RawForgeRemote, RawRemote } from "./raw.ts";

export interface RemoteLocation {
  /** Host name or SSH alias, without user or port. */
  host: string;
  owner: string;
  repo: string;
}

const urlPattern =
  /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i;
const scpPattern = /^(?:[^@/]+@)?([^/:]+):(?!\/\/)(.+)$/;

/** Parses an owner/repo remote in URL or scp-like form; null for anything else, such as a local path. */
export function parseRemoteUrl(url: string): RemoteLocation | null {
  const match = urlPattern.exec(url) ?? scpPattern.exec(url);
  if (!match) return null;
  const segments = (match[2] ?? "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .split("/");
  if (segments.length !== 2 || segments.some((segment) => segment === "")) {
    return null;
  }
  const [owner = "", repo = ""] = segments;
  return { host: match[1] ?? "", owner, repo };
}

/** The first remote on one of the given hosts, origin first. */
export function findForgeRemote(
  remotes: readonly RawRemote[],
  hosts: readonly string[],
): RawForgeRemote | null {
  const ordered = [
    ...remotes.filter((remote) => remote.name === "origin"),
    ...remotes.filter((remote) => remote.name !== "origin"),
  ];
  for (const remote of ordered) {
    const location = parseRemoteUrl(remote.url);
    if (location && hosts.includes(location.host)) {
      return { remoteName: remote.name, ...location };
    }
  }
  return null;
}

export type ForgeLookup =
  | { state: "remote"; remote: RawForgeRemote }
  | { state: "no-remote" }
  | { state: "no-git-data" };

/** Finds an item's forge remote from its raw git entry. */
export function forgeRemoteFor(
  gitEntry: RawEntries["git"] | undefined,
  hosts: readonly string[],
): ForgeLookup {
  if (gitEntry === undefined || gitEntry.state !== "observed") {
    return { state: "no-git-data" };
  }
  const remotes = gitEntry.value.remotes;
  const remote =
    remotes.state === "observed" ? findForgeRemote(remotes.value, hosts) : null;
  return remote ? { state: "remote", remote } : { state: "no-remote" };
}
