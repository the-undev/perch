import { readFile } from "node:fs/promises";

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
  return error instanceof Error ? error.message : String(error);
}
