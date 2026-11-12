import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  builtInBugWords,
  builtInCriticalBugWords,
  defaultBugThresholds,
  type WorkWords,
} from "../src/config.ts";
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

const builtInWords: WorkWords = {
  bug: [...builtInBugWords],
  criticalBug: [...builtInCriticalBugWords],
};

function parseFixture(name: string, words = builtInWords): RoadmapFile {
  return deriveRoadmapFile(
    name,
    readRoadmapStructure(readFixture(name)),
    words,
  );
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
      body: "Push the branch, commit and push an Obsidian vault.\n\nParked until the read-only app has proved itself.",
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
      done: false,
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

describe("deriveRoadmapFile, plain bullets", () => {
  it("makes a heading with only plain bullets one task, the bullets its body", () => {
    const monitoring = everyItem(parseFixture("plain-bullets.md")).find(
      (item) => item.text === "Server monitoring",
    );

    expect(monitoring).toMatchObject({
      source: "heading",
      done: null,
      line: 4,
      body: "Prose before the notes.\n\n- Watch the disk\n- Crash reports from the load balancer",
    });
  });

  it("makes a heading mixing checkbox and plain bullets a group of the checkbox tasks only", () => {
    const mixed = parseFixture("plain-bullets.md").groups.find(
      (group) => group.heading === "Mixed",
    );

    expect(mixed?.role).toBe("group");
    expect(mixed?.items.map((item) => item.text)).toEqual([
      "A task beside a note",
    ]);
  });

  it("ignores plain bullets above the first heading and under a heading with sub-headings", () => {
    const file = parseFixture("plain-bullets.md");

    expect(file.items.map((item) => item.text)).toEqual([
      "A loose task above the first heading",
      "Server monitoring",
    ]);
    expect(
      file.groups.find((group) => group.heading === "Structure"),
    ).toMatchObject({ role: "structure", items: [] });
  });

  it("leaves a bug word in a plain bullet out of its heading task", () => {
    expect(kindsIn(parseFixture("plain-bullets.md"))).toMatchObject({
      "Server monitoring": "task",
    });
  });

  it("counts one task per heading in a file of bare headings and two note headings", () => {
    const file = parseFixture("reference-shape.md");

    expect(everyItem(file)).toHaveLength(20);
    expect(file.counts).toEqual({ task: 20, bug: 0, "critical-bug": 0 });
  });
});

/** Each item's text against its kind. */
function kindsIn(file: RoadmapFile): Record<string, string> {
  return Object.fromEntries(
    everyItem(file).map((item) => [item.text, item.kind]),
  );
}

describe("deriveRoadmapFile kinds", () => {
  it("makes a bare heading a bug when its own title holds a bug word", () => {
    expect(kindsIn(parseFixture("headings-as-tasks.md"))).toEqual({
      "Bird Positions": "task",
      "Tray icon status": "task",
      "Forge issues source": "bug",
    });
  });

  it("makes a checklist item a bug from its own text", () => {
    expect(kindsIn(parseFixture("checklist.md"))).toEqual({
      "Fix crash on an empty config": "bug",
      "Port settings to TOML": "task",
      Changelog: "task",
      "Tag and build": "task",
    });
  });

  it("makes an item a critical bug from a heading above it, with no bug word needed", () => {
    expect(kindsIn(parseFixture("hierarchy.md"))).toEqual({
      "Renew the signing key": "task",
      "Data loss when two devices save at once": "critical-bug",
      "A CSV with a byte order mark fails to parse": "bug",
      "Dates read as US format": "bug",
      "Cache the last sync": "task",
      "Queue edits while offline": "task",
    });
  });

  it("reads headings at any depth, #tags, and whole words only", () => {
    expect(kindsIn(parseFixture("bugs.md"))).toEqual({
      "The window flickers on focus": "bug",
      "Crash on an empty repository": "bug",
      "Show the branch name": "task",
      "Counts are wrong after a rebase #bug": "bug",
      "A #bugfix tag matches no word": "task",
    });
    expect(kindsIn(parseFixture("headings-only.md"))).toMatchObject({
      "First build": "task",
      "Scan hangs on a locked index": "bug",
      "Nudges #bug": "bug",
    });
  });

  it("lets a critical bug word win over a bug word, in any case", () => {
    const file = deriveRoadmapFile(
      "notes.md",
      readRoadmapStructure(
        "## Bugs\n\n- [ ] URGENT: the export hangs\n- [ ] The import is slow #P1\n\n## Ideas\n\n- [ ] Debugging output is noisy\n- [ ] Issues view\n- [ ] Reissue the token\n",
      ),
      builtInWords,
    );

    expect(kindsIn(file)).toEqual({
      "URGENT: the export hangs": "critical-bug",
      "The import is slow #P1": "critical-bug",
      "Debugging output is noisy": "task",
      "Issues view": "bug",
      "Reissue the token": "task",
    });
  });

  it("uses only the word lists given, an empty one matching nothing", () => {
    const words: WorkWords = { bug: ["us format", "wart"], criticalBug: [] };

    expect(kindsIn(parseFixture("hierarchy.md", words))).toMatchObject({
      "Data loss when two devices save at once": "task",
      "A CSV with a byte order mark fails to parse": "task",
      "Dates read as US format": "bug",
    });
  });

  it("leaves out words in inline code and double quotes, straight or curly, and counts the rest of the line", () => {
    const file = deriveRoadmapFile(
      "notes.md",
      readRoadmapStructure(
        [
          "## Ideas",
          "",
          "- [ ] Name the `bug` kind in the settings",
          "- [ ] Say ``a `critical` word`` in the help",
          '- [ ] Explain "critical bug" in the guide',
          "- [ ] Explain “issues” in the guide",
          '- [ ] Link "see #bug" from the help',
          '- [ ] Spell out "bug" for the crash on save',
          "- [ ] Name the `critical` kind, an urgent one",
          '- [ ] An unclosed "bug quote',
        ].join("\n"),
      ),
      builtInWords,
    );

    expect(kindsIn(file)).toEqual({
      "Name the `bug` kind in the settings": "task",
      "Say ``a `critical` word`` in the help": "task",
      'Explain "critical bug" in the guide': "task",
      "Explain “issues” in the guide": "task",
      'Link "see #bug" from the help': "task",
      'Spell out "bug" for the crash on save': "bug",
      "Name the `critical` kind, an urgent one": "critical-bug",
      'An unclosed "bug quote': "bug",
    });
  });

  it("counts open items by kind across nested groups, leaving done ones out", () => {
    expect(countOpenItems([parseFixture("hierarchy.md")])).toEqual({
      task: 2,
      bug: 1,
      "critical-bug": 1,
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
    ]);
    expect(epics[0]?.items.map((item) => [item.text, item.done])).toEqual([
      ["Scaffold", true],
      ["Roadmap parser", true],
      ["Git source", false],
    ]);
  });

  it("leaves done items out of the counts", () => {
    expect(countOpenItems([parseFixture("epics.md")])).toEqual({
      task: 4,
      bug: 0,
      "critical-bug": 0,
    });
  });
});

describe("roadmap source", () => {
  it("detects the first standard file without parsing it, and parses only the configured files, stating what is missing", async () => {
    const files = new Map([
      ["/repo/ROADMAP.md", "## Next\n\n- Upper case wins over TODO\n"],
      ["/repo/TODO.md", "- Not read\n"],
      ["/hothouse/Tech/Tech Plans.md", "## Docs\n\n- Write it down\n"],
    ]);
    const source = createRoadmapSource({
      readText: async (path) => files.get(path) ?? null,
      roadmapsFor: () => (id) => {
        if (id === "hothouse") return ["Tech/Tech Plans.md", "Missing.md"];
        return id === "listless" ? [] : null;
      },
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
            listless: localPresence("/repo", { include: "/repo" }),
            hothouse: localPresence("/hothouse", {
              include: "/hothouse",
              obsidian: true,
            }),
          },
        },
      },
    });

    expect(entries.repo).toEqual({
      state: "observed",
      value: { files: [], detectedPath: "ROADMAP.md" },
    });
    expect(entries.listless).toEqual(entries.repo);
    expect(entries.empty).toEqual({
      state: "absent",
      reason: "no-roadmap-file",
    });
    expect(entries.hothouse).toMatchObject({
      state: "observed",
      value: {
        files: [
          { path: "Tech/Tech Plans.md", structure: { state: "observed" } },
          {
            path: "Missing.md",
            structure: { state: "absent", reason: "file-not-found" },
          },
        ],
        detectedPath: null,
      },
    });
  });

  it("derives a missing configured file as an error naming it", () => {
    expect(
      deriveRoadmap(
        {
          files: [
            {
              path: "Missing.md",
              structure: { state: "absent", reason: "file-not-found" },
            },
          ],
          detectedPath: null,
        },
        builtInWords,
        defaultBugThresholds,
      ),
    ).toEqual({ error: "roadmap file not found: Missing.md" });
  });
});
