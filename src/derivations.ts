// Every derivation rule perch applies to raw facts, in one place. Gathering never judges; each
// rule here can be read and changed without touching how the machine is read.

import type { RawSection, RoadmapStructure } from "./raw.ts";
import type {
  RoadmapFile,
  WorkItem,
  WorkItemCounts,
  WorkItemGroup,
} from "./snapshot.ts";

// Work items

/** A heading named Bug or Bugs, in any case, marks everything beneath it as a bug. */
export function isBugsHeading(text: string): boolean {
  return /^bugs?$/i.test(text.trim());
}

/** A #bug tag on an item's line marks it as a bug wherever it sits. */
function hasBugTag(tags: readonly string[]): boolean {
  return tags.some((tag) => tag.toLowerCase() === "bug");
}

function underBugs(section: RawSection): boolean {
  return [
    ...section.parents.map((parent) => parent.text),
    section.heading,
  ].some(isBugsHeading);
}

/** Progress is checked against total checkbox items; null for a group without checkboxes. */
function progressOf(items: readonly WorkItem[]): WorkItemGroup["progress"] {
  const checkboxes = items.filter((item) => item.done !== null);
  if (checkboxes.length === 0) return null;
  const done = checkboxes.filter((item) => item.done === true).length;
  return { done, total: checkboxes.length };
}

interface GroupKey {
  heading: string | null;
  level: number;
  line: number;
}

function grouped(
  entries: readonly { group: GroupKey; item: WorkItem }[],
): WorkItemGroup[] {
  const groups = new Map<number, { key: GroupKey; items: WorkItem[] }>();
  for (const { group, item } of entries) {
    const existing = groups.get(group.line) ?? { key: group, items: [] };
    existing.items.push(item);
    groups.set(group.line, existing);
  }
  return [...groups.values()].map(({ key, items }) => ({
    heading: key.heading,
    level: key.level,
    items,
    progress: progressOf(items),
  }));
}

/**
 * Work items from one roadmap file. When the file has any top-level bullet, the bullets are the
 * items, grouped by their heading. Otherwise every heading below level 1, except a Bugs heading,
 * is an item, grouped by its parent heading. Checkboxes set done; plain bullets leave it null.
 */
export function deriveRoadmapFile(
  path: string,
  structure: RoadmapStructure,
): RoadmapFile {
  const bulletCount =
    structure.bulletsBeforeFirstHeading.length +
    structure.sections.reduce(
      (sum, section) => sum + section.bullets.length,
      0,
    );

  if (bulletCount > 0) {
    const ungrouped: GroupKey = { heading: null, level: 0, line: 0 };
    const entries = [
      ...structure.bulletsBeforeFirstHeading.map((bullet) => ({
        group: ungrouped,
        bullet,
        bugs: false,
      })),
      ...structure.sections.flatMap((section) =>
        section.bullets.map((bullet) => ({
          group: {
            heading: section.heading,
            level: section.level,
            line: section.line,
          },
          bullet,
          bugs: underBugs(section),
        })),
      ),
    ];
    return {
      path,
      itemSource: "bullets",
      groups: grouped(
        entries.map(({ group, bullet, bugs }) => ({
          group,
          item: {
            text: bullet.text,
            kind: bugs || hasBugTag(bullet.tags) ? "bug" : "feature",
            done:
              bullet.checkbox === "none" ? null : bullet.checkbox === "checked",
            line: bullet.line,
          },
        })),
      ),
    };
  }

  const itemSections = structure.sections.filter(
    (section) => section.level > 1 && !isBugsHeading(section.heading),
  );
  return {
    path,
    itemSource: "headings",
    groups: grouped(
      itemSections.map((section) => {
        const parent = section.parents.at(-1);
        const bugs = section.parents.some((ancestor) =>
          isBugsHeading(ancestor.text),
        );
        return {
          group: parent
            ? { heading: parent.text, level: parent.level, line: parent.line }
            : { heading: null, level: 0, line: 0 },
          item: {
            text: section.heading,
            kind: bugs || hasBugTag(section.tags) ? "bug" : "feature",
            done: null,
            line: section.line,
          },
        };
      }),
    ),
  };
}

/** Counts open items by kind across files; done items are left out. */
export function countOpenItems(files: readonly RoadmapFile[]): WorkItemCounts {
  const counts: WorkItemCounts = { bug: 0, feature: 0 };
  for (const file of files) {
    for (const group of file.groups) {
      for (const item of group.items) {
        if (item.done !== true) counts[item.kind] += 1;
      }
    }
  }
  return counts;
}
