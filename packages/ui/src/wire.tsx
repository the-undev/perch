// A wire and the fence, drawn into a Scene. Birds keep the view model's order, leftmost needing
// attention first, spread evenly and turned to face the middle.

import type {
  Bird as BirdModel,
  Fence as FenceModel,
  Wire as WireModel,
} from "@perch/core/viewmodel.ts";
import { Fragment } from "react";
import { Bird, type Facing, type NamePlace, roomyName } from "./bird.tsx";

/** The margin no bird is placed inside, at either end of the scene. */
export const edgeMargin = 120;

/** How far a wire dips at its middle below its ends' line. */
const sag = 22;

/** The x of the index-th of count evenly spaced places, at most `gap` apart, centred between left and right; with no room between them they bunch at left. */
export function placeBetween(
  index: number,
  count: number,
  gap: number,
  left: number,
  right: number,
): number {
  const room = Math.max(0, right - left);
  const span = Math.min((count - 1) * gap, room);
  return left + (room - span) / 2 + (span / Math.max(count - 1, 1)) * index;
}

/** The x of the index-th of count evenly spaced places, at most `gap` apart, centred between the margins. */
export function placeAt(
  index: number,
  count: number,
  gap: number,
  width: number,
): number {
  return placeBetween(index, count, gap, edgeMargin, width - edgeMargin);
}

/** How far apart neighbours sit among count places at most `gap` apart between left and right: the room shared out. */
export function spacingBetween(
  count: number,
  gap: number,
  left: number,
  right: number,
): number {
  return Math.min(gap, Math.max(0, right - left) / Math.max(count - 1, 1));
}

/** How far apart neighbours sit among count places at most `gap` apart between the margins. */
export function placeSpacing(
  count: number,
  gap: number,
  width: number,
): number {
  return spacingBetween(count, gap, edgeMargin, width - edgeMargin);
}

/** The width a layout reserves for a character, as a fraction of its type size: generous, so no bird touches a word. */
export const labelAdvance = 0.6;

/** Where a wire's name and tally start, in from the scene's left edge. */
const wireLabelX = 36;

/** The type size of a wire's name and tally, in scene units. */
const wireLabelSize = 11;

/** The letter spacing of a wire's name, as a fraction of its type size. */
const wireNameTracking = 0.18;

/** Where a wire's name and tally end, estimated from their characters as the strip's label is. */
export function wireLabelRight(name: string, birds: BirdModel[]): number {
  return (
    wireLabelX +
    name.length * wireLabelSize * (labelAdvance + wireNameTracking) +
    tallyGap +
    tallyText(birds).length * wireLabelSize * labelAdvance
  );
}

/** How far right of its label a wire's birds keep: the plumpest wire bird's tail, 44 units behind its toes at 0.9 times 1.65. */
export const labelClearance = 66;

/** Neighbours closer than this alternate their names between a near and a lower baseline. */
export const alternateBelow = 150;

/** Neighbours closer than this also set their names a size smaller. */
export const smallerBelow = 100;

/** How far the lower baseline sits beneath the near one: a line of names and a clear gap. */
export const lowerRowDrop = 22;

/**
 * Where the index-th bird's name goes when neighbours sit `spacing` apart: every other name drops
 * to the lower baseline once they are close, and all of them take the smaller size once closer
 * still. `nearDrop` is the near baseline's drop below the perch.
 */
export function namePlace(
  index: number,
  spacing: number,
  nearDrop: number,
): NamePlace {
  const lower = spacing < alternateBelow && index % 2 === 1;
  return {
    drop: nearDrop + (lower ? lowerRowDrop : 0),
    size: spacing < smallerBelow ? "small" : "full",
  };
}

/** Birds on the left half face right, birds on the right half face left. */
export function facingAt(x: number, width: number): Facing {
  return x < width / 2 ? "right" : "left";
}

/** The height of the sagging wire at x: a quadratic from end to end through the dip. */
export function wireHeight(y: number, x: number, width: number): number {
  const t = (x + 20) / (width + 40);
  return (
    (1 - t) * (1 - t) * (y - 12) +
    2 * (1 - t) * t * (y + sag) +
    t * t * (y - 12)
  );
}

/** Birds in their view model order, leftmost first. */
export function byPosition(birds: BirdModel[]): BirdModel[] {
  return [...birds].sort((a, b) => a.position - b.position);
}

/** The words beside a wire's name: how many need attention, how many drift, else all settled. */
export function wireTally(birds: BirdModel[]): {
  attention: number;
  drifting: number;
} {
  return {
    attention: birds.filter((bird) => bird.mood === "distressed").length,
    drifting: birds.filter((bird) => bird.mood === "restless").length,
  };
}

/** The space between a wire's name and its tally, in scene units. */
export const tallyGap = 18;

/** The tally's words in order, each with its ink; "all settled" when nothing else is said. */
function tallyWords(
  birds: BirdModel[],
): { words: string; ink: string | undefined }[] {
  const { attention, drifting } = wireTally(birds);
  const said = [
    { count: attention, words: `${attention} attention`, ink: "fill-red" },
    { count: drifting, words: `${drifting} drifting`, ink: "fill-amber" },
  ].filter((part) => part.count > 0);
  return said.length > 0 ? said : [{ words: "all settled", ink: undefined }];
}

