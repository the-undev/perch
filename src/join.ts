// Joining presences into projects. Pure: it reads raw presences and config assertions, and the
// rules here decide which presences are one project. Observation beats assertion; every
// disagreement is recorded.

import type { ForgeName, RawForgeRepo, RawLocalPresence } from "./raw.ts";
import { parseRemoteUrl } from "./remote-url.ts";
import type { ConfigConflict, ItemFlag } from "./snapshot.ts";
import { repoKey } from "./sources/forge.ts";

export interface LocalInput {
  id: string;
  presence: RawLocalPresence;
}

export interface ForgeInput {
  forge: ForgeName;
  /** Lower-case owner/name. */
  key: string;
  repo: RawForgeRepo;
}

export interface Project {
  /** Every presence reference in the project. */
  refs: string[];
  local: LocalInput | null;
  forges: ForgeInput[];
  flags: ItemFlag[];
}

export interface JoinInput {
  locals: readonly LocalInput[];
  forges: readonly ForgeInput[];
  /** Which forge a remote host or SSH alias belongs to, or null for none perch reads. */
  forgeForHost: (host: string) => ForgeName | null;
  joins: readonly (readonly string[])[];
  ignore: readonly string[];
}

export interface JoinResult {
  projects: Project[];
  /** Forge presences on no project: archived ones and ignored forge-only ones. */
  unlisted: ForgeInput[];
  ignored: Set<string>;
  conflicts: ConfigConflict[];
  /** Which project each presence reference ended up in. */
  projectOf: Map<string, Project>;
}

export function localRef(id: string): string {
  return `local:${id}`;
}

export function forgeRef(forge: ForgeName, key: string): string {
  return `${forge}:${key}`;
}

/** Normalises a configured reference: forge owner/name parts compare without case. */
export function normaliseRef(ref: string): string {
  const match = /^(github|forgejo):(.+)$/.exec(ref);
  return match ? `${match[1]}:${(match[2] ?? "").toLowerCase()}` : ref;
}

function conflict(
  conflicts: ConfigConflict[],
  assertion: string,
  detail: string,
  projects: readonly Project[],
): void {
  conflicts.push({ assertion, detail });
  for (const project of projects) {
    project.flags.push({
      flag: "config-conflict",
      level: null,
      detail: `${assertion}: ${detail}`,
    });
  }
}

/**
 * Joins presences into projects.
 *
 * - A local clone joins each forge presence one of its remote URLs names, origin first. Archived
 *   presences join nothing; the clone is flagged remote-archived. A presence already joined to
 *   another clone stays there and this clone is flagged remote-joined-elsewhere.
 * - Forge presences no clone joined are projects of their own; two never join each other
 *   unless config asserts it.
 * - An asserted join merges the named presences' projects, unless a presence was not observed
 *   or the merge would put two local clones in one project. Either way the assertion loses and
 *   the conflict is recorded.
 * - An ignored presence's forge-only project leaves the item list. Ignoring a presence a local
 *   clone uses, or one not observed, is a conflict.
 */
export function joinPresences(input: JoinInput): JoinResult {
  const byRef = new Map<string, ForgeInput>();
  const archived = new Map<string, ForgeInput>();
  for (const presence of input.forges) {
    const target = presence.repo.info.archived ? archived : byRef;
    target.set(forgeRef(presence.forge, presence.key), presence);
    for (const alias of presence.repo.aliases) {
      target.set(forgeRef(presence.forge, alias), presence);
    }
  }

  const projects: Project[] = [];
  const projectOf = new Map<string, Project>();
  const conflicts: ConfigConflict[] = [];

  for (const local of input.locals) {
    const project: Project = {
      refs: [localRef(local.id)],
      local,
      forges: [],
      flags: [],
    };
    projects.push(project);
    projectOf.set(localRef(local.id), project);
    const git = local.presence.git;
    if (git.state !== "observed" || git.value.remotes.state !== "observed")
      continue;
    const remotes = git.value.remotes.value;
    const ordered = [
      ...remotes.filter((remote) => remote.name === "origin"),
      ...remotes.filter((remote) => remote.name !== "origin"),
    ];
    for (const remote of ordered) {
      const location = parseRemoteUrl(remote.url);
      const forge = location ? input.forgeForHost(location.host) : null;
      if (location === null || forge === null) continue;
      const ref = forgeRef(forge, repoKey(location.owner, location.repo));
      const archivedPresence = archived.get(ref);
      if (archivedPresence) {
        project.flags.push({
          flag: "remote-archived",
          level: null,
          detail: `${remote.name} is ${archivedPresence.repo.info.fullName}, archived on ${forge}`,
        });
        continue;
      }
      const presence = byRef.get(ref);
      if (presence === undefined) continue;
      const canonical = forgeRef(presence.forge, presence.key);
      const owner = projectOf.get(canonical);
      if (owner === project) continue;
      if (owner !== undefined) {
        project.flags.push({
          flag: "remote-joined-elsewhere",
          level: null,
          detail: `${remote.name} is ${presence.repo.info.fullName}, already joined to ${owner.refs[0]}`,
        });
        continue;
      }
      project.forges.push(presence);
      project.refs.push(canonical);
      projectOf.set(canonical, project);
    }
  }

  for (const presence of input.forges) {
    const ref = forgeRef(presence.forge, presence.key);
    if (presence.repo.info.archived || projectOf.has(ref)) continue;
    const project: Project = {
      refs: [ref],
      local: null,
      forges: [presence],
      flags: [],
    };
    projects.push(project);
    projectOf.set(ref, project);
  }

  for (const group of input.joins) {
    const assertion = `joins ${JSON.stringify(group)}`;
    const refs = group.map(normaliseRef);
    const missing = refs.filter((ref) => !projectOf.has(ref));
    if (missing.length > 0) {
      const detail = missing
        .map((ref) =>
          archived.has(ref) ? `${ref} is archived` : `${ref} was not observed`,
        )
        .join("; ");
      conflict(conflicts, assertion, detail, []);
      continue;
    }
    const distinct = [
      ...new Set(refs.map((ref) => projectOf.get(ref) as Project)),
    ];
    const withLocal = distinct.filter((project) => project.local !== null);
    if (withLocal.length > 1) {
      conflict(
        conflicts,
        assertion,
        "it would join two local clones into one project",
        withLocal,
      );
      continue;
    }
    const target = withLocal[0] ?? (distinct[0] as Project);
    for (const other of distinct) {
      if (other === target) continue;
      target.forges.push(...other.forges);
      target.refs.push(...other.refs);
      target.flags.push(...other.flags);
      for (const ref of other.refs) projectOf.set(ref, target);
      projects.splice(projects.indexOf(other), 1);
    }
  }

  const ignored = new Set<string>();
  for (const configured of input.ignore) {
    const ref = normaliseRef(configured);
    const assertion = `ignore ${JSON.stringify(configured)}`;
    if (archived.has(ref)) {
      ignored.add(ref);
      continue;
    }
    const project = projectOf.get(ref);
    if (project === undefined) {
      conflict(conflicts, assertion, `${ref} was not observed`, []);
      continue;
    }
    if (project.local !== null) {
      conflict(
        conflicts,
        assertion,
        `${project.refs[0]} uses it, so it stays`,
        [project],
      );
      continue;
    }
    projects.splice(projects.indexOf(project), 1);
    for (const member of project.refs) {
      ignored.add(member);
      projectOf.delete(member);
    }
  }

  const unlisted = input.forges.filter(
    (presence) => !projectOf.has(forgeRef(presence.forge, presence.key)),
  );
  return { projects, unlisted, ignored, conflicts, projectOf };
}
