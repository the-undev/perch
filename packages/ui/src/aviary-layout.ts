// Where everything in the aviary goes, as pure functions of the view model and the window's size:
// the scene's height, each wire's rows, the fence, each bird's perch and beak, the arrival order,
// and the bubble's place against a beak. Proportions are the board's (design/perch.html).

import type { Aviary, Bird, Mood, Wire } from "@perch/core/viewmodel.ts";
import { birdScale, type Facing, type NamePlace, roomyName } from "./bird.tsx";
import type { BubbleTail } from "./bubble.tsx";
import type { PixelSize } from "./hooks.ts";
import { sceneWidthFor } from "./scene.tsx";
import {
  byPosition,
  edgeMargin,
  facingAt,
  fenceGap,
  namePlace,
  placeAt,
  placeSpacing,
  wireGap,
  wireHeight,
} from "./wire.tsx";

/** A point in scene units: the layout's width wide, its height tall. */
export interface ScenePoint {
  x: number;
  y: number;
}

/** One bird given its place in the scene. */
export interface PlacedBird {
  bird: Bird;
  /** Where the toes rest, on the wire line, in scene units. */
  x: number;
  y: number;
  facing: Facing;
  scale: number;
  /** Where its name sits: crowded neighbours alternate baselines. */
  namePlace: NamePlace;
  /** The beak tip in scene units: a bubble's tail tip meets it. */
  beak: ScenePoint;
}

/** One row of a wire: a crowded wire spreads its birds over more than one. */
export interface WireRow {
  wire: Wire;
  /** 0 for the wire's first row, which carries its name and tally. */
  index: number;
  /** The row's height in scene units, at its ends before the sag. */
  y: number;
  birds: PlacedBird[];
}

export interface AviaryLayout {
  /** The scene's width in scene units: the full 2000, or fewer in a window too narrow for them at the floor. */
  width: number;
  /** The scene's height in scene units. */
  height: number;
  rows: WireRow[];
  fence: { y: number; birds: PlacedBird[] };
}

/** The scene's height keeps the window's aspect at the scene's width, within bounds that stop it squashing or towering. */
export function sceneHeightFor(size: PixelSize): number {
  const width = sceneWidthFor(size.width);
  return Math.max(
    600,
    Math.min(3000, Math.round((width * size.height) / size.width)),
  );
}

/** The closest birds sit on one row; a wire holding more than fit at this gap takes another row. */
export const crowdedGap = 300;

/** How many birds one row of a scene this wide holds: as many as fit at the crowded gap between the margins, at least one. */
export function rowCapacity(width: number): number {
  return Math.max(1, Math.floor((width - 2 * edgeMargin) / crowdedGap) + 1);
}

/** The rows a wire needs for its birds in a scene this wide; an empty wire still has its one. */
export function rowsFor(count: number, width: number): number {
  return Math.max(1, Math.ceil(count / rowCapacity(width)));
}

/** The vertical spacing between wires, in steps. */
export const wireStep = 1;

/** The vertical spacing between rows of one wire, in steps. */
export const rowStep = 0.6;

function perched(
  bird: Bird,
  x: number,
  y: number,
  name: NamePlace,
  width: number,
): PlacedBird {
  const scale = birdScale(bird);
  const facing = facingAt(x, width);
  const face = facing === "right" ? 1 : -1;
  // The beak tip is at (37, -42) in bird units, the bird 3 units above the wire.
  return {
    bird,
    x,
    y,
    facing,
    scale,
    namePlace: name,
    beak: { x: x + 37 * scale * face, y: y - 45 * scale },
  };
}

/**
 * The birds of one wire spread left to right in order as one sequence across the birds' room,
 * each dealt to the next row in turn, so they step down the rows on a diagonal and the leftmost
 * needs you first.
 */
function wireRows(wire: Wire, ys: number[], width: number): WireRow[] {
  const birds = byPosition(wire.birds);
  const rows = ys.length;
  const count = birds.length;
  const rowSpacing = rows * placeSpacing(count, wireGap, width);
  return ys.map((y, index) => ({
    wire,
    index,
    y,
    birds: birds.flatMap((bird, i) => {
      if (i % rows !== index) return [];
      const x = placeAt(i, count, wireGap, width);
      return [
        perched(
          bird,
          x,
          wireHeight(y, x, width),
          namePlace(Math.floor(i / rows), rowSpacing, roomyName.drop),
          width,
        ),
      ];
    }),
  }));
}

/** The share of the scene's height kept above the top wire for a bubble, unless the bubble needs more. */
const skyBand = 0.2;

/**
 * The aviary laid out for a window of the given size in pixels. A window too narrow for the full
 * width at the floor gets a narrower scene, its birds bunching and its wires taking more rows. The
 * top wire leaves room above it for a bubble, the fence sits a fixed distance from the bottom, and
 * the wires and their rows share the space between, a whole step apart at most a quarter of the
 * scene.
 */
