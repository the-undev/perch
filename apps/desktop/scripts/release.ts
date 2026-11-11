// Releases the app: `pnpm release <version>` from the repository root. It checks the repository,
// bumps the version on a release branch, runs the checks, merges to main, then pushes and tags.

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Version = readonly [major: number, minor: number, patch: number];

export interface GitState {
  branch: string;
  statusOutput: string;
  localMainCommit: string;
  originMainCommit: string;
  localTagOutput: string;
  remoteTagOutput: string;
}

const repository = "the-undev/perch";

/** Parses `x.y.z`; prereleases and build metadata are rejected. */
export function parseVersion(text: string): Version | null {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(text);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True when `candidate` is strictly greater than `current`. */
export function isGreater(candidate: Version, current: Version): boolean {
  for (const index of [0, 1, 2] as const) {
    if (candidate[index] !== current[index]) {
      return candidate[index] > current[index];
    }
  }
  return false;
}

/** Returns a one-line refusal, or null when the release may go ahead. */
export function evaluatePreChecks(
  versionText: string,
  currentVersionText: string,
  state: GitState,
): string | null {
  const version = parseVersion(versionText);
  if (!version) {
    return `"${versionText}" is not a version of the form x.y.z (prereleases are not supported).`;
  }
  const currentVersion = parseVersion(currentVersionText);
  if (!currentVersion) {
    return `The current version "${currentVersionText}" in apps/desktop/package.json is not x.y.z.`;
  }
  if (!isGreater(version, currentVersion)) {
    return `Version ${versionText} must be greater than the current version ${currentVersionText}.`;
  }
  if (state.branch !== "main") {
    return `Releases run from main, but the current branch is "${state.branch}".`;
  }
  if (state.statusOutput.trim() !== "") {
    return "The working tree has uncommitted changes.";
  }
  if (state.localMainCommit !== state.originMainCommit) {
    return "Local main differs from origin/main: pull or push first.";
  }
  const tag = `v${versionText}`;
  if (state.remoteTagOutput.trim() !== "") {
    return `Tag ${tag} already exists on origin.`;
  }
  if (state.localTagOutput.trim() !== "") {
    return `Tag ${tag} already exists locally.`;
  }
  return null;
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/** Fetches origin and reads everything the pre-checks need. */
export function gatherGitState(cwd: string, versionText: string): GitState {
  const tag = `v${versionText}`;
  git(cwd, ["fetch", "origin"]);
  return {
    branch: git(cwd, ["branch", "--show-current"]),
    statusOutput: git(cwd, ["status", "--porcelain"]),
    localMainCommit: git(cwd, ["rev-parse", "main"]),
    originMainCommit: git(cwd, ["rev-parse", "origin/main"]),
    localTagOutput: git(cwd, ["tag", "--list", tag]),
    remoteTagOutput: git(cwd, [
      "ls-remote",
      "--tags",
      "origin",
      `refs/tags/${tag}`,
    ]),
  };
}

interface Step {
  label: string;
  command: string;
  args: string[];
  run?: () => void;
}

function readPackageVersion(packagePath: string): string {
  return JSON.parse(readFileSync(packagePath, "utf8")).version;
}

function writePackageVersion(packagePath: string, version: string) {
  const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
  manifest.version = version;
  writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function findTagRunId(cwd: string, tag: string): string {
  for (let attempt = 0; attempt < 30; attempt++) {
    const output = execFileSync(
      "gh",
      [
        "run",
        "list",
        "-R",
        repository,
        "--branch",
        tag,
        "--limit",
        "1",
        "--json",
        "databaseId",
      ],
      { cwd, encoding: "utf8" },
    );
    const runs: { databaseId: number }[] = JSON.parse(output);
    if (runs[0]) return String(runs[0].databaseId);
    spawnSync("sleep", ["2"]);
  }
  throw new Error(`No workflow run appeared for ${tag}.`);
}

function main(versionText: string) {
  const root = join(import.meta.dirname, "..", "..", "..");
  const packagePath = join(root, "apps", "desktop", "package.json");
  const tag = `v${versionText}`;
  const branch = `release-${versionText}`;

  const refusal = evaluatePreChecks(
    versionText,
    readPackageVersion(packagePath),
    gatherGitState(root, versionText),
  );
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }

  const steps: Step[] = [
    {
      label: "Create the release branch",
      command: "git",
      args: ["switch", "-c", branch],
    },
    {
      label: "Set the app version",
      command: "apps/desktop/package.json",
      args: [versionText],
      run: () => writePackageVersion(packagePath, versionText),
    },
    { label: "Run the checks", command: "pnpm", args: ["check"] },
    {
      label: "Commit the version bump",
      command: "git",
      args: ["commit", "-am", `Bump the app version to ${versionText}`],
    },
    { label: "Switch to main", command: "git", args: ["switch", "main"] },
    {
      label: "Merge the release branch",
      command: "git",
      args: ["merge", "--no-ff", branch, "-m", `Merge ${branch}`],
    },
    { label: "Push main", command: "git", args: ["push", "origin", "main"] },
    {
      label: "Delete the release branch",
      command: "git",
      args: ["branch", "-d", branch],
    },
    { label: "Tag the release", command: "git", args: ["tag", tag] },
    { label: "Push the tag", command: "git", args: ["push", "origin", tag] },
    {
      label: "Watch the release run",
      command: "gh",
      args: ["run", "watch", "-R", repository],
      run: () => {
        const runId = findTagRunId(root, tag);
        execFileSync(
          "gh",
          ["run", "watch", runId, "--exit-status", "-R", repository],
          {
            cwd: root,
            stdio: "inherit",
          },
        );
      },
    },
  ];
  const pushMainIndex = steps.findIndex((step) => step.label === "Push main");

  for (const [index, step] of steps.entries()) {
    console.log(
      `\n[${index + 1}/${steps.length}] ${step.label}: ${step.command} ${step.args.join(" ")}`,
    );
    try {
      if (step.run) step.run();
      else
        execFileSync(step.command, step.args, { cwd: root, stdio: "inherit" });
    } catch {
      console.error(`\nStep failed: ${step.label}.`);
      if (index < pushMainIndex) {
        console.error(
          `Nothing has been pushed. To recover: git restore . && git switch main && git branch -D ${branch}`,
        );
      } else {
        console.error("Run the remaining steps by hand:");
        for (const rest of steps.slice(index)) {
          if (rest.run) continue;
          console.error(`  ${rest.command} ${rest.args.join(" ")}`);
        }
        console.error(`  gh run watch -R ${repository}`);
      }
      process.exit(1);
    }
  }
}

if (import.meta.main) {
  const versionText = process.argv[2];
  if (!versionText) {
    console.error("Usage: pnpm release <version>");
    process.exit(1);
  }
  main(versionText);
}
