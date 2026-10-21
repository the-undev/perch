import { open, readdir } from "node:fs/promises";
import { join } from "node:path";
import { errorMessage, fileMtime, nullIfMissing } from "../fs.ts";
import type {
  RawClaudeSessions,
  RawEntries,
  RawNewestTranscript,
  RawTranscript,
} from "../raw.ts";
import type { PolledSource } from "./source.ts";

const chunkBytes = 64 * 1024;

/** How far back from the end of a transcript the search for a message line goes. */
export const tailLimitBytes = 8 * 1024 * 1024;

/**
 * The directory name Claude Code uses for a working directory under ~/.claude/projects.
 * Every character other than a letter or digit becomes a hyphen, so /home/owner/.dotfiles
 * becomes -home-owner--dotfiles.
 */
export function encodeProjectPath(path: string): string {
  return path.replace(/[^A-Za-z0-9]/g, "-");
}

function messageTimestamp(line: Buffer): string | null {
  try {
    const record: unknown = JSON.parse(line.toString("utf8"));
    if (typeof record !== "object" || record === null) return null;
    const { type, timestamp } = record as {
      type?: unknown;
      timestamp?: unknown;
    };
    if (type !== "user" && type !== "assistant") return null;
    return typeof timestamp === "string" ? timestamp : null;
  } catch {
    return null;
  }
}

/** Reads a transcript backwards in chunks for the timestamp of its last user or assistant line. */
export async function readLastMessageAt(
  path: string,
  limitBytes: number,
): Promise<RawNewestTranscript["lastMessageAt"]> {
  const handle = await open(path, "r");
  try {
    let position = (await handle.stat()).size;
    let carry = Buffer.alloc(0);
    let readBytes = 0;
    while (position > 0) {
      if (readBytes >= limitBytes)
        return { state: "absent", reason: "beyond-tail-limit" };
      const length = Math.min(chunkBytes, position);
      position -= length;
      const chunk = Buffer.alloc(length);
      await handle.read(chunk, 0, length, position);
      readBytes += length;
      const data = Buffer.concat([chunk, carry]);
      const lines: Buffer[] = [];
      let end = data.length;
      for (let index = data.length - 1; index >= 0; index--) {
        if (data[index] !== 0x0a) continue;
        lines.push(data.subarray(index + 1, end));
        end = index;
      }
      carry = data.subarray(0, end);
      if (position === 0) lines.push(carry);
      for (const line of lines) {
        const timestamp = messageTimestamp(line);
        if (timestamp !== null) return { state: "observed", value: timestamp };
      }
    }
    return { state: "absent", reason: "no-message-line" };
  } finally {
    await handle.close();
  }
}

/** Lists the transcripts for a working directory, and reads the newest one's last message time. */
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
      newest: { state: "absent", reason: "no-transcripts" },
    };
  }
  const transcripts: RawTranscript[] = [];
  for (const file of names.filter((name) => name.endsWith(".jsonl")).sort()) {
    const mtime = await fileMtime(join(projectsDir, directory, file));
    if (mtime !== null) transcripts.push({ file, mtime: mtime.toISOString() });
  }
  const newest = transcripts.reduce<RawTranscript | null>(
    (best, entry) => (best === null || entry.mtime > best.mtime ? entry : best),
    null,
  );
  return {
    directory,
    transcripts: { state: "observed", value: transcripts },
    newest:
      newest === null
        ? { state: "absent", reason: "no-transcripts" }
        : {
            state: "observed",
            value: {
              file: newest.file,
              lastMessageAt: await readLastMessageAt(
                join(projectsDir, directory, newest.file),
                tailLimitBytes,
              ),
            },
          },
  };
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
