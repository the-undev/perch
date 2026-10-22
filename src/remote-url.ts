import type { RawRemote } from "./raw.ts";

/** A remote's distinct URLs, fetch first, then each push URL. */
export function remoteUrls(remote: RawRemote): string[] {
  return [...new Set([remote.fetchUrl, ...remote.pushUrls])];
}

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
