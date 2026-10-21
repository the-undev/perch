import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { errorMessage, fileMtime, nullIfMissing } from "../fs.ts";
import type { RawClaudeSessions, RawEntries, RawTranscript } from "../raw.ts";
import type { PolledSource } from "./source.ts";

/**
 * The directory name Claude Code uses for a working directory under ~/.claude/projects.
 * Every character other than a letter or digit becomes a hyphen, so /home/owner/.dotfiles
 * becomes -home-owner--dotfiles.
 */
export function encodeProjectPath(path: string): string {
  return path.replace(/[^A-Za-z0-9]/g, "-");
}

/** Lists the session transcripts for a working directory with their modification times. */
export async function readSessions(
  projectsDir: string,
  projectPath: string,
): Promise<RawClaudeSessions> {
  const directory = encodeProjectPath(projectPath);
  const names = await nullIfMissing(() =>
    readdir(join(projectsDir, directory)),
  );
  if (names === null) {
    return {
      directory,
      transcripts: { state: "absent", reason: "no-project-directory" },
    };
  }
  const transcripts: RawTranscript[] = [];
  for (const file of names.filter((name) => name.endsWith(".jsonl")).sort()) {
    const mtime = await fileMtime(join(projectsDir, directory, file));
    if (mtime !== null) transcripts.push({ file, mtime: mtime.toISOString() });
  }
  return { directory, transcripts: { state: "observed", value: transcripts } };
}

/** Lists Claude Code session transcripts for every item with a path. */
export function createClaudeSessionsSource(
  projectsDir: string,
): PolledSource<"claudeSessions"> {
  return {
    name: "claudeSessions",
    async gather(items) {
      const entries: Record<string, RawEntries["claudeSessions"]> = {};
      for (const item of items) {
        if (item.kind === "server") continue;
        try {
          entries[item.id] = {
            state: "observed",
            value: await readSessions(projectsDir, item.path),
          };
        } catch (error) {
          entries[item.id] = { state: "error", error: errorMessage(error) };
        }
      }
      return entries;
    },
  };
}
