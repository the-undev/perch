import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countOpenItems, parseRoadmap } from "../src/roadmap-parser.ts";
import type { Item, RoadmapFile } from "../src/snapshot.ts";
import { createRoadmapSource } from "../src/sources/roadmap.ts";

function parseFixture(name: string): RoadmapFile {
  const path = join(import.meta.dirname, "fixtures", "roadmaps", name);
  return parseRoadmap(name, readFileSync(path, "utf8"));
}

function summary(file: RoadmapFile): [string | null, string[]][] {
  return file.groups.map((group) => [
    group.heading,
    group.items.map((item) => item.text),
  ]);
}

describe("parseRoadmap with bullets", () => {
  it("groups top-level bullets under their nearest heading", () => {
    const file = parseFixture("bullets.md");

    expect(file.itemSource).toBe("bullets");
    expect(summary(file)).toEqual([
      [
        "Documentation",
        [
          "Write up the shares and the user accounts, which continue onto a second line",
          "Record the Plex entry name",
        ],
      ],
      ["Runbooks", ["Restoring from a backup", "Making a bootable USB"]],
      ["Housekeeping", ["Decide whether to guard against the icon loop"]],
    ]);
  });

  it("ignores tag lines, nested bullets and fenced code", () => {
    const file = parseFixture("bullets.md");
    const texts = file.groups.flatMap((group) =>
      group.items.map((item) => item.text),
    );

    expect(texts).not.toContain("not a bullet inside a fence");
    expect(file.groups.map((group) => group.heading)).not.toContain(
      "not a heading inside a fence",
    );
    expect(texts.some((text) => text.includes("nested note"))).toBe(false);
  });

  it("records the level and line of each item", () => {
    const file = parseFixture("bullets.md");

    expect(file.groups[1]?.level).toBe(3);
    expect(file.groups[0]?.items[0]?.line).toBe(7);
  });

  it("leaves done unset and progress null without checkboxes", () => {
    const file = parseFixture("bullets.md");

    expect(file.groups.every((group) => group.progress === null)).toBe(true);
    expect(file.groups[0]?.items[0]?.done).toBeNull();
  });
});

describe("parseRoadmap bug kinds", () => {
  it("marks items under a Bugs heading, including its sub-headings, as bugs", () => {
    const file = parseFixture("bugs.md");
    const kinds = file.groups.map((group) => [
      group.heading,
      group.items.map((item) => item.kind),
    ]);

    expect(kinds).toEqual([
      ["Bugs", ["bug"]],
      ["Scanner", ["bug"]],
      ["Tiles", ["feature", "bug", "feature"]],
    ]);
  });

  it("counts open items by kind", () => {
    expect(countOpenItems([parseFixture("bugs.md")])).toEqual({
      bug: 3,
      feature: 2,
    });
  });
});

describe("parseRoadmap without bullets", () => {
  it("falls back to headings below the title as items, grouped by their parent", () => {
    const file = parseFixture("headings-only.md");

    expect(file.itemSource).toBe("headings");
    expect(summary(file)).toEqual([
      ["Roadmap", ["First build", "Tray icon status", "Nudges #bug"]],
      ["Bugs", ["Scan hangs on a locked index"]],
    ]);
  });

  it("applies the Bugs heading and the #bug tag to heading items", () => {
    const file = parseFixture("headings-only.md");
    const kinds = Object.fromEntries(
      file.groups.flatMap((group) =>
        group.items.map((item) => [item.text, item.kind]),
      ),
    );

    expect(kinds).toEqual({
      "First build": "feature",
      "Tray icon status": "feature",
      "Nudges #bug": "bug",
      "Scan hangs on a locked index": "bug",
    });
  });
});

describe("parseRoadmap checkboxes", () => {
  it("honours checkbox state and derives per-epic progress", () => {
    const file = parseFixture("epics.md");

    expect(file.groups.map((group) => [group.heading, group.progress])).toEqual(
      [
        ["Scanner PoC", { done: 2, total: 3 }],
        ["Mockups", { done: 0, total: 2 }],
        ["Ideas", null],
      ],
    );
    expect(file.groups[0]?.items.map((item) => [item.text, item.done])).toEqual(
      [
        ["Scaffold", true],
        ["Roadmap parser", true],
        ["Git source", false],
      ],
    );
  });

  it("leaves done items out of the counts", () => {
    expect(countOpenItems([parseFixture("epics.md")])).toEqual({
      bug: 0,
      feature: 4,
    });
  });
});

describe("roadmap source", () => {
  function item(kind: Item["kind"], path: string): Item {
    return {
      id: path,
      name: path,
      kind,
      path,
      importance: "projects",
      liveSources: [],
      sources: {},
    };
  }

  it("reads the first repository candidate that exists and the configured vault files", async () => {
    const files = new Map([
      ["/repo/ROADMAP.md", "## Next\n\n- Upper case wins over TODO\n"],
      ["/repo/TODO.md", "- Not read\n"],
      [
        "/vault/Tech/Tech Plans.md",
        "## Docs\n\n- Write it down\n- Fix it #bug\n",
      ],
    ]);
    const source = createRoadmapSource({
      readText: async (path) => files.get(path) ?? null,
      vaultRoadmaps: new Map([["/vault", ["Tech/Tech Plans.md", "Missing.md"]]]),
    });

    const results = await source.scan([
      item("repo", "/repo"),
      item("repo", "/empty"),
      item("vault", "/vault"),
    ]);

    expect(results.get("/repo")).toMatchObject({
      counts: { bug: 0, feature: 1 },
      files: [{ path: "ROADMAP.md" }],
    });
    expect(results.get("/empty")).toEqual({
      counts: { bug: 0, feature: 0 },
      files: [],
    });
    expect(results.get("/vault")).toEqual({
      error: "roadmap file not found: Missing.md",
    });
  });
});
