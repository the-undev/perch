import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  countOpenItems,
  deriveRoadmap,
  deriveRoadmapFile,
} from "../src/derivations.ts";
import { readRoadmapStructure } from "../src/roadmap-parser.ts";
import type { RoadmapFile, WorkItem, WorkItemGroup } from "../src/snapshot.ts";
import { createRoadmapSource } from "../src/sources/roadmap.ts";
import { localPresence } from "./helpers/raw.ts";

function readFixture(name: string): string {
  return readFileSync(
    join(import.meta.dirname, "fixtures", "roadmaps", name),
    "utf8",
  );
}

function parseFixture(name: string): RoadmapFile {
  return deriveRoadmapFile(name, readRoadmapStructure(readFixture(name)));
}

describe("readRoadmapStructure", () => {
  it("records every heading with its parents and the bullets beneath it", () => {
    const structure = readRoadmapStructure(readFixture("headings-only.md"));

    expect(
      structure.sections.map((section) => [
        section.heading,
        section.level,
        section.parents.map((parent) => parent.text),
        section.bullets.length,
      ]),
    ).toEqual([
      ["Roadmap", 1, [], 0],
      ["First build", 2, ["Roadmap"], 0],
      ["Tray icon status", 2, ["Roadmap"], 0],
      ["Bugs", 2, ["Roadmap"], 0],
      ["Scan hangs on a locked index", 3, ["Roadmap", "Bugs"], 0],
      ["Nudges #bug", 2, ["Roadmap"], 0],
    ]);
    expect(structure.sections[5]?.tags).toEqual(["bug"]);
  });

  it("keeps checkbox state and tags as found, without judging kinds", () => {
    const epics = readRoadmapStructure(readFixture("epics.md"));
    const bugs = readRoadmapStructure(readFixture("bugs.md"));

    expect(epics.sections[1]?.bullets.map((bullet) => bullet.checkbox)).toEqual(
      ["checked", "checked", "unchecked"],
    );
    expect(epics.sections[3]?.bullets[0]?.checkbox).toBe("none");
    expect(bugs.sections[3]?.bullets.map((bullet) => bullet.tags)).toEqual([
      [],
      ["bug"],
      ["bugfix"],
    ]);
  });

  it("collects bullets above the first heading separately", () => {
    const structure = readRoadmapStructure(
      "- loose item\n\n## Next\n\n- grouped\n",
    );

    expect(
      structure.bulletsBeforeFirstHeading.map((bullet) => bullet.text),
    ).toEqual(["loose item"]);
    expect(structure.sections[0]?.bullets.map((bullet) => bullet.text)).toEqual(
      ["grouped"],
    );
  });
});

function summary(file: RoadmapFile): unknown {
  const group = (entry: WorkItemGroup): unknown => [
    entry.heading,
    entry.role,
    entry.items.map((item) => item.text),
    entry.groups.map(group),
  ];
  return {
    items: file.items.map((item) => item.text),
    groups: file.groups.map(group),
  };
}

function everyItem(file: RoadmapFile): WorkItem[] {
  const walk = (group: WorkItemGroup): WorkItem[] => [
    ...group.items,
    ...group.groups.flatMap(walk),
  ];
  return [...file.items, ...file.groups.flatMap(walk)];
}

describe("deriveRoadmapFile, per heading", () => {
  it("makes bulleted headings groups, bare headings items, and sub-heading-only headings structure", () => {
    expect(summary(parseFixture("mixed.md"))).toEqual({
      items: [],
      groups: [
        [
          "Roadmap",
          "structure",
          ["Actions from tiles"],
          [
            [
              "Claude Code integration",
              "group",
              ["Show the last user messages", "Launch from a tile"],
              [["Hooks", "group", ["Session end hook"], []]],
            ],
            [
              "Next Priority Bugs",
              "structure",
              ["Scan hangs on a locked index"],
              [],
            ],
            [
              "Area",
              "structure",
              [],
              [["Sub-area", "group", ["Task under a structure heading"], []]],
            ],
          ],
        ],
      ],
    });
  });

  it("gives a bare heading its prose as the body", () => {
    const actions = everyItem(parseFixture("mixed.md")).find(
      (item) => item.text === "Actions from tiles",
    );

    expect(actions).toMatchObject({
      source: "heading",
      done: null,
      body: "Push the branch, commit and push a vault.\n\nParked until the read-only app has proved itself.",
    });
  });

  it("groups top-level bullets under their nearest heading and joins continuation lines", () => {
    const file = parseFixture("bullets.md");

    expect(summary(file)).toEqual({
      items: [],
      groups: [
        [
          "Documentation",
          "group",
          [
            "Write up the shares and the user accounts, which continue onto a second line",
            "Record the Plex entry name",
          ],
          [
            [
              "Runbooks",
              "group",
              ["Restoring from a backup", "Making a bootable USB"],
              [],
            ],
          ],
        ],
        [
          "Housekeeping",
          "group",
          ["Decide whether to guard against the icon loop"],
          [],
        ],
      ],
    });
    expect(file.groups[0]?.items[0]).toMatchObject({
      line: 7,
      done: null,
      source: "bullet",
    });
  });

  it("ignores tag lines, nested bullets and fenced code", () => {
    const texts = everyItem(parseFixture("bullets.md")).map(
      (item) => item.text,
    );

    expect(texts).not.toContain("not a bullet inside a fence");
    expect(texts.some((text) => text.includes("nested note"))).toBe(false);
  });

  it("treats every heading the same way in a file without bullets", () => {
    expect(summary(parseFixture("headings-only.md"))).toEqual({
      items: [],
      groups: [
        [
          "Roadmap",
          "structure",
          ["First build", "Tray icon status", "Nudges #bug"],
          [["Bugs", "structure", ["Scan hangs on a locked index"], []]],
        ],
      ],
    });
  });
});

