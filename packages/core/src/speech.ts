// What a bird says, by the phrasebook (design/phrasebook.html): first person, present tense, three
// sentences at most, the worst cause first and at most one secondary, calm punctuation. Times are
// durations measured at the scan, so the words need no clock and no time zone.

import type { ForgeName } from "./snapshot.ts";
import type { Activity, HealthCause } from "./viewmodel.ts";

/** The prefix a sleeping bird's speech gains when it is clicked at night. */
export const wakingPrefix = "Mm? You woke me.";

/** Where a fence bird stands: forge only, one disk with no remote, or found and undecided. */
export type FenceSituation =
  | { kind: "forge-only"; forge: ForgeName; fullName: string }
  | { kind: "one-disk" }
  | { kind: "undecided" };

/** Everything the speech is chosen from, all of it read off the snapshot. */
export interface SpeechSubject {
  /** Null for an adopted bird; a fence bird speaks only of where it stands. */
  fence: FenceSituation | null;
  /** Amber and red causes, worst first. */
  causes: readonly HealthCause[];
  activity: Activity | null;
  branch: string | null;
  defaultBranch: string | null;
  unpushedCount: number;
  openItems: number;
  /** Hours from the newest commit to the scan; null when there is none. */
  lastTouchedHours: number | null;
}

const smallNumbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

/** A count in words up to twenty, in digits beyond. */
export function countWords(count: number): string {
  return smallNumbers[count] ?? String(count);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** A span of days: days under a fortnight, weeks under thirty days, months beyond. */
export function daysWords(days: number): string {
  if (days < 1) return "under a day";
  if (days === 1) return "a day";
  if (days < 14) return `${countWords(days)} days`;
  if (days < 30) return `${countWords(Math.floor(days / 7))} weeks`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month" : `${countWords(months)} months`;
}

/** A span of hours: hours under two days, then as days. */
export function hoursWords(hours: number): string {
  if (hours < 1) return "under an hour";
  if (hours === 1) return "an hour";
  if (hours < 48) return `${countWords(hours)} hours`;
  return daysWords(Math.floor(hours / 24));
}

/** A window from config: whole days when it is a multiple of a day, else hours. */
function windowWords(hours: number): string {
  return hours % 24 === 0 ? daysWords(hours / 24) : hoursWords(hours);
}

const forgeLabel: Record<ForgeName, string> = {
  github: "GitHub",
  forgejo: "Forgejo",
};

/** The opening sentence a cause speaks first, and the closing remark it adds when alone. */
function primary(cause: HealthCause): {
  opening: string[];
  closing: string | null;
} {
  switch (cause.kind) {
    case "ci-failing":
      return {
        opening: [`My CI is failing on ${cause.branch}.`],
        closing: "Start there.",
      };
    case "bugs":
      return {
        opening: [
          `${capitalise(countWords(cause.count))} ${plural(cause.count, "bug", "bugs")} open against me.`,
        ],
        closing: "Not thrilled about it.",
      };
    case "uncommitted": {
      const count = capitalise(countWords(cause.count));
      const span = hoursWords(cause.work.hours);
      if (cause.level === "red") {
        return {
          opening: [
            `${count} ${plural(cause.count, "change", "changes")} uncommitted for ${span}.`,
          ],
          closing: "I'd rather not be the only copy.",
        };
      }
      return {
        opening: [
          `${count} ${plural(cause.count, "change has", "changes have")} sat uncommitted for ${span}.`,
        ],
        closing: `Past ${windowWords(cause.thresholds.amberHours)} now.`,
      };
    }
    case "unpushed": {
      const count = capitalise(countWords(cause.count));
      return {
        opening: [
          `${count} ${plural(cause.count, "commit has", "commits have")} been local only for ${hoursWords(cause.work.hours)}.`,
        ],
        closing:
          cause.level === "red"
            ? "I'd rather not be the only copy."
            : `Nothing stops ${plural(cause.count, "it", "them")} being pushed.`,
      };
    }
    case "stalled":
      return {
        opening: [
          `Parked on ${cause.stall.branch} for ${daysWords(cause.stall.days)}.`,
        ],
        closing: cause.everythingPushed
          ? "Everything's pushed, but the flight's gone quiet."
          : "The flight's gone quiet.",
      };
  }
}

/** The one sentence a cause speaks when another cause is worse. */
function secondary(cause: HealthCause): string {
  switch (cause.kind) {
    case "ci-failing":
      return `My CI is also failing on ${cause.branch}.`;
    case "bugs":
      return `I've also got ${countWords(cause.count)} ${plural(cause.count, "bug", "bugs")} open.`;
    case "uncommitted":
      return `I'm also holding ${countWords(cause.count)} uncommitted ${plural(cause.count, "change", "changes")} for ${hoursWords(cause.work.hours)}.`;
    case "unpushed":
      return `I'm also holding ${countWords(cause.count)} local-only ${plural(cause.count, "commit", "commits")} for ${hoursWords(cause.work.hours)}.`;
    case "stalled":
      return `I've also been parked on ${cause.stall.branch} for ${daysWords(cause.stall.days)}.`;
  }
}

function fenceSpeech(situation: FenceSituation): string {
  switch (situation.kind) {
    case "forge-only":
      return `Nobody's cloned me yet. I live on ${forgeLabel[situation.forge]} as ${situation.fullName}.`;
    case "one-disk":
      return "I only exist on this machine. One disk, no backup.";
    case "undecided":
      return "Still on the fence. You haven't decided about me.";
  }
}

/** A content bird is brief: what it is doing, else its backlog as an offer, else that it is settled. */
function contentSpeech(subject: SpeechSubject): string {
  if (subject.activity === "editing") {
    return "We're in the middle of something. ♪";
  }
  const { branch, defaultBranch, unpushedCount } = subject;
  if (
    subject.activity === "in-flight" &&
    branch !== null &&
    branch !== defaultBranch
  ) {
    return `Out on ${branch}. All fresh so far.`;
  }
  if (subject.activity === "in-flight" && unpushedCount > 0) {
    return `${capitalise(countWords(unpushedCount))} ${plural(unpushedCount, "commit", "commits")} waiting to go up. All fresh so far.`;
  }
  if (subject.openItems > 0) {
    return `All settled, and ${countWords(subject.openItems)} ${plural(subject.openItems, "item", "items")} on my roadmap when you want me.`;
  }
  if (subject.lastTouchedHours === null) return "All settled over here.";
  return `All settled over here. Last touched ${hoursWords(subject.lastTouchedHours)} ago.`;
}

/**
 * The bird's speech. A fence bird says where it stands. Otherwise the worst cause speaks first,
 * with its closing remark only when nothing else follows; the next cause adds one sentence; the
 * rest stays in the chips. Without causes the bird is content.
 */
export function speak(subject: SpeechSubject): string {
  if (subject.fence !== null) return fenceSpeech(subject.fence);
  const [worst, next] = subject.causes;
  if (worst === undefined) return contentSpeech(subject);
  const { opening, closing } = primary(worst);
  if (next !== undefined) return [...opening, secondary(next)].join(" ");
  return [...opening, ...(closing === null ? [] : [closing])].join(" ");
}
