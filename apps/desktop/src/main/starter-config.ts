import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

function isExisting(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

/**
 * Copies the example config to the owner's config path, creating its directory; refuses,
 * writing nothing, when a file is already there.
 */
export async function writeStarterConfig(
  examplePath: string,
  configPath: string,
): Promise<void> {
  const text = await readFile(examplePath, "utf8");
  await mkdir(dirname(configPath), { recursive: true });
  try {
    await writeFile(configPath, text, { flag: "wx" });
  } catch (error) {
    if (isExisting(error)) throw new Error(`${configPath} already exists`);
    throw error;
  }
}
