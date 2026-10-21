import type {
  RoadmapFile,
  WorkItem,
  WorkItemCounts,
  WorkItemGroup,
} from "./snapshot.ts";

interface Heading {
  level: number;
  text: string;
  line: number;
  /** Headings enclosing this one, outermost first. */
  ancestors: Heading[];
}

interface Bullet {
  text: string;
  done: boolean | null;
  line: number;
  /** Innermost heading above the bullet, null above the first heading. */
  heading: Heading | null;
}

const headingPattern = /^(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const bulletPattern = /^ ?(?:[-*+]|\d+[.)])[ \t]+(.*)$/;
const checkboxPattern = /^\[([ xX])\][ \t]+(.*)$/;
const fencePattern = /^[ \t]*(```|~~~)/;
const continuationPattern = /^[ \t]{2,}\S/;
const nestedBulletPattern = /^[ \t]+(?:[-*+]|\d+[.)])[ \t]/;
const bugTagPattern = /(?:^|\s)#bug(?![\w/-])/i;

function isBugsHeading(heading: Heading): boolean {
  return /^bugs?$/i.test(heading.text.trim());
}

function withinBugs(heading: Heading | null): boolean {
  if (heading === null) return false;
  return [...heading.ancestors, heading].some(isBugsHeading);
}

function kindOf(text: string, heading: Heading | null): WorkItem["kind"] {
  return withinBugs(heading) || bugTagPattern.test(text) ? "bug" : "feature";
}

function bodyLines(text: string): { text: string; line: number }[] {
  const lines = text.split(/\r?\n/);
  const body: { text: string; line: number }[] = [];
  let index = 0;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    index = end === -1 ? 0 : end + 1;
  }
  let inFence = false;
  for (; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (fencePattern.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) body.push({ text: line, line: index + 1 });
  }
  return body;
}

function scan(text: string): { headings: Heading[]; bullets: Bullet[] } {
  const headings: Heading[] = [];
  const bullets: Bullet[] = [];
  const stack: Heading[] = [];
  let openBullet: Bullet | null = null;

  for (const { text: line, line: number } of bodyLines(text)) {
    const headingMatch = headingPattern.exec(line);
    if (headingMatch) {
      const level = (headingMatch[1] ?? "").length;
      while ((stack.at(-1)?.level ?? 0) >= level) stack.pop();
      const heading: Heading = {
        level,
        text: headingMatch[2] ?? "",
        line: number,
        ancestors: [...stack],
      };
      stack.push(heading);
      headings.push(heading);
      openBullet = null;
      continue;
    }

    const bulletMatch = bulletPattern.exec(line);
    if (bulletMatch) {
      const content = (bulletMatch[1] ?? "").trim();
      const checkbox = checkboxPattern.exec(content);
      openBullet = {
        text: checkbox ? (checkbox[2] ?? "").trim() : content,
        done: checkbox ? checkbox[1] !== " " : null,
        line: number,
        heading: stack.at(-1) ?? null,
      };
      bullets.push(openBullet);
      continue;
    }

    if (
      openBullet !== null &&
      continuationPattern.test(line) &&
      !nestedBulletPattern.test(line)
    ) {
      openBullet.text = `${openBullet.text} ${line.trim()}`;
      continue;
    }
    openBullet = null;
  }
  return { headings, bullets };
}

function progressOf(items: readonly WorkItem[]): WorkItemGroup["progress"] {
  const checkboxes = items.filter((item) => item.done !== null);
  if (checkboxes.length === 0) return null;
  const done = checkboxes.filter((item) => item.done === true).length;
  return { done, total: checkboxes.length };
}

function grouped(
  entries: readonly { group: Heading | null; item: WorkItem }[],
): WorkItemGroup[] {
  const byHeading = new Map<Heading | null, WorkItem[]>();
  for (const { group, item } of entries) {
    const items = byHeading.get(group) ?? [];
    items.push(item);
    byHeading.set(group, items);
  }
  return [...byHeading].map(([heading, items]) => ({
    heading: heading?.text ?? null,
    level: heading?.level ?? 0,
    items,
    progress: progressOf(items),
  }));
}

/**
 * Parses a roadmap file into work items grouped by heading.
 * Items are the file's top-level bullets, or its headings below the title when it has no bullets.
 */
export function parseRoadmap(path: string, text: string): RoadmapFile {
  const { headings, bullets } = scan(text);

  if (bullets.length > 0) {
    return {
      path,
      itemSource: "bullets",
      groups: grouped(
        bullets.map((bullet) => ({
          group: bullet.heading,
          item: {
            text: bullet.text,
            kind: kindOf(bullet.text, bullet.heading),
            done: bullet.done,
            line: bullet.line,
          },
        })),
      ),
    };
  }

  const itemHeadings = headings.filter(
    (heading) => heading.level > 1 && !isBugsHeading(heading),
  );
  return {
    path,
    itemSource: "headings",
    groups: grouped(
      itemHeadings.map((heading) => {
        const parent = heading.ancestors.at(-1) ?? null;
        return {
          group: parent,
          item: {
            text: heading.text,
            kind: kindOf(heading.text, parent),
            done: null,
            line: heading.line,
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
