// The speech bubble: paper against the sky, the bird's name and mood word, its first-person
// speech, the chips it carries, the launch actions and, for a fence bird, the adopt key, with a
// tail whose tip meets the beak. On the bird's own page the bubble is the speech and chips alone.

import type {
  Bubble as BubbleModel,
  LaunchAction,
  StateWord,
} from "@perch/core/viewmodel.ts";
import { Chips } from "./chip.tsx";
import { actionIcon, Icon } from "./icons.tsx";

/** The state word's ink on paper: the mood's colour, quiet for the fence. */
export const stateWordTone: Record<StateWord, string> = {
  content: "text-paper-green",
  restless: "text-paper-amber",
  distressed: "text-paper-red",
  "not adopted": "text-paper-quiet",
};

/** Where the tail hangs: which edge it is measured from, and the distance from that edge to its tip. */
export interface BubbleTail {
  side: "left" | "right";
  inset: number;
}

/** The speech a bubble shows: at night a sleeping bird is woken by the click and says so. */
export function spokenSpeech(bubble: BubbleModel, night: boolean): string {
  return night ? (bubble.wokenSpeech ?? bubble.speech) : bubble.speech;
}

/** The tail's tip sits 2 units in from the edge of its 44-unit drawing. */
const tailTipInset = 2;

/** How far below the bubble's bottom edge the tail's tip hangs, in pixels. */
export const tailDrop = 26;

/** The bubble's paper, wherever it hangs. */
const paperClass =
  "relative rounded-bubble bg-paper px-4 pt-3.5 pb-3.25 text-[13.5px] text-paper-text leading-normal shadow-bubble";

function Tail({ tail }: { tail: BubbleTail }) {
  const offset = `${tail.inset - tailTipInset}px`;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 44 30"
      width={44}
      height={30}
      className="pointer-events-none absolute -bottom-6.75"
      style={
        tail.side === "left"
          ? { left: offset }
          : { right: offset, transform: "scaleX(-1)" }
      }
    >
      <path d="M 6 0 Q 14 18 2 29 Q 22 22 34 2 Z" fill="var(--color-paper)" />
    </svg>
  );
}

export interface BubbleProps {
  bubble: BubbleModel;
  /** The sky is at night: a bird that sleeps speaks with the waking prefix. */
  night: boolean;
  /** The bird's launch actions, shown as icon buttons named by their verbs. */
  actions: LaunchAction[];
  onLaunch: (action: LaunchAction) => void;
  /** Rides the camera down to the bird's detail page. */
  onFullStory: () => void;
  /** Rides to the page with the adoption papers unfolded; null for an adopted bird, which has no adopt key. */
  onAdopt: (() => void) | null;
  tail: BubbleTail;
}

/** Tier B: a bird's answer to "what's up with you?". */
export function Bubble({
  bubble,
  night,
  actions,
  onLaunch,
  onFullStory,
  onAdopt,
  tail,
}: BubbleProps) {
  const origin =
    tail.side === "left"
      ? `${tail.inset}px 100%`
      : `calc(100% - ${tail.inset}px) 100%`;
  return (
    <section
      aria-label={`${bubble.name} says`}
      className={`${paperClass} w-97.5 max-w-full motion-safe:animate-bubble-pop`}
      style={{ transformOrigin: origin }}
    >
      <h3 className="mb-1 flex items-baseline gap-2.5 font-bold font-display text-[16px] text-paper-strong">
        {bubble.name}
        <span
          data-part="state-word"
          className={`font-body font-semibold text-[10px] uppercase tracking-[0.12em] ${stateWordTone[bubble.stateWord]}`}
        >
          {bubble.stateWord}
        </span>
      </h3>
      <p data-part="speech" className="m-0">
        {spokenSpeech(bubble, night)}
      </p>
      <Chips chips={bubble.chips} />
      <div className="mt-3 flex items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.kind}
            type="button"
            title={action.verb}
            aria-label={action.verb}
            onClick={() => onLaunch(action)}
            className="inline-flex cursor-pointer items-center rounded-lg bg-key px-2.5 py-2 text-ink hover:bg-key-hi"
          >
            <Icon name={actionIcon[action.kind]} size={14} />
          </button>
        ))}
        {onAdopt !== null && (
          <button
            type="button"
            onClick={onAdopt}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-key px-3 py-2 font-body font-semibold text-[12.5px] text-ink hover:bg-key-hi"
          >
            <Icon name="adopt" size={14} />
            Adopt
          </button>
        )}
        <button
          type="button"
          onClick={onFullStory}
          className="ml-auto cursor-pointer rounded-lg bg-key-strong px-3.5 py-2 font-body font-semibold text-[12.5px] text-ink hover:bg-key-hi"
        >
          Tell me the full story
        </button>
      </div>
      <Tail tail={tail} />
    </section>
  );
}

export interface RoostBubbleProps {
  bubble: BubbleModel;
  /** The sky is at night: a bird that sleeps speaks with the waking prefix. */
  night: boolean;
  tail: BubbleTail;
}

/** The bubble on the bird's own page: speech and chips, the name and state word left to the page's heading. */
export function RoostBubble({ bubble, night, tail }: RoostBubbleProps) {
  return (
    <section
      aria-label={`${bubble.name} says`}
      data-part="roost-bubble"
      className={`${paperClass} w-full`}
    >
      <p data-part="speech" className="m-0">
        {spokenSpeech(bubble, night)}
      </p>
      <Chips chips={bubble.chips} />
      <Tail tail={tail} />
    </section>
  );
}