describe("deriveRoadmapFile bug kinds", () => {
  it("marks items under any heading mentioning bugs, at any depth, as bugs", () => {
    const kinds = Object.fromEntries(
      everyItem(parseFixture("bugs.md")).map((item) => [item.text, item.kind]),
    );

    expect(kinds).toEqual({
      "The window flickers on focus": "bug",
      "Crash on an empty repository": "bug",
      "Show the branch name": "feature",
      "Counts are wrong after a rebase #bug": "bug",
      "A #bugfix tag is not a bug tag": "feature",
    });
  });

  it("widens the heading match to any text containing the word", () => {
    const item = everyItem(parseFixture("mixed.md")).find(
      (entry) => entry.text === "Scan hangs on a locked index",
    );

    expect(item?.kind).toBe("bug");
  });

  it("applies the #bug tag to heading items", () => {
    const kinds = Object.fromEntries(
      everyItem(parseFixture("headings-only.md")).map((item) => [
        item.text,
        item.kind,
      ]),
    );

    expect(kinds["Nudges #bug"]).toBe("bug");
    expect(kinds["First build"]).toBe("feature");
  });

  it("counts open items by kind across nested groups", () => {
    expect(countOpenItems([parseFixture("bugs.md")])).toEqual({
      bug: 3,
      feature: 2,
    });
  });
});

describe("deriveRoadmapFile checkboxes", () => {
  it("honours checkbox state and derives per-epic progress", () => {
    const file = parseFixture("epics.md");
    const epics = file.groups[0]?.groups ?? [];

    expect(epics.map((group) => [group.heading, group.progress])).toEqual([
      ["Scanner PoC", { done: 2, total: 3 }],
      ["Mockups", { done: 0, total: 2 }],
      ["Ideas", null],
    ]);
    expect(epics[0]?.items.map((item) => [item.text, item.done])).toEqual([
      ["Scaffold", true],
      ["Roadmap parser", true],
      ["Git source", false],
    ]);
  });

  it("leaves done items out of the counts", () => {
    expect(countOpenItems([parseFixture("epics.md")])).toEqual({
      bug: 0,
      feature: 4,
    });
  });
});

describe("roadmap source", () => {
  it("reads the first standard file, or the configured files, stating what is missing", async () => {
    const files = new Map([
      ["/repo/ROADMAP.md", "## Next\n\n- Upper case wins over TODO\n"],
      ["/repo/TODO.md", "- Not read\n"],
      ["/vault/Tech/Tech Plans.md", "## Docs\n\n- Write it down\n"],
    ]);
    const source = createRoadmapSource({
      readText: async (path) => files.get(path) ?? null,
      roadmapsFor: (id) =>
        id === "vault" ? ["Tech/Tech Plans.md", "Missing.md"] : null,
    });

    const entries = await source.gather({
      local: {
        source: "local",
        gatheredAt: "2026-10-21T09:00:00.000Z",
        data: {
          includes: {},
          presences: {
            repo: localPresence("/repo", { include: "/repo" }),
            empty: localPresence("/empty", { include: "/empty" }),
            vault: localPresence("/vault", { include: "/vault", vault: true }),
          },
        },
      },
    });

    expect(entries.repo).toMatchObject({
      state: "observed",
      value: {
        files: [{ path: "ROADMAP.md", structure: { state: "observed" } }],
      },
    });
    expect(entries.empty).toEqual({
      state: "absent",
      reason: "no-roadmap-file",
    });
    expect(entries.vault).toMatchObject({
      state: "observed",
      value: {
        files: [
          { path: "Tech/Tech Plans.md", structure: { state: "observed" } },
          {
            path: "Missing.md",
            structure: { state: "absent", reason: "file-not-found" },
          },
        ],
      },
    });
  });

  it("derives a missing configured file as an error naming it", () => {
    expect(
      deriveRoadmap({
        files: [
          {
            path: "Missing.md",
            structure: { state: "absent", reason: "file-not-found" },
          },
        ],
      }),
    ).toEqual({ error: "roadmap file not found: Missing.md" });
  });
});
