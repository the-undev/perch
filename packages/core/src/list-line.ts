// A list of strings edited as one line of text, in the config file's own form. Joins and launch
// commands use it. No Node modules, so the renderer may import it.

/**
 * A list of strings as one line, in the config file's own form: brackets around double-quoted
 * strings, with JSON's escapes, such as ["code", "{path}"].
 */
export function listLine(list: readonly string[]): string {
  return `[${list.map((entry) => JSON.stringify(entry)).join(", ")}]`;
}

/** The strings a list line holds, or why it holds none. */
export function parseListLine(
  line: string,
): { list: string[] } | { problem: string } {
  const shape =
    'must be a list in brackets of strings in double quotes, such as ["code", "{path}"]';
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { problem: shape };
  }
  if (
    !Array.isArray(parsed) ||
    !parsed.every((entry) => typeof entry === "string")
  ) {
    return { problem: shape };
  }
  return { list: parsed };
}

/** A list line's strings; the line is known to parse. */
export function listOf(line: string): string[] {
  const parsed = parseListLine(line);
  if ("problem" in parsed) throw new Error(parsed.problem);
  return parsed.list;
}
