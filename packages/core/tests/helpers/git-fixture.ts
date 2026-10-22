import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createGitRunner } from "../../src/sources/git.ts";

/** Environment that keeps fixture git away from the user's global and system config. */
export const isolatedGitEnv: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: tmpdir(),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
};

export const fixtureGit = createGitRunner(isolatedGitEnv);

export function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "perch-test-"));
}

export function removeDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

export function git(cwd: string, args: readonly string[], date?: Date): string {
  const env = date
    ? {
        ...isolatedGitEnv,
        GIT_AUTHOR_DATE: date.toISOString(),
        GIT_COMMITTER_DATE: date.toISOString(),
      }
    : isolatedGitEnv;
  return execFileSync("git", args, { cwd, env, encoding: "utf8" });
}

export function initRepo(path: string): string {
  mkdirSync(path, { recursive: true });
  git(path, ["init", "--quiet", "--initial-branch=main"]);
  return path;
}

export function writeFile(
  repo: string,
  file: string,
  content: string,
  mtime?: Date,
): void {
  const path = join(repo, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  if (mtime) utimesSync(path, mtime, mtime);
}

export function commit(
  repo: string,
  file: string,
  subject: string,
  date: Date,
): void {
  writeFile(repo, file, `${subject}\n`);
  git(repo, ["add", file]);
  git(repo, ["commit", "--quiet", "-m", subject], date);
}

/** A bare remote plus a clone of it, with one pushed commit on main. */
export function clonedRepo(
  base: string,
  date: Date,
): { remote: string; clone: string } {
  const remote = join(base, "remote.git");
  git(base, ["init", "--quiet", "--bare", "--initial-branch=main", remote]);
  const seed = initRepo(join(base, "seed"));
  commit(seed, "README.md", "Initial commit", date);
  git(seed, ["remote", "add", "origin", remote]);
  git(seed, ["push", "--quiet", "origin", "main"]);
  const clone = join(base, "clone");
  git(base, ["clone", "--quiet", remote, clone]);
  return { remote, clone };
}
