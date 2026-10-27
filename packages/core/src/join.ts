// Joining presences into projects. Pure: it reads raw presences and config assertions, and the
// rules here decide which presences are one project. Observation beats assertion; every
// disagreement is recorded.

import type {
  ForgeName,
  RawForgeLookupError,
  RawForgeRepo,
  RawLocalPresence,
} from "./raw.ts";
import { candidateRefs, forgeRef, localRef } from "./refs.ts";
import { parseRemoteUrl, remoteUrls } from "./remote-url.ts";
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
  /** The repository as read, or the error that kept a remote's repository from being read. */
  repo: { state: "observed"; value: RawForgeRepo } | RawForgeLookupError;
}

/** Whether a forge presence was read and is archived; one that could not be read is not. */
export function isArchived(presence: ForgeInput): boolean {
  return (
    presence.repo.state === "observed" && presence.repo.value.info.archived
  );
}

/** A forge presence's owner/name as the forge spells it, else its lower-case key. */
export function fullNameOf(presence: ForgeInput): string {
  return presence.repo.state === "observed"
    ? presence.repo.value.info.fullName
    : presence.key;
}

/** The other keys local remotes used for a presence; none for one that could not be read. */
function aliasesOf(presence: ForgeInput): string[] {
  return presence.repo.state === "observed" ? presence.repo.value.aliases : [];
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
 * - A local clone joins each forge presence one of its remote URLs names, fetch and push alike,
 *   origin first, so a dual-push remote joins both forges. Archived
 *   presences join nothing; the clone is flagged remote-archived. A presence already joined to
 *   another clone stays there and this clone is flagged remote-joined-elsewhere.
 * - Forge presences no clone joined are projects of their own; two never join each other
 *   unless config asserts it.
 * - An asserted join merges the named presences' projects, unless a presence was not observed
 *   or the merge would put two local clones in one project. Either way the assertion loses and
 *   the conflict is recorded.
 * - An ignored presence's forge-only project leaves the item list. Ignoring a presence a local
 *   clone uses, or one not observed, is a conflict.
 * - Joins and ignores name a presence by any of its references: a forge reference without case,
 *   `local:<id>`, or the bare local id.
 */
export function joinPresences(input: JoinInput): JoinResult {
  const byRef = new Map<string, ForgeInput>();
  const archived = new Map<string, ForgeInput>();
  for (const presence of input.forges) {
    const target = isArchived(presence) ? archived : byRef;
    target.set(forgeRef(presence.forge, presence.key), presence);
    for (const alias of aliasesOf(presence)) {
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
    for (const [remote, url] of ordered.flatMap((entry) =>
      remoteUrls(entry).map((each) => [entry, each] as const),
    )) {
      const location = parseRemoteUrl(url);
      const forge = location ? input.forgeForHost(location.host) : null;
      if (location === null || forge === null) continue;
      const ref = forgeRef(forge, repoKey(location.owner, location.repo));
      const archivedPresence = archived.get(ref);
      if (archivedPresence) {
        project.flags.push({
          flag: "remote-archived",
          level: null,
          detail: `${remote.name} is ${fullNameOf(archivedPresence)}, archived on ${forge}`,
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
          detail: `${remote.name} is ${fullNameOf(presence)}, already joined to ${owner.refs[0]}`,
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
    if (isArchived(presence) || projectOf.has(ref)) continue;
    const project: Project = {
      refs: [ref],
      local: null,
      forges: [presence],
      flags: [],
    };
    projects.push(project);
    projectOf.set(ref, project);
  }

  /** The reference a configured one names: one on a project, else an archived one, else normalised. */
  const named = (configured: string): string => {
    const candidates = candidateRefs(configured);
    return (
      candidates.find((ref) => projectOf.has(ref)) ??
      candidates.find((ref) => archived.has(ref)) ??
      candidates[0]
    );
  };

  for (const group of input.joins) {
    const assertion = `joins ${JSON.stringify(group)}`;
    const refs = group.map(named);
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
    const ref = named(configured);
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
