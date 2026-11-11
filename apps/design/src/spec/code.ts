// The real source files the Spec pages excerpt, read as text at build time.

import exampleConfig from "../../../../config.example.toml?raw";
import aggregate from "../../../../packages/core/src/aggregate.ts?raw";
import config from "../../../../packages/core/src/config.ts?raw";
import derivations from "../../../../packages/core/src/derivations.ts?raw";
import gather from "../../../../packages/core/src/gather.ts?raw";
import join from "../../../../packages/core/src/join.ts?raw";
import raw from "../../../../packages/core/src/raw.ts?raw";
import snapshot from "../../../../packages/core/src/snapshot.ts?raw";
import forge from "../../../../packages/core/src/sources/forge.ts?raw";
import forgejo from "../../../../packages/core/src/sources/forgejo.ts?raw";
import git from "../../../../packages/core/src/sources/git.ts?raw";
import github from "../../../../packages/core/src/sources/github.ts?raw";
import kuma from "../../../../packages/core/src/sources/kuma.ts?raw";
import local from "../../../../packages/core/src/sources/local.ts?raw";
import roadmap from "../../../../packages/core/src/sources/roadmap.ts?raw";
import speech from "../../../../packages/core/src/speech.ts?raw";
import viewmodel from "../../../../packages/core/src/viewmodel.ts?raw";
import { gatherRoundsFrom } from "../excerpt.ts";

/** Each source file by its path inside packages/core. */
export const coreFiles = {
  "src/raw.ts": raw,
  "src/snapshot.ts": snapshot,
  "src/derivations.ts": derivations,
  "src/gather.ts": gather,
  "src/join.ts": join,
  "src/aggregate.ts": aggregate,
  "src/viewmodel.ts": viewmodel,
  "src/speech.ts": speech,
  "src/config.ts": config,
  "src/sources/local.ts": local,
  "src/sources/git.ts": git,
  "src/sources/forge.ts": forge,
  "src/sources/github.ts": github,
  "src/sources/forgejo.ts": forgejo,
  "src/sources/roadmap.ts": roadmap,
  "src/sources/kuma.ts": kuma,
} as const;

export type CoreFile = keyof typeof coreFiles;

/** config.example.toml at the repository root. */
export const exampleConfigText = exampleConfig;

/** The gather's rounds as gather.ts declares them: root collectors, then enrichers. */
export const gatherRounds = gatherRoundsFrom(gather);

/** Which round a polled source runs in, counted from one. */
export function roundOf(source: string): number {
  return gatherRounds.findIndex((round) => round.includes(source)) + 1;
}
