// What the design site has to put on a bird's paper: this repository's own README, spec and
// roadmap stand in for the mock Perch bird's key files. No other file is read, so every other
// sheet says it could not be.

import type { Bird, KeyFile } from "@perch/core/viewmodel.ts";
import type { KeyFileSheet } from "@perch/ui/paper.tsx";
import roadmap from "../../../docs/roadmap.md?raw";
import spec from "../../../docs/spec.md?raw";
import readme from "../../../README.md?raw";

/** The files the design site can read, by their path inside the Perch bird. */
export const perchFiles: Record<string, string> = {
  "README.md": readme,
  "docs/spec.md": spec,
  "docs/roadmap.md": roadmap,
};

/** Each key file with what was read from it, from the contents given. */
export function sheetsFor(
  files: KeyFile[],
  contents: Record<string, string>,
): KeyFileSheet[] {
  return files.map((file) => ({ file, markdown: contents[file.path] ?? null }));
}

/** A bird's sheets as the design site can read them: Perch's from this repository, none other. */
export function birdSheets(bird: Bird): KeyFileSheet[] {
  return sheetsFor(
    bird.detail.keyFiles,
    bird.id === "dev/perch" ? perchFiles : {},
  );
}
