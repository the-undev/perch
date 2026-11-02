// The speech bubble: paper against the sky, the bird's name and mood word, its first-person
// speech, the chips it carries, the launch actions and, for a fence bird, the adopt key, with a
// tail whose tip meets the beak. On the bird's own page the bubble is the speech and chips alone.
// Either way the chips are handles to the ledger rows holding their working.

import type {
  Bubble as BubbleModel,
  ChipKind,
  LaunchAction,
  StateWord,
} from "@perch/core/viewmodel.ts";
import { ChipHandles } from "./chip.tsx";
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

/** The hanging tail, drawn to the given drop below the bubble's bottom edge. */
function Tail({
  tail,
  drop,
  className,
}: {
  tail: BubbleTail;
  drop: number;
  className: string;
}) {
  const offset = `${tail.inset - tailTipInset}px`;
  return (
    <svg
      aria-hidden="true"
      data-part="tail-hanging"
      viewBox="0 0 44 30"
      preserveAspectRatio="none"
      width={44}
      height={((drop + 3) * 30) / 29}
      className={`pointer-events-none absolute ${className}`}
      style={
        tail.side === "left"
          ? { top: "calc(100% - 3px)", left: offset }
          : {
              top: "calc(100% - 3px)",
              right: offset,
              transform: "scaleX(-1)",
            }
      }
    >
      <path d="M 6 0 Q 14 18 2 29 Q 22 22 34 2 Z" fill="var(--color-paper)" />
    </svg>
  );
}

/** A tail leaving the bubble's right edge and slanting down to its tip: `reach` pixels out, `tipY` below the bubble's top. */
export interface SideTailShape {
  reach: number;
  tipY: number;
}

/** The base starts this far below the bubble's top, is this tall, and starts this far inside the paper. */
export const sideTailBaseTop = 12;
export const sideTailBaseHeight = 16;
export const sideTailOverlap = 3;

/** The drawing's width: the reach plus the part inside the paper. */
export function sideTailWidth(tail: SideTailShape): number {
  return tail.reach + sideTailOverlap;
}

/** The drawing's height: down to the tip, with a pixel to spare. */
export function sideTailHeight(tail: SideTailShape): number {
  return Math.ceil(tail.tipY) + 1;
}

/** The tail's outline: a base on the bubble's edge narrowing to a tip at (width, tipY). */
export function sideTailPath(tail: SideTailShape): string {
  const width = sideTailWidth(tail);
  const top = sideTailBaseTop;
  const bottom = sideTailBaseTop + sideTailBaseHeight;
  const rise = tail.tipY - top;
  return `M 0 ${top} Q ${width * 0.55} ${top + rise * 0.1} ${width} ${tail.tipY} Q ${width * 0.4} ${bottom + (tail.tipY - bottom) * 0.6} 0 ${bottom} Z`;
}

/** The sideways tail, for a bubble whose speaker stands to its right and below its top. */
function SideTail({
  tail,
  className,
}: {
  tail: SideTailShape;
  className: string;
}) {
  const width = sideTailWidth(tail);
  const height = sideTailHeight(tail);
  return (
    <svg
      aria-hidden="true"
      data-part="tail-side"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={`pointer-events-none absolute ${className}`}
      style={{ top: 0, left: `calc(100% - ${sideTailOverlap}px)` }}
    >
      <path d={sideTailPath(tail)} fill="var(--color-paper)" />
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
  /** A chip was pressed: rides to the page and lands on the ledger row holding its working. */
  onChip: (chip: ChipKind) => void;
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
  onChip,
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
      <ChipHandles chips={bubble.chips} onPress={onChip} />
      <div className="mt-3 flex items-center gap-2">
        {actions.map((action, index) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: a bird's actions are a fixed list in config order, and two may share a kind or a verb.
            key={index}
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
      <Tail tail={tail} drop={tailDrop} className="" />
    </section>
  );
}

export interface RoostBubbleProps {
  bubble: BubbleModel;
  /** The sky is at night: a bird that sleeps speaks with the waking prefix. */
  night: boolean;
  /** The tail that hangs from the bottom edge when the roost is stacked. */
  tail: BubbleTail;
  /** How far the hanging tail's tip falls below the bubble's bottom edge. */
  drop: number;
  /** The tail that leaves the right edge when the roost is a row. */
  sideTail: SideTailShape;
  /** A chip was pressed: the page lands on the ledger row holding its working. */
  onChip: (chip: ChipKind) => void;
}

/** The bubble on the bird's own page: speech and chips as handles, the name and state word left to the page's heading. */
export function RoostBubble({
  bubble,
  night,
  tail,
  drop,
  sideTail,
  onChip,
}: RoostBubbleProps) {
  return (
    <section
      aria-label={`${bubble.name} says`}
      data-part="roost-bubble"
      className={`${paperClass} w-full`}
    >
      <p data-part="speech" className="m-0">
        {spokenSpeech(bubble, night)}
      </p>
      <ChipHandles chips={bubble.chips} onPress={onChip} />
      <Tail tail={tail} drop={drop} className="@min-[460px]:hidden" />
      <SideTail tail={sideTail} className="hidden @min-[460px]:block" />
    </section>
  );
}