/** The tally as one line of text, as the tspans spell it. */
export function tallyText(birds: BirdModel[]): string {
  return tallyWords(birds)
    .map((part) => part.words)
    .join(" · ");
}

/**
 * The tally as tspans, set `gap` units after whatever precedes them in their text. The gap rides
 * on the first word itself: an empty tspan holds no character for an offset to move.
 */
export function Tally({ birds, gap }: { birds: BirdModel[]; gap: number }) {
  return (
    <>
      {tallyWords(birds).map((part, index) => (
        <Fragment key={part.words}>
          {index > 0 && <tspan> · </tspan>}
          <tspan dx={index === 0 ? gap : undefined} className={part.ink}>
            {part.words}
          </tspan>
        </Fragment>
      ))}
    </>
  );
}

export interface WireLineProps {
  /** The wire's height in scene units, at its ends before the sag. */
  y: number;
  width: number;
  /** The wire's name and the birds its tally counts; null for a wire's second row, which is unnamed. */
  label: { name: string; birds: BirdModel[] } | null;
}

/** The sagging wire itself, with its name and tally above the left end when it has them. */
export function WireLine({ y, width, label }: WireLineProps) {
  return (
    <>
      <path
        d={`M -20 ${y - 12} Q ${width / 2} ${y + sag} ${width + 20} ${y - 12}`}
        stroke="var(--color-wire)"
        strokeWidth={3}
        fill="none"
      />
      {label !== null && (
        <text
          x={wireLabelX}
          y={y - 26}
          className="fill-ink-faint font-body text-[11px]"
        >
          <tspan className="font-bold uppercase tracking-[0.18em]">
            {label.name}
          </tspan>
          <Tally birds={label.birds} gap={tallyGap} />
        </text>
      )}
    </>
  );
}

export interface FenceRailProps {
  /** The rail's height in scene units. */
  y: number;
  width: number;
  /** The scene's height: the posts run from the rail to the bottom. */
  height: number;
  /** How many birds sit on the fence, for its label. */
  count: number;
}

/** The fence's rail on its posts, with its label. */
export function FenceRail({ y, width, height, count }: FenceRailProps) {
  const posts = Array.from(
    { length: Math.ceil((width - 120) / 320) },
    (_, i) => 120 + i * 320,
  );
  return (
    <>
      <line
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke="var(--color-post)"
        strokeWidth={8}
      />
      {posts.map((x) => (
        <line
          key={x}
          x1={x}
          y1={y - 6}
          x2={x}
          y2={height + 20}
          stroke="var(--color-post)"
          strokeWidth={10}
          opacity={0.7}
        />
      ))}
      <text
        x={36}
        y={y - 70}
        className="fill-ink-faint font-body font-bold text-[11px] uppercase tracking-[0.18em]"
      >
        On the fence · {count} not adopted
      </text>
    </>
  );
}

/** The gap between birds on a wire, at most; a crowded wire squeezes them closer. */
export const wireGap = 340;

/** The gap between birds on the fence, at most. */
export const fenceGap = 205;

export interface WireProps {
  wire: WireModel;
  /** The wire's height in scene units, at its ends before the sag. */
  y: number;
  width: number;
  night: boolean;
}

/** One priority band: the wire, its name and tally, and its birds leftmost first. */
export function Wire({ wire, y, width, night }: WireProps) {
  const birds = byPosition(wire.birds);
  const spacing = placeSpacing(birds.length, wireGap, width);
  return (
    <g data-wire={wire.name}>
      <WireLine y={y} width={width} label={{ name: wire.name, birds }} />
      {birds.map((bird, i) => {
        const x = placeAt(i, birds.length, wireGap, width);
        return (
          <Bird
            key={bird.id}
            bird={bird}
            x={x}
            y={wireHeight(y, x, width)}
            facing={facingAt(x, width)}
            night={night}
            namePlace={namePlace(i, spacing, roomyName.drop)}
            speaking={false}
            idle
          />
        );
      })}
    </g>
  );
}

export interface FenceProps {
  fence: FenceModel;
  /** The rail's height in scene units. */
  y: number;
  width: number;
  /** The scene's height: the posts run from the rail to the bottom. */
  height: number;
  night: boolean;
}

/** The fence beneath the wires: a rail on posts, every unadopted bird dimmed upon it. */
export function Fence({ fence, y, width, height, night }: FenceProps) {
  const birds = byPosition(fence.birds);
  const spacing = placeSpacing(birds.length, fenceGap, width);
  return (
    <g data-fence="">
      <FenceRail y={y} width={width} height={height} count={birds.length} />
      {birds.map((bird, i) => {
        const x = placeAt(i, birds.length, fenceGap, width);
        return (
          <Bird
            key={bird.id}
            bird={bird}
            x={x}
            y={y + 2}
            facing={facingAt(x, width)}
            night={night}
            namePlace={namePlace(i, spacing, roomyName.drop)}
            speaking={false}
            idle
          />
        );
      })}
    </g>
  );
}
