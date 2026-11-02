import { describe, expect, it } from "vitest";
import gatherSource from "../../../packages/core/src/gather.ts?raw";
import rawSource from "../../../packages/core/src/raw.ts?raw";
import {
  declaration,
  exportedFunctions,
  gatherRoundsFrom,
  headerComment,
  signature,
  tomlTables,
} from "./excerpt.ts";

const sample = `// A sample module: what it is for.
// Second line.

import { x } from "y";

/** A thing. */
export interface Thing {
  name: string;
  nested: { a: number };
}

// Not attached: a blank line follows.

export type Pick =
  | { kind: "a" }
  | { kind: "b" };

/**
 * Doubles a number,
 * carefully.
 */
export function double(value: number): number {
  return value * 2;
}

export const list = [
  ["a", "b"],
  ["c"],
];
`;

describe("excerpts of the real sources", () => {
  it("takes an interface with its comment, to its closing brace", () => {
    expect(declaration(sample, "Thing")).toBe(
      "/** A thing. */\nexport interface Thing {\n  name: string;\n  nested: { a: number };\n}",
    );
  });

  it("takes a union type to its semicolon, leaving a detached comment behind", () => {
    expect(declaration(sample, "Pick")).toBe(
      'export type Pick =\n  | { kind: "a" }\n  | { kind: "b" };',
    );
  });

  it("gives a function's signature without its body", () => {
    expect(signature(sample, "double")).toBe(
      "/**\n * Doubles a number,\n * carefully.\n */\nexport function double(value: number): number { … }",
    );
  });

  it("lists exported functions with their doc comments as prose", () => {
    expect(exportedFunctions(sample)).toEqual([
      { name: "double", doc: "Doubles a number, carefully." },
    ]);
  });

  it("reads a module's opening comment", () => {
    expect(headerComment(sample)).toBe(
      "A sample module: what it is for. Second line.",
    );
  });

  it("throws for a name the source no longer declares", () => {
    expect(() => declaration(sample, "Gone")).toThrow(
      "no exported declaration Gone",
    );
  });

  it("finds the real declarations in raw.ts and the gather's rounds", () => {
    expect(declaration(rawSource, "Tracking")).toContain("upstream-gone");
    expect(gatherRoundsFrom(gatherSource)).toEqual([
      ["local", "githubAccounts", "forgejoAccounts", "kuma"],
      ["claudeSessions", "github", "forgejo"],
      ["roadmap"],
    ]);
  });
});

describe("tables of a TOML file", () => {
  it("cuts at each header, the comment above it going with it, numbering an array's tables and placing a subtable in the latest", () => {
    const toml = `# The file.
joins = []

# The wires.
[wires]
names = ["a"]

[items."obsidian/Hothouse"]
wire = "a"

# Accounts.
[[sources.github]]
account = "a"

[[sources.github]]
account = "b"

[[launch.actions]]
verb = "Open"

[[launch.actions]]
kind = "zellij"
[launch.actions.sessions]
"~/work" = "work"
`;

    expect(tomlTables(toml)).toEqual([
      { path: [], array: false, text: "# The file.\njoins = []" },
      {
        path: ["wires"],
        array: false,
        text: '# The wires.\n[wires]\nnames = ["a"]',
      },
      {
        path: ["items", "obsidian/Hothouse"],
        array: false,
        text: '[items."obsidian/Hothouse"]\nwire = "a"',
      },
      {
        path: ["sources", "github", "0"],
        array: true,
        text: '# Accounts.\n[[sources.github]]\naccount = "a"',
      },
      {
        path: ["sources", "github", "1"],
        array: true,
        text: '[[sources.github]]\naccount = "b"',
      },
      {
        path: ["launch", "actions", "0"],
        array: true,
        text: '[[launch.actions]]\nverb = "Open"',
      },
      {
        path: ["launch", "actions", "1"],
        array: true,
        text: '[[launch.actions]]\nkind = "zellij"',
      },
      {
        path: ["launch", "actions", "1", "sessions"],
        array: false,
        text: '[launch.actions.sessions]\n"~/work" = "work"',
      },
    ]);
  });
});
