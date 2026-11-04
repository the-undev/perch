// A wire and the fence, drawn into a Scene. Birds keep the view model's order, leftmost needing
// attention first, spread evenly and turned to face the middle.

import type {
  Bird as BirdModel,
  Fence as FenceModel,
  Wire as WireModel,
} from "@perch/core/viewmodel.ts";
import { Fragment, useId } from "react";
import {
  Bird,
  BirdCut,
  birdScale,
  type Facing,
  type NamePlace,
  roomyName,
} from "./bird.tsx";

/** The margin no bird is placed inside at the scene's right end: 0.06 of the scene, at least 60 units, so 120 at full width. */
export function edgeMarginFor(width: number): number {
  return Math.max(60, 0.06 * width);
}

/** Where the birds' room starts on every wire and the fence: 0.12 of the scene, so 240 at full width, and at least 130 units to clear the tally. */
export function columnEdgeFor(width: number): number {
  return Math.max(130, 0.12 * width);
}

/** The birds' room across a scene this wide: from the column edge to the right margin, never less than none. */
export function birdRoom(width: number): number {
  return Math.max(0, width - columnEdgeFor(width) - edgeMarginFor(width));
}

/** How far a wire dips at its middle below its ends' line. */
const sag = 22;

/** The x of the index-th of count evenly spaced places, at most `gap` apart, centred between left and right; with no room between them they bunch at left. */
function placeBetween(
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

/** The x of the index-th of count evenly spaced places, at most `gap` apart, centred in the birds' room from the column edge to the right margin. */
export function placeAt(
  index: number,
  count: number,
  gap: number,
  width: number,
): number {
  return placeBetween(
    index,
    count,
    gap,
    columnEdgeFor(width),
    width - edgeMarginFor(width),
  );
}

/** How far apart neighbours sit among count places at most `gap` apart in the birds' room: the room shared out. */
export function placeSpacing(
  count: number,
  gap: number,
  width: number,
): number {
  return Math.min(gap, birdRoom(width) / Math.max(count - 1, 1));
}

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

/** The tally as tspans on one line, its word groups parted by a dot. */
export function Tally({ birds }: { birds: BirdModel[] }) {
  return (
    <>
      {tallyWords(birds).map((part, index) => (
        <Fragment key={part.words}>
          {index > 0 && <tspan> · </tspan>}
          <tspan className={part.ink}>{part.words}</tspan>
        </Fragment>
      ))}
    </>
  );
}

/** Where a wire's or the fence's painted name and the words in front of it start, in from the scene's left edge. */
export const labelX = 36;

/** A painted name's type size in scene units, and how far its baseline sits above the left end of its wire or rail. */
export const paintedSize = 52;
const paintedRise = 12;

/** The painted ink's opacity: quiet enough to sit behind the birds. */
export const paintedInk = 0.12;

/** A bird the paint is cut back round: where its toes rest, its scale and its facing. */
export interface PaintCut {
  id: string;
  x: number;
  y: number;
  scale: number;
  facing: Facing;
}

export interface PaintedNameProps {
  name: string;
  /** The height of the wire's left end or the rail, in scene units: the baseline sits just above it. */
  end: number;
  width: number;
  /** The birds the paint is cut back round, each by a rim of sky. */
  cuts: PaintCut[];
}

/** A name painted on the sky behind a wire or the rail, cut back round each of its birds so they keep their outline. */
export function PaintedName({ name, end, width, cuts }: PaintedNameProps) {
  const maskId = `paint${useId().replace(/[^\w-]/g, "")}`;
  const baseline = end - paintedRise;
  return (
    <g data-part="painted-name">
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x={0}
        y={baseline - 2 * paintedSize}
        width={width}
        height={3 * paintedSize}
      >
        <rect
          x={0}
          y={baseline - 2 * paintedSize}
          width={width}
          height={3 * paintedSize}
          fill="#fff"
        />
        {cuts.map((cut) => (
          <g
            key={cut.id}
            data-cut={cut.id}
            className="transition-transform duration-700 ease-in-out motion-reduce:transition-none"
            style={{ transform: `translate(${cut.x}px, ${cut.y}px)` }}
          >
            <g
              transform={`translate(0 ${-3 * cut.scale}) scale(${cut.scale * (cut.facing === "right" ? 1 : -1)} ${cut.scale})`}
            >
              <BirdCut />
            </g>
          </g>
        ))}
      </mask>
      <text
        x={labelX}
        y={baseline}
        mask={`url(#${maskId})`}
        opacity={paintedInk}
        className="fill-ink font-display font-bold"
        fontSize={paintedSize}
      >
        {name}
      </text>
    </g>
  );
}

/** The tally's type size and the step between its lines, in scene units. */
export const tallySize = 13;
const tallyLeading = 20;

/** How far the tally's first baseline hangs beneath the wire's left end. */
const tallyDrop = 30;

/** The tally under a wire's left end, in front: one line per word group in its colour, or "all settled" faintly. */
export function WireTally({ y, birds }: { y: number; birds: BirdModel[] }) {
  return (
    <g data-part="tally">
      {tallyWords(birds).map((part, index) => (
        <text
          key={part.words}
          x={labelX}
          y={y - 12 + tallyDrop + index * tallyLeading}
          fontSize={tallySize}
          className={`font-body ${part.ink === undefined ? "fill-ink-faint" : `font-semibold ${part.ink}`}`}
        >
          {part.words}
        </text>
      ))}
    </g>
  );
}

export interface WireLineProps {
  /** The wire's height in scene units, at its ends before the sag. */
  y: number;
  width: number;
}

/** The sagging wire itself. */
export function WireLine({ y, width }: WireLineProps) {
  return (
    <path
      d={`M -20 ${y - 12} Q ${width / 2} ${y + sag} ${width + 20} ${y - 12}`}
      stroke="var(--color-wire)"
      strokeWidth={3}
      fill="none"
    />
  );
}

export interface FenceRailProps {
  /** The rail's height in scene units. */
  y: number;
  width: number;
  /** The scene's height: the posts run from the rail to the bottom. */
  height: number;
}

/** The fence's rail on its posts. */
export function FenceRail({ y, width, height }: FenceRailProps) {
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
    </>
  );
}

