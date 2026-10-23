// Times on the detail page and the settings page, in the speech's duration words, measured to a
// moment the caller passes: components hold no clock.

import { hoursWords } from "@perch/core/speech.ts";

/** How long before `now` an ISO time was: "under an hour ago", "30 hours ago", "three weeks ago". */
export function agoWords(at: string, now: Date): string {
  const hours = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(at)) / 3_600_000),
  );
  return `${hoursWords(hours)} ago`;
}

/** How long before `now` a recent ISO time was, by the minute within the hour: "4 min ago". */
export function recentWords(at: string, now: Date): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(at)) / 60_000),
  );
  if (minutes < 1) return "under a minute ago";
  if (minutes < 60) return `${minutes} min ago`;
  return agoWords(at, now);
}
