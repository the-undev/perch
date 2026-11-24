// Repository references, the names config uses for what the scan finds. No Node modules, so config
// and the view model may import it.

import type { ForgeName } from "./raw.ts";
import type { Entity } from "./snapshot.ts";

/** Every repository reference an entity holds: its local repository's, then its forges'. */
export function entityRefs(entity: Entity): string[] {
  return [
    ...(entity.repositories.local ? [entity.repositories.local.ref] : []),
    ...entity.repositories.forges.map((repository) => repository.ref),
  ];
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

/**
 * The repository references a configured reference may name: a forge reference without case,
 * `local:<id>`, or a bare local id.
 */
export function candidateRefs(configured: string): [string, string] {
  return [normaliseRef(configured), localRef(configured)];
}