/** The fence's painted name. */
export const fenceName = "On the fence";

/** How far the fence's count hangs beneath the rail. */
const fenceCountDrop = 26;

/** How many sit on the fence, in front beneath the rail's left end. */
export function FenceCount({ y, count }: { y: number; count: number }) {
  return (
    <text
      data-part="fence-count"
      x={labelX}
      y={y + fenceCountDrop}
      fontSize={tallySize}
      className="fill-ink-faint font-body"
    >
      {count} not adopted
    </text>
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

/** One priority band on one row: its name painted behind, the wire, its birds leftmost first, and its tally in front. */
export function Wire({ wire, y, width, night }: WireProps) {
  const birds = byPosition(wire.birds);
  const spacing = placeSpacing(birds.length, wireGap, width);
  const places = birds.map((bird, i) => {
    const x = placeAt(i, birds.length, wireGap, width);
    return { bird, x, y: wireHeight(y, x, width), facing: facingAt(x, width) };
  });
  return (
    <g data-wire={wire.name}>
      <PaintedName
        name={wire.name}
        end={y - 12}
        width={width}
        cuts={places.map((place) => ({
          id: place.bird.id,
          x: place.x,
          y: place.y,
          scale: birdScale(place.bird),
          facing: place.facing,
        }))}
      />
      <WireLine y={y} width={width} />
      {places.map((place, i) => (
        <Bird
          key={place.bird.id}
          bird={place.bird}
          x={place.x}
          y={place.y}
          facing={place.facing}
          night={night}
          namePlace={namePlace(i, spacing, roomyName.drop)}
          speaking={false}
          idle
        />
      ))}
      <WireTally y={y} birds={birds} />
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

/** The fence beneath the wires: its name painted behind, a rail on posts, every unadopted bird dimmed upon it, and the count in front. */
export function Fence({ fence, y, width, height, night }: FenceProps) {
  const birds = byPosition(fence.birds);
  const spacing = placeSpacing(birds.length, fenceGap, width);
  const places = birds.map((bird, i) => {
    const x = placeAt(i, birds.length, fenceGap, width);
    return { bird, x, facing: facingAt(x, width) };
  });
  return (
    <g data-fence="">
      <PaintedName
        name={fenceName}
        end={y}
        width={width}
        cuts={places.map((place) => ({
          id: place.bird.id,
          x: place.x,
          y: y + 2,
          scale: birdScale(place.bird),
          facing: place.facing,
        }))}
      />
      <FenceRail y={y} width={width} height={height} />
      {places.map((place, i) => (
        <Bird
          key={place.bird.id}
          bird={place.bird}
          x={place.x}
          y={y + 2}
          facing={place.facing}
          night={night}
          namePlace={namePlace(i, spacing, roomyName.drop)}
          speaking={false}
          idle
        />
      ))}
      <FenceCount y={y} count={birds.length} />
    </g>
  );
}
