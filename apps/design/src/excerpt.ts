// Excerpts of the real source files, read with Vite's ?raw imports, so the Spec pages show the
// declarations as they are. A name that no longer exists throws, which fails the route test.

type DeclarationKind = "interface" | "type" | "const" | "function";

/** The comment lines directly above a line, with no blank line between. */
function commentStart(lines: string[], index: number): number {
  let first = index;
  while (first > 0 && /^\s*(\/\*\*|\*|\/\/)/.test(lines[first - 1] ?? "")) {
    first -= 1;
  }
  return first;
}

function findExport(
  lines: string[],
  name: string,
): { index: number; kind: DeclarationKind } {
  const pattern = new RegExp(
    `^export (?:async )?(interface|type|const|function) ${name}\\b`,
  );
  const index = lines.findIndex((line) => pattern.test(line));
  const kind = pattern.exec(lines[index] ?? "")?.[1] as
    | DeclarationKind
    | undefined;
  if (kind === undefined) throw new Error(`no exported declaration ${name}`);
  return { index, kind };
}

function depthChange(line: string): number {
  let change = 0;
  for (const char of line) {
    if (char === "{" || char === "(" || char === "[") change += 1;
    if (char === "}" || char === ")" || char === "]") change -= 1;
  }
  return change;
}

/**
 * An exported declaration with the comment above it. An interface or function ends where its
 * braces close; a type or const where a line ends in a semicolon outside any bracket.
 */
export function declaration(source: string, name: string): string {
  const lines = source.split("\n");
  const { index, kind } = findExport(lines, name);
  let depth = 0;
  let opened = false;
  for (let end = index; end < lines.length; end += 1) {
    const line = lines[end] ?? "";
    depth += depthChange(line);
    opened ||= /[{([]/.test(line);
    const closed =
      kind === "interface" || kind === "function"
        ? opened && depth === 0
        : depth === 0 && line.trimEnd().endsWith(";");
    if (closed)
      return lines.slice(commentStart(lines, index), end + 1).join("\n");
  }
  throw new Error(`the declaration of ${name} never closes`);
}

/** An exported function's comment and signature, its body left out. */
export function signature(source: string, name: string): string {
  const lines = source.split("\n");
  const { index } = findExport(lines, name);
  let depth = 0;
  for (let end = index; end < lines.length; end += 1) {
    const line = lines[end] ?? "";
    depth += depthChange(line);
    if (depth === 1 && line.trimEnd().endsWith("{")) {
      const head = lines.slice(commentStart(lines, index), end + 1);
      return [...head.slice(0, -1), `${line.trimEnd().slice(0, -1)}{ … }`].join(
        "\n",
      );
    }
  }
  throw new Error(`the signature of ${name} never opens its body`);
}

/** Each exported function in a source, in order, with its doc comment as one line of prose. */
export function exportedFunctions(
  source: string,
): { name: string; doc: string | null }[] {
  const lines = source.split("\n");
  return lines.flatMap((line, index) => {
    const name = /^export (?:async )?function (\w+)/.exec(line)?.[1];
    if (name === undefined) return [];
    const comment = lines
      .slice(commentStart(lines, index), index)
      .map((text) => text.replace(/^\s*(\/\*\*|\*\/|\*|\/\/)\s?/, "").trim())
      .filter((text) => text !== "" && text !== "*/")
      .join(" ")
      .replace(/\s*\*\/$/, "");
    return [{ name, doc: comment === "" ? null : comment }];
  });
}

/** The file's opening comment: what the module is for, as prose. */
export function headerComment(source: string): string {
  const lines = source.split("\n");
  const end = lines.findIndex((line) => !line.startsWith("//"));
  return lines
    .slice(0, end)
    .map((line) => line.replace(/^\/\/\s?/, ""))
    .join(" ")
    .trim();
}

/** The gather's rounds, read from the gatherRounds declaration in gather.ts. */
export function gatherRoundsFrom(source: string): string[][] {
  const text = declaration(source, "gatherRounds");
  const array = text.slice(text.indexOf("= [") + 2, text.lastIndexOf("]") + 1);
  return JSON.parse(array.replace(/,(\s*\])/g, "$1"));
}

/** One table of a TOML file: its header path, and its text with the comment above it. */
export interface TomlTable {
  /**
   * The header's keys, unquoted, and for a table of an array its position in the array; empty
   * for the keys above the first table.
   */
  path: string[];
  /** Whether the header is an array table's, [[like.this]]. */
  array: boolean;
  text: string;
}

function headerPath(header: string): string[] {
  return [...header.matchAll(/"([^"]*)"|([^.\s"]+)/g)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
}

/** A header's path with the position of the latest table of each array it runs through. */
function placedPath(
  keys: readonly string[],
  arrayLengths: ReadonlyMap<string, number>,
): string[] {
  return keys.flatMap((key, index) => {
    const length = arrayLengths.get(keys.slice(0, index + 1).join("."));
    return length === undefined ? [key] : [key, String(length - 1)];
  });
}

/** A TOML file cut into its tables, each with the comment lines directly above its header. */
export function tomlTables(text: string): TomlTable[] {
  const lines = text.trimEnd().split("\n");
  const arrayLengths = new Map<string, number>();
  const starts = lines.flatMap((line, index) => {
    const match = /^(\[\[?)([^[\]]+)\]\]?\s*$/.exec(line);
    const header = match?.[2];
    if (header === undefined) return [];
    let start = index;
    while (start > 0 && (lines[start - 1] ?? "").startsWith("#")) start -= 1;
    const keys = headerPath(header);
    if (match?.[1] !== "[[") {
      return [{ start, path: placedPath(keys, arrayLengths), array: false }];
    }
    const name = keys.join(".");
    const position = arrayLengths.get(name) ?? 0;
    arrayLengths.set(name, position + 1);
    return [
      {
        start,
        path: [
          ...placedPath(keys.slice(0, -1), arrayLengths),
          ...keys.slice(-1),
          String(position),
        ],
        array: true,
      },
    ];
  });
  const chunks = [{ start: 0, path: [] as string[], array: false }, ...starts];
  return chunks.map((chunk, index) => ({
    path: chunk.path,
    array: chunk.array,
    text: lines
      .slice(chunk.start, chunks[index + 1]?.start ?? lines.length)
      .join("\n")
      .trim(),
  }));
}
