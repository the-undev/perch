// Linking repositories into projects. Pure: it reads raw repositories and config assertions,
// and the rules here decide which repositories are one project. Observation beats assertion;
// every disagreement is recorded.

import type {
  ForgeName,
  RawForgeLookupError,
  RawForgeRepo,
  RawLocalRepository,
} from "./raw.ts";
import { candidateRefs, forgeRef, localRef } from "./refs.ts";
import { parseRemoteUrl, remoteUrls } from "./remote-url.ts";
import type { ConfigConflict, EntityFlag } from "./snapshot.ts";
import { repoKey } from "./sources/forge.ts";

export interface LocalInput {
  id: string;
  repository: RawLocalRepository;
}

export interface ForgeInput {
  forge: ForgeName;
  /** Lower-case owner/name. */
  key: string;
  /** The repository as read, or the error that kept a remote's repository from being read. */
  repo: { state: "observed"; value: RawForgeRepo } | RawForgeLookupError;
}

/** Whether a forge repository was read and is archived; one that could not be read is not. */
export function isArchived(repository: ForgeInput): boolean {
  return (
    repository.repo.state === "observed" && repository.repo.value.info.archived
  );
}

/** A forge repository's owner/name as the forge spells it, else its lower-case key. */
export function fullNameOf(repository: ForgeInput): string {
  return repository.repo.state === "observed"
    ? repository.repo.value.info.fullName
    : repository.key;
}

/** The other keys local remotes used for a repository; none for one that could not be read. */
function aliasesOf(repository: ForgeInput): string[] {
  return repository.repo.state === "observed"
    ? repository.repo.value.aliases
    : [];
}

export interface Project {
  /** Every repository reference in the project. */
  refs: string[];
  local: LocalInput | null;
  forges: ForgeInput[];
  flags: EntityFlag[];
}

export interface LinkInput {
  locals: readonly LocalInput[];
  forges: readonly ForgeInput[];
  /** Which forge a remote host or SSH alias belongs to, or null for none perch reads. */
  forgeForHost: (host: string) => ForgeName | null;
  links: readonly (readonly string[])[];
  ignore: readonly string[];
}

export interface LinkResult {
  projects: Project[];
  /** Forge repositories on no project: archived ones and ignored forge-only ones. */
  unlisted: ForgeInput[];
  ignored: Set<string>;
  conflicts: ConfigConflict[];
  /** Which project each repository reference ended up in. */
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
 * Links repositories into projects.
 *
 * - A local repository links each forge repository one of its remote URLs names, fetch and push
 *   alike, origin first, so a dual-push remote links both forges. Archived repositories link
 *   nothing; the local repository is flagged remote-archived. A forge repository already linked
 *   to another local repository stays there and this one is flagged remote-linked-elsewhere.
 * - Forge repositories no local repository linked are projects of their own; two never link
 *   each other unless config asserts it.
 * - An asserted link merges the named repositories' projects, unless a repository was not
 *   observed or the merge would put two local repositories in one project. Either way the
 *   assertion loses and the conflict is recorded.
 * - An ignored repository's forge-only project leaves the entity list. Ignoring a repository a
 *   local repository uses, or one not observed, is a conflict.
 * - Links and ignores name a repository by any of its references: a forge reference without
 *   case, `local:<id>`, or the bare local id.
 */
export function linkRepositories(input: LinkInput): LinkResult {
  const byRef = new Map<string, ForgeInput>();
  const archived = new Map<string, ForgeInput>();
  for (const repository of input.forges) {
    const target = isArchived(repository) ? archived : byRef;
    target.set(forgeRef(repository.forge, repository.key), repository);
    for (const alias of aliasesOf(repository)) {
      target.set(forgeRef(repository.forge, alias), repository);
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
    const git = local.repository.git;
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
      const archivedRepository = archived.get(ref);
      if (archivedRepository) {
        project.flags.push({
          flag: "remote-archived",
          level: null,
          detail: `${remote.name} is ${fullNameOf(archivedRepository)}, archived on ${forge}`,
        });
        continue;
      }
      const repository = byRef.get(ref);
      if (repository === undefined) continue;
      const canonical = forgeRef(repository.forge, repository.key);
      const owner = projectOf.get(canonical);
      if (owner === project) continue;
      if (owner !== undefined) {
        project.flags.push({
          flag: "remote-linked-elsewhere",
          level: null,
          detail: `${remote.name} is ${fullNameOf(repository)}, already linked to ${owner.refs[0]}`,
        });
        continue;
      }
      project.forges.push(repository);
      project.refs.push(canonical);
      projectOf.set(canonical, project);
    }
  }

  for (const repository of input.forges) {
    const ref = forgeRef(repository.forge, repository.key);
    if (isArchived(repository) || projectOf.has(ref)) continue;
    const project: Project = {
      refs: [ref],
      local: null,
      forges: [repository],
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

  for (const group of input.links) {
    const assertion = `links ${JSON.stringify(group)}`;
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
        "it would link two local repositories into one project",
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
    (repository) => !projectOf.has(forgeRef(repository.forge, repository.key)),
  );
  return { projects, unlisted, ignored, conflicts, projectOf };
}
