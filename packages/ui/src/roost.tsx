// The roost: on its own page the bird leaves the wire for a T-stand perch, drawn in the post's
// colour, facing left toward its record, idle, its bubble above it as paper without the header the
// page's heading already carries. The bubble's tail meets the beak.

import type { Bird } from "@perch/core/viewmodel.ts";
import { birdLook, PerchedFigure, plumpScale } from "./bird.tsx";
import { RoostBubble, tailDrop } from "./bubble.tsx";

/** The roost's width in pixels: the page's right-hand column. */
export const roostWidth = 330;

/** The scale a roosting bird is drawn at before its plumpness: larger than on any wire. */
export const roostScale = 1.3;

/** Where the roost draws its bird, in pixels from the drawing's top left. */
export interface RoostFrame {
  height: number;
  /** The scale the bird is drawn at. */
  scale: number;
  /** The top of the stand's crossbar, where the toes rest. */
  perchY: number;
  beakX: number;
  beakY: number;
}

/** The pole's length below the crossbar, and the room left beneath it for its shadow. */
const poleLength = 42;
const shadowRoom = 10;

/** The roost's drawing for this bird, tall enough for its plumpness, the beak to the left. */
export function roostFrame(bird: Bird): RoostFrame {
  const scale = roostScale * plumpScale(bird.plumpness);
  const perchY = Math.ceil(80 * scale + 8);
  return {
    height: perchY + poleLength + shadowRoom,
    scale,
    perchY,
    // The beak tip is at (37, -42) in bird units, mirrored to face left, the bird 3 units up.
    beakX: roostWidth / 2 - 37 * scale,
    beakY: perchY - 45 * scale,
  };
}

export interface RoostProps {
  bird: Bird;
  /** The sky is at night: a bird that sleeps sleeps here too, and its bubble speaks woken. */
  night: boolean;
}

/** The bird on its perch with its bubble above, for the top right of the bird's page. */
export function Roost({ bird, night }: RoostProps) {
  const frame = roostFrame(bird);
  const look = birdLook(bird, night);
  const centre = roostWidth / 2;
  return (
    <section
      aria-label={`${bird.name} on its perch`}
      data-part="roost"
      data-facing="left"
      className="w-82.5 max-w-full"
    >
      <RoostBubble
        bubble={bird.bubble}
        night={night}
        tail={{ side: "left", inset: frame.beakX }}
      />
      <svg
        role="img"
        aria-label={`${bird.name}, ${bird.adopted ? bird.mood : "not adopted"}${look.asleep ? ", asleep" : ""}`}
        data-mood={bird.mood}
        data-asleep={look.asleep}
        viewBox={`0 0 ${roostWidth} ${frame.height}`}
        width={roostWidth}
        height={frame.height}
        className="block h-auto max-w-full overflow-visible"
        style={{ marginTop: tailDrop - frame.beakY }}
      >
        <g data-part="stand" fill="var(--color-post)">
          <rect
            x={centre - 50}
            y={frame.perchY}
            width={100}
            height={7}
            rx={3.5}
          />
          <rect
            x={centre - 4}
            y={frame.perchY + 4}
            width={8}
            height={poleLength}
            rx={3}
          />
        </g>
        <ellipse
          cx={centre}
          cy={frame.perchY + poleLength + 5}
          rx={46}
          ry={5}
          fill="var(--color-shade)"
        />
        <g transform={`translate(${centre} ${frame.perchY - 3 * frame.scale})`}>
          <PerchedFigure
            look={look}
            id={bird.id}
            scale={frame.scale}
            facing="left"
            speaking={false}
            idle
          />
        </g>
      </svg>
    </section>
  );
}
