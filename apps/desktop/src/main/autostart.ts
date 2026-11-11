// The XDG autostart entry that starts the app at login. The settings page's login toggle reads
// whether it exists, and saving writes or removes it; every start points an existing entry at the
// running AppImage. Run from source there is no AppImage, so the entry is only ever read.

import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type LoginEntry, sourceRunHeld } from "@perch/core/settings-form.ts";

/** Where the entry lives: autostart/perch.desktop under an absolute XDG_CONFIG_HOME, else ~/.config. */
export function autostartPath(
  home: string,
  xdgConfigHome: string | undefined,
): string {
  const base = xdgConfigHome?.startsWith("/")
    ? xdgConfigHome
    : `${home}/.config`;
  return `${base}/autostart/perch.desktop`;
}

/** Characters the desktop entry spec says an Exec argument must be quoted to hold. */
const reserved = /[\s"'\\><~|&;$*?#()`]/;

/** One Exec argument, quoted when it holds a reserved character, its % doubled. */
function execArgument(argument: string): string {
  const literal = argument.replaceAll("%", "%%");
  if (!reserved.test(literal)) return literal;
  const quoted = `"${literal.replace(/["`$\\]/g, (char) => `\\${char}`)}"`;
  // The string escape applies over the quoting, so each backslash is written twice.
  return quoted.replaceAll("\\", "\\\\");
}

/** The entry's text: the image run hidden in the tray while the tray is on, else with the window open. */
export function entryText(image: string, tray: boolean): string {
  const exec = [execArgument(image), ...(tray ? ["--hidden"] : [])].join(" ");
  return `[Desktop Entry]\nType=Application\nName=Perch\nExec=${exec}\n`;
}

/** The program an entry's Exec runs, its quoting undone; null when it has no Exec line. */
export function execTarget(text: string): string | null {
  const line = text
    .split("\n")
    .find((candidate) => candidate.startsWith("Exec="));
  if (line === undefined) return null;
  const value = line.slice("Exec=".length).replaceAll("\\\\", "\\");
  if (!value.startsWith('"')) {
    return (value.split(/\s/)[0] ?? "").replaceAll("%%", "%");
  }
  let program = "";
  for (let at = 1; at < value.length; at += 1) {
    const char = value[at];
    if (char === '"') break;
    if (char === "\\") {
      at += 1;
      program += value[at] ?? "";
      continue;
    }
    program += char;
  }
  return program.replaceAll("%%", "%");
}

export interface AutostartDeps {
  /** Where the entry lives. */
  path: string;
  /** The running AppImage, from APPIMAGE; null when the app runs from source. */
  image: string | null;
  /** A file's text; null when it does not exist. */
  readText: (path: string) => Promise<string | null>;
  /** Replaces the file at the path itself in one step, a symlink there included. */
  writeText: (path: string, text: string) => Promise<void>;
  /** Removes the file at the path; resolves when there is none. */
  remove: (path: string) => Promise<void>;
}

export interface Autostart {
  /** The login row's state: whether the entry exists, the program it runs, and the hold without an image. */
  read(): Promise<LoginEntry>;
  /** Writes the entry for the tray setting while login is on, else removes it; nothing without an image. */
  save(window: { tray: boolean; login: boolean }): Promise<void>;
  /** Rewrites an existing entry to run the image with the tray setting; nothing without either. */
  repoint(tray: boolean): Promise<void>;
}

export function createAutostart(deps: AutostartDeps): Autostart {
  return {
    async read() {
      const text = await deps.readText(deps.path);
      return {
        on: text !== null,
        held: deps.image === null ? sourceRunHeld : null,
        path: deps.path,
        target: text === null ? null : execTarget(text),
      };
    },
    async save(window) {
      if (deps.image === null) return;
      if (!window.login) {
        await deps.remove(deps.path);
        return;
      }
      await deps.writeText(deps.path, entryText(deps.image, window.tray));
    },
    async repoint(tray) {
      if (deps.image === null) return;
      if ((await deps.readText(deps.path)) === null) return;
      await deps.writeText(deps.path, entryText(deps.image, tray));
    },
  };
}

/**
 * Writes a sibling file and renames it over the path, making the directory first. A symlink at the
 * path is replaced, never written through: it may name a file the app does not own.
 */
export async function replaceFile(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const partPath = `${path}.part`;
  await writeFile(partPath, text);
  await rename(partPath, path);
}

/** Removes the file at the path, a symlink itself rather than what it names; nothing when absent. */
export async function removeFile(path: string): Promise<void> {
  await rm(path, { force: true });
}
