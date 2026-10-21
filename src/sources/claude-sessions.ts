import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { errorMessage, fileMtime, nullIfMissing } from "../fs.ts";
import type { ClaudeSessionsData, ItemError } from "../snapshot.ts";
import type { PolledSource } from "./source.ts";

/**
 * The directory name Claude Code uses for a working directory under ~/.claude/projects.
 * Every character other than a letter or digit becomes a hyphen, so /home/owner/.dotfiles
 * becomes -home-owner--dotfiles.
 */
export function encodeProjectPath(path: string): string {
  return path.replace(/[^A-Za-z0-9]/g, "-");
}

/** The newest modification time of the session transcripts for a working directory. */
export async function lastSessionAt(
  projectsDir: string,
  projectPath: string,
): Promise<Date | null> {
  const directory = join(projectsDir, encodeProjectPath(projectPath));
  const names = (await nullIfMissing(() => readdir(directory))) ?? [];
  const mtimes = await Promise.all(
    names
      .filter((name) => name.endsWith(".jsonl"))
      .map((name) => fileMtime(join(directory, name))),
  );
  const times = mtimes
    .filter((mtime): mtime is Date => mtime !== null)
    .map((mtime) => mtime.getTime());
  return times.length === 0 ? null : new Date(Math.max(...times));
}

/** Reads the last Claude Code session time for every item with a path. */
export function createClaudeSessionsSource(
  projectsDir: string,
): PolledSource<"claudeSessions"> {
  return {
    name: "claudeSessions",
    async scan(items) {
      const results = new Map<string, ClaudeSessionsData | ItemError>();
      for (const item of items) {
        if (item.path === null) continue;
        try {
          const last = await lastSessionAt(projectsDir, item.path);
          results.set(item.id, { lastSessionAt: last?.toISOString() ?? null });
        } catch (error) {
          results.set(item.id, { error: errorMessage(error) });
        }
      }
      return results;
    },
  };
}
