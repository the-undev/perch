import type {
  RawBullet,
  RawHeadingRef,
  RawSection,
  RoadmapStructure,
} from "./raw.ts";

const headingPattern = /^(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const bulletPattern = /^ ?(?:[-*+]|\d+[.)])[ \t]+(.*)$/;
const checkboxPattern = /^\[([ xX])\][ \t]+(.*)$/;
const fencePattern = /^[ \t]*(```|~~~)/;
const continuationPattern = /^[ \t]{2,}\S/;
const nestedBulletPattern = /^[ \t]+(?:[-*+]|\d+[.)])[ \t]/;
const tagPattern = /(?:^|\s)#([\w/-]+)/g;

/** The #tag words in a line of text, without the #. */
export function tagsIn(text: string): string[] {
  return [...text.matchAll(tagPattern)].map((match) => match[1] ?? "");
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

/**
 * Reads a roadmap file's structure as found: every heading with its enclosing headings, and the
 * top-level bullets under each. Fenced code, front matter, nested bullets and prose are skipped;
 * a bullet's indented continuation lines are joined onto it.
 */
export function readRoadmapStructure(text: string): RoadmapStructure {
  const structure: RoadmapStructure = {
    bulletsBeforeFirstHeading: [],
    sections: [],
  };
  const stack: RawHeadingRef[] = [];
  let openBullet: RawBullet | null = null;

  for (const { text: line, line: number } of bodyLines(text)) {
    const headingMatch = headingPattern.exec(line);
    if (headingMatch) {
      const level = (headingMatch[1] ?? "").length;
      while ((stack.at(-1)?.level ?? 0) >= level) stack.pop();
      const heading = headingMatch[2] ?? "";
      const section: RawSection = {
        heading,
        level,
        line: number,
        tags: tagsIn(heading),
        parents: [...stack],
        bullets: [],
      };
      stack.push({ text: heading, level, line: number });
      structure.sections.push(section);
      openBullet = null;
      continue;
    }

    const bulletMatch = bulletPattern.exec(line);
    if (bulletMatch) {
      const content = (bulletMatch[1] ?? "").trim();
      const checkbox = checkboxPattern.exec(content);
      openBullet = {
        text: checkbox ? (checkbox[2] ?? "").trim() : content,
        line: number,
        checkbox: checkbox
          ? checkbox[1] === " "
            ? "unchecked"
            : "checked"
          : "none",
        tags: [],
      };
      const section = structure.sections.at(-1);
      (section ? section.bullets : structure.bulletsBeforeFirstHeading).push(
        openBullet,
      );
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

  for (const bullet of [
    ...structure.bulletsBeforeFirstHeading,
    ...structure.sections.flatMap((section) => section.bullets),
  ]) {
    bullet.tags = tagsIn(bullet.text);
  }
  return structure;
}
