import type { Item, Remote } from "./snapshot.ts";

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

/** The first remote on one of the given hosts, origin first, with its parsed location. */
export function findForgeRemote(
  remotes: readonly Remote[],
  hosts: readonly string[],
): RemoteLocation | null {
  const ordered = [
    ...remotes.filter((remote) => remote.name === "origin"),
    ...remotes.filter((remote) => remote.name !== "origin"),
  ];
  for (const remote of ordered) {
    const location = parseRemoteUrl(remote.url);
    if (location && hosts.includes(location.host)) return location;
  }
  return null;
}

export interface ForgeTarget {
  itemId: string;
  location: RemoteLocation;
}

/** Items whose git data shows a remote on one of the given hosts; items without git data are skipped. */
export function forgeTargets(
  items: readonly Item[],
  hosts: readonly string[],
): ForgeTarget[] {
  return items.flatMap((item) => {
    const git = item.sources.git;
    if (git === undefined || "error" in git) return [];
    const location = findForgeRemote(git.remotes, hosts);
    return location ? [{ itemId: item.id, location }] : [];
  });
}
