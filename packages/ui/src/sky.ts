// The sky follows the clock at render; the view model carries no time. Callers pass the Date so
// the components stay free of clocks.

/** The four skies, by the hour on the local clock. */
export type SkyPhase = "dawn" | "day" | "dusk" | "night";

/** The phase for a local time: night before 6, dawn to 9, day to 17, dusk to 21, then night. */
export function skyPhase(at: Date): SkyPhase {
  const hour = at.getHours();
  if (hour < 6) return "night";
  if (hour < 9) return "dawn";
  if (hour < 17) return "day";
  if (hour < 21) return "dusk";
  return "night";
}

/** Night is cosmetic: it closes the eyes of birds that sleep and wakes them when clicked. */
export function isNight(phase: SkyPhase): boolean {
  return phase === "night";
}
