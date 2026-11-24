// The top of a bird's page: the name large, the state word in the mood's colour, what the bird is
// doing, and a meta line saying where it lives, the page's actions beside it where they fit. The
// speech belongs to the roost's bubble.

import type { Activity, Bird } from "@perch/core/viewmodel.ts";
import type { ReactNode } from "react";
import { birdLook, stateTone } from "./bird.tsx";

/** What a bird is doing, in words; settled says nothing. */
export const activityWords: Record<Activity, string | null> = {
  editing: "editing ♪",
  "in-flight": "in flight",
  settled: null,
};

/** Where the bird lives, as the meta line says it: the local repository with ~, the forges, then the wire. */
export function whereabouts(bird: Bird): string {
  const { localRepositoryPath, forges } = bird.detail;
  return [
    ...(localRepositoryPath === null ? [] : [localRepositoryPath]),
    ...(forges.length === 0 ? [] : [forges.join(", ")]),
    bird.wire === null ? "on the fence" : `on ${bird.wire}`,
  ].join(" · ");
}

export interface DetailHeadingProps {
  bird: Bird;
  /** The render's clock: the state word and a snooze's end follow it. */
  now: Date;
  /** The page's verbs and links, one group on the meta line's row where it fits and beneath the meta where not; null for none. */
  actions: ReactNode;
}

/** The page's heading in two tight rows: the one place on the page that carries the name and the state word, then the meta with the actions. */
export function DetailHeading({ bird, now, actions }: DetailHeadingProps) {
  const look = birdLook(bird, now);
  const activity = bird.activity === null ? null : activityWords[bird.activity];
  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 font-bold font-display text-[30px] leading-tight tracking-[-0.01em]">
          {bird.name}
        </h2>
        <span
          data-part="state-word"
          className={`font-body font-semibold text-[11px] uppercase tracking-[0.1em] ${stateTone[look.stateWord]}`}
        >
          {look.stateWord}
        </span>
        {look.snoozedUntil !== null && (
          <span
            data-part="snoozed-until"
            className="text-[12.5px] text-ink-accent"
          >
            {look.snoozedUntil}
          </span>
        )}
        {activity !== null && (
          <span className="text-[12.5px] text-ink-accent">{activity}</span>
        )}
      </div>
      <div
        data-part="meta-row"
        className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1"
      >
        <p
          data-part="meta"
          className="m-0 min-w-0 break-words font-mono text-[12.5px] text-ink-faint"
        >
          {whereabouts(bird)}
        </p>
        {actions}
      </div>
    </header>
  );
}
