import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArguments } from "./command-line.ts";

const resources = join(import.meta.dirname, "..", "..", "resources");

/** A desktop entry's keys, comments and the group header left out. */
function entry(file: string): Record<string, string> {
  const text = readFileSync(join(resources, file), "utf8");
  const pairs = text
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1)];
    });
  return Object.fromEntries(pairs);
}

/** The command line an entry runs. */
function execArguments(file: string): string[] {
  return (entry(file).Exec ?? "").split(" ");
}

describe("the desktop entries", () => {
  it("start perch at login hidden, asking nothing of a window already running", () => {
    const argv = execArguments("perch-autostart.desktop");
    expect(argv[0]).toBe("perch");
    expect(parseArguments(argv)).toEqual({
      window: null,
      scan: false,
      hidden: true,
    });
  });

  it("show the window from the launcher", () => {
    const argv = execArguments("perch.desktop");
    expect(argv).toEqual(["perch"]);
    expect(parseArguments(argv).window).toBe("show");
  });

  it("name the icon the README links into the icon theme", () => {
    expect(entry("perch.desktop").Icon).toBe("perch");
    expect(entry("perch-autostart.desktop").Icon).toBe("perch");
  });
});
