// A wire and the fence, drawn into a Scene. Birds keep the view model's order, leftmost needing
// attention first, spread evenly and turned to face the middle.

import type {
  Bird as BirdModel,
  Fence as FenceModel,
  Wire as WireModel,
} from "@perch/core/viewmodel.ts";
import { Bird, type Facing } from "./bird.tsx";

/** The margin no bird is placed inside, at either end of the scene. */
export const edgeMargin = 120;

/** How far a wire dips at its middle below its ends' line. */
const sag = 22;

/** The x of the index-th of count evenly spaced places, at most `gap` apart, centred. */
export function placeAt(
  index: number,
  count: number,
  gap: number,
  width: number,
): number {
  const steps = Math.max(count - 1, 1);
  const span = Math.min((count - 1) * gap, width - 2 * edgeMargin);
  return (width - span) / 2 + (span / steps) * index;
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

/** The tally as tspans, for a wire's name to carry. */
export function Tally({ birds }: { birds: BirdModel[] }) {
  const { attention, drifting } = wireTally(birds);
  if (attention === 0 && drifting === 0)
    return <tspan dx={18}>all settled</tspan>;
  return (
    <>
      <tspan dx={18} />
      {attention > 0 && (
        <tspan className="fill-red">{attention} attention</tspan>
      )}
      {attention > 0 && drifting > 0 && <tspan> · </tspan>}
      {drifting > 0 && (
        <tspan className="fill-amber">{drifting} drifting</tspan>
      )}
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
          x={36}
          y={y - 26}
          className="fill-ink-faint font-body text-[11px]"
        >
          <tspan className="font-bold uppercase tracking-[0.18em]">
            {label.name}
          </tspan>
          <Tally birds={label.birds} />
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

/** The fence staggers names over two rows so neighbours' names never collide. */
export function fenceLabelDrop(index: number): number {
  return index % 2 === 1 ? 48 : 30;
}

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
            labelDrop={30}
            speaking={false}
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
            labelDrop={fenceLabelDrop(i)}
            speaking={false}
          />
        );
      })}
    </g>
  );
}
