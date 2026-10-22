import { readFile, stat } from "node:fs/promises";

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

/** Reads a UTF-8 file, returning null when it does not exist. */
export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** Runs an async step, returning null when it fails because a path does not exist. */
export async function nullIfMissing<T>(
  step: () => Promise<T>,
): Promise<T | null> {
  try {
    return await step();
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** The message of a thrown value, for recording as data. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  if (error.cause instanceof Error)
    return `${error.message}: ${error.cause.message}`;
  return error.message;
}

/** The modification time of a path, or null when it does not exist. */
export async function fileMtime(path: string): Promise<Date | null> {
  const stats = await nullIfMissing(() => stat(path));
  return stats?.mtime ?? null;
}
