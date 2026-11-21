import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  formatISO,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";

/** A snooze's end: a calendar date in local time as `YYYY-MM-DD`, or null for indefinitely. */
export type SnoozeEnd = string | null;

export type SnoozeDuration =
  | "1 day"
  | "3 days"
  | "1 week"
  | "2 weeks"
  | "1 month";

const ADD_DURATION: Record<SnoozeDuration, (from: Date) => Date> = {
  "1 day": (from) => addDays(from, 1),
  "3 days": (from) => addDays(from, 3),
  "1 week": (from) => addWeeks(from, 1),
  "2 weeks": (from) => addWeeks(from, 2),
  "1 month": (from) => addMonths(from, 1),
};

/** The end date for a duration counted from the local day of `today`. */
export function snoozeEndDate(duration: SnoozeDuration, today: Date): string {
  return formatISO(ADD_DURATION[duration](today), { representation: "date" });
}

/** Whether a snooze has ended: from the start of its end date in local time, never when indefinite. */
export function hasSnoozeEnded(endDate: SnoozeEnd, now: Date): boolean {
  if (endDate === null) return false;
  return !isBefore(now, startOfDay(parseISO(endDate)));
}

/** The words for an end date: the weekday within six days, else day and month. */
export function snoozeWords(endDate: SnoozeEnd, today: Date): string {
  if (endDate === null) return "until you wake it";
  const end = parseISO(endDate);
  const days = differenceInCalendarDays(end, today);
  return days <= 6
    ? `until ${format(end, "EEEE")}`
    : `until ${format(end, "d MMMM")}`;
}