export function layoutAviary(aviary: Aviary, size: PixelSize): AviaryLayout {
  const width = sceneWidthFor(size.width);
  const height = sceneHeightFor(size);
  const units = (pixels: number) => (pixels * height) / size.height;
  const top = Math.max(height * skyBand, units(26) + 165);
  const fenceY = height - units(100);
  const bottom = Math.max(top, Math.min(height * 0.63, fenceY - 120));
  const rowCounts = aviary.wires.map((wire) =>
    rowsFor(wire.birds.length, width),
  );
  const steps = rowCounts.reduce(
    (total, rows) => total + wireStep + (rows - 1) * rowStep,
    -wireStep,
  );
  const step = Math.min(height * 0.23, (bottom - top) / Math.max(steps, 1));
  let y = top - wireStep * step;
  const rows = aviary.wires.flatMap((wire, i) => {
    const ys = Array.from({ length: rowCounts[i] ?? 1 }, (_, row) => {
      y += (row === 0 ? wireStep : rowStep) * step;
      return y;
    });
    return wireRows(wire, ys, width);
  });
  const fenceBirds = byPosition(aviary.fence.birds);
  const fenceSpacing = placeSpacing(fenceBirds.length, fenceGap, width);
  return {
    width,
    height,
    rows,
    fence: {
      y: fenceY,
      birds: fenceBirds.map((bird, i) =>
        perched(
          bird,
          placeAt(i, fenceBirds.length, fenceGap, width),
          fenceY + 2,
          namePlace(i, fenceSpacing, roomyName.drop),
          width,
        ),
      ),
    },
  };
}

/** Every placed bird: the wires' rows top to bottom, then the fence. */
export function placedBirds(layout: AviaryLayout): PlacedBird[] {
  return [...layout.rows.flatMap((row) => row.birds), ...layout.fence.birds];
}

/** How many CSS pixels one scene unit spans in a window of this size. */
export function pixelsPerUnit(layout: AviaryLayout, size: PixelSize): number {
  return Math.min(size.width / layout.width, size.height / layout.height);
}

/** A scene point in pixels from the window's top left, the scene centred as the svg draws it. */
export function toPixels(
  point: ScenePoint,
  layout: AviaryLayout,
  size: PixelSize,
): ScenePoint {
  const k = pixelsPerUnit(layout, size);
  return {
    x: (size.width - layout.width * k) / 2 + point.x * k,
    y: (size.height - layout.height * k) / 2 + point.y * k,
  };
}

const arrivalMood: Record<Mood, number> = {
  distressed: 0,
  restless: 1,
  content: 2,
};

/** Who lands first: the wires before the fence, the worst mood first, then the plumpest. */
export function arrivalOrder(aviary: Aviary): Map<string, number> {
  const birds = [
    ...aviary.wires.flatMap((wire) => wire.birds),
    ...aviary.fence.birds,
  ];
  const sorted = [...birds].sort(
    (a, b) =>
      Number(!a.adopted) - Number(!b.adopted) ||
      arrivalMood[a.mood] - arrivalMood[b.mood] ||
      b.plumpness.outstanding - a.plumpness.outstanding,
  );
  return new Map(sorted.map((bird, index) => [bird.id, index]));
}

/** The pause between one bird's landing and the next's. */
export const arrivalStepMs = 95;

/**
 * Who sits on which wire, and who on the fence, regardless of order. A change to it is a large
 * change, and the flock flies in again; a reorder along a wire only moves birds along.
 */
export function arrangementKey(aviary: Aviary): string {
  const ids = (birds: Bird[]) => birds.map((bird) => bird.id).sort();
  return JSON.stringify([
    ...aviary.wires.map((wire) => [wire.name, ids(wire.birds)]),
    ids(aviary.fence.birds),
  ]);
}

/** Where a bubble sits in the window, how wide it is, and where its tail hangs. */
export interface BubblePlacement {
  left: number;
  top: number;
  width: number;
  tail: BubbleTail;
}

/** How far below the bubble's bottom edge its tail tip hangs. */
export const bubbleTailDrop = 26;

/** How far from the bubble's near edge the beak sits when nothing pushes the bubble aside. */
const bubbleReach = 52;

/** The space a bubble keeps from the window's edges. */
const bubbleMargin = 12;

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * The bubble over a beak, in pixels. It opens away from the bird's tail, stays inside the window,
 * and sits so its tail tip meets the beak tip; when there is no room above, it keeps to the top
 * edge and the tail points towards the beak from there.
 */
export function placeBubble(
  beak: ScenePoint,
  facing: Facing,
  window: PixelSize,
  bubbleHeight: number,
): BubblePlacement {
  const width = Math.min(390, window.width - 2 * bubbleMargin);
  const wanted =
    facing === "right" ? beak.x - bubbleReach : beak.x - (width - bubbleReach);
  const left = clamp(wanted, bubbleMargin, window.width - width - bubbleMargin);
  const top = Math.max(bubbleMargin, beak.y - bubbleTailDrop - bubbleHeight);
  const fromLeft = beak.x - left;
  const inset = (distance: number) => clamp(distance, 12, width - 60);
  return {
    left,
    top,
    width,
    tail:
      facing === "right"
        ? { side: "left", inset: inset(fromLeft) }
        : { side: "right", inset: inset(width - fromLeft) },
  };
}
