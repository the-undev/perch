// The top of a bird's detail page: tiers A and B continued onto the ground, the name large, the
// mood in its colour, what the bird is doing, and its speech.

import type { Activity, Bird } from "@perch/core/viewmodel.ts";
import { spokenSpeech } from "./bubble.tsx";

const moodTone = {
  content: "text-green",
  restless: "text-amber",
  distressed: "text-red",
  "not adopted": "text-ink-faint",
} as const;

/** What a bird is doing, in words; settled says nothing. */
export const activityWords: Record<Activity, string | null> = {
  editing: "editing ♪",
  "in-flight": "in flight",
  settled: null,
};

export interface DetailIntroProps {
  bird: Bird;
  night: boolean;
}

/** The detail page's heading: name, mood word, activity, and the speech in full. */
export function DetailIntro({ bird, night }: DetailIntroProps) {
  const activity = bird.activity === null ? null : activityWords[bird.activity];
  return (
    <header className="max-w-245">
      <div className="flex flex-wrap items-baseline gap-4">
        <h2 className="m-0 font-bold font-display text-[42px] leading-none tracking-[-0.02em]">
          {bird.name}
        </h2>
        <span
          className={`font-body font-semibold text-[14px] ${moodTone[bird.bubble.stateWord]}`}
        >
          {bird.bubble.stateWord}
        </span>
        {activity !== null && (
          <span className="text-[13px] text-ink-accent">{activity}</span>
        )}
      </div>
      <p className="mt-2.25 mb-0 max-w-[64ch] text-[16.5px] text-ink-muted leading-[1.55]">
        {spokenSpeech(bird.bubble, night)}
      </p>
    </header>
  );
}
