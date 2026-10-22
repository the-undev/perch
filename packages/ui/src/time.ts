// Times on the detail page, in the speech's duration words, measured to a moment the caller
// passes: components hold no clock.

import { hoursWords } from "@perch/core/speech.ts";

/** How long before `now` an ISO time was: "under an hour ago", "30 hours ago", "three weeks ago". */
export function agoWords(at: string, now: Date): string {
  const hours = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(at)) / 3_600_000),
  );
  return `${hoursWords(hours)} ago`;
}
