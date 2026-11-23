import { constants } from "node:fs";
import {
  chmod,
  copyFile,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  type Config,
  configVersion,
  parseConfig,
  parseVersionedConfig,
} from "@perch/core/config.ts";
import { writeConfig } from "@perch/core/config-write.ts";

/** A change to config, made to a fresh read of the file. */
export type ConfigEdit = (config: Config) => Config;

export interface ConfigFileDeps {
  /** The home directory a leading ~ in config paths expands to. */
  home: string;
  /** The owner's config, the only file edited. */
  path: string;
  /** A file's text; null when it does not exist. */
  readText: (path: string) => Promise<string | null>;
  /** Replaces a file's text in one step. */
  writeText: (path: string, text: string) => Promise<void>;
}

/**
 * Reads the config file afresh, applies the edit and writes the result back; rejects, writing
 * nothing, when the file is missing, does not parse, is older than configVersion, or the edited
 * config would not read back.
 */
export async function editConfigFile(
  deps: ConfigFileDeps,
  edit: ConfigEdit,
): Promise<void> {
  const text = await deps.readText(deps.path);
  if (text === null) throw new Error(`${deps.path} does not exist`);
  const { config, fileVersion } = parseVersionedConfig(text, deps.home);
  if (fileVersion < configVersion) {
    throw new Error(
      `config: version ${fileVersion} is older than this perch edits, version ${configVersion}`,
    );
  }
  const next = writeConfig(edit(config), deps.home);
  parseConfig(next, deps.home);
  await deps.writeText(deps.path, next);
}

/**
 * Writes a sibling file and renames it over the target, so a reader never sees half a file.
 * A symlink is followed to the file it names, which keeps a stowed config stowed, and the
 * file keeps its mode.
 */
export async function writeTextAtomic(
  path: string,
  text: string,
): Promise<void> {
  const target = await realpath(path);
  const { mode } = await stat(target);
  const partPath = `${target}.part`;
  await writeFile(partPath, text);
  await chmod(partPath, mode & 0o7777);
  await rename(partPath, target);
}

/** Copies a file's bytes to a path that does not exist; rejects with code EEXIST when it does. */
export async function copyToNewFile(from: string, to: string): Promise<void> {
  await copyFile(from, to, constants.COPYFILE_EXCL);
}
