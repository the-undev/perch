// The roost: on its own page the bird leaves the wire for a T-stand perch, drawn in the post's
// colour, sitting on its crossbar with no legs showing, facing left toward its record, idle, its
// bubble as paper without the header the page's
// heading already carries. The roost lays itself out by its own width: stacked, the bubble sits above
// the bird with its tail hanging to the beak; wide enough, a row, the bubble on the left with a
// sideways tail to the beak. The bird is hung from the beak, so the tail meets it at any bubble height.

import type { Bird, ChipKind } from "@perch/core/viewmodel.ts";
import type { CSSProperties } from "react";
import { birdLook, PerchedFigure, plumpScale, sitDrop } from "./bird.tsx";
import { RoostBubble } from "./bubble.tsx";

/** The width the stacked form is laid out for, in pixels: any roost narrower than the row breakpoint. */
export const roostWidth = 330;

/** The roost's width in pixels as a row: the page's right-hand column. */
export const roostRowWidth = 480;

/** The roost's own width at which it becomes a row; written out in the `@min-[460px]` classes below. */
export const roostRowBreakpoint = 460;

/** The scale a roosting bird is drawn at before its plumpness: larger than the wires' 0.9. */
export const roostScale = 1.0;

/** The clear paper between the bubble's bottom and the top of the bird's head when stacked, in pixels. */
export const roostDaylight = 14;

/** The head's top above the beak tip, in bird units. */
const headTopAboveBeak = 13.5;

/** The gap between the row's bubble and the bird's drawing, which the sideways tail crosses. */
export const roostRowGap = 28;

/** Where the roost draws its bird, in pixels from the drawing's top left unless noted. */
export interface RoostFrame {
  /** The drawing's height. */
  height: number;
  /** The drawing's width: only as wide as the stand and the bird's tail feathers need. */
  width: number;
  /** The scale the bird is drawn at. */
  scale: number;
  /** The top of the stand's crossbar, where the toes rest. */
  perchY: number;
  /** The bird's centre line, and the stand's. */
  centreX: number;
  /** The beak tip within the drawing. */
  beakX: number;
  beakY: number;
  /** Stacked: how far the hanging tail's tip falls below the bubble's bottom edge, clearing the head. */
  drop: number;
  /** Stacked: the beak tip's distance from the bubble's left edge in a 330px column. */
  stackBeakX: number;
  /** Row: the sideways tail's reach from the bubble's right edge to the beak. */
  rowReach: number;
  /** Row: the tip's distance below the bubble's top, which is the band's top: the beak's height. */
  rowTipY: number;
}

/** The pole's length below the crossbar, and the room left beneath it for its shadow. */
const poleLength = 42;
const shadowRoom = 10;

/** In the row the drawing's bottom margin is this negative, so the pole and shadow hang below the band. */
export const roostRowBleed = poleLength + shadowRoom;

/** The scale of the plumpest bird, which the stand is sized for. */
const cappedScale = roostScale * plumpScale({ outstanding: 0, fullness: 1 });

// The stand is furniture: its position and the drawing's size are fixed by the plumpest bird, so
// only the bird varies. The frame keeps the room a standing head needs, 58.5 bird units above the
// crossbar (55.5 above the figure, which sits 3 up), and 6px more for the bob's lift; the bird
// sits `sitDrop` lower inside it, so the band keeps its height and the bubble its room.
const standPerchY = Math.ceil(58.5 * cappedScale) + 6;
const standCentreX = Math.ceil(Math.max(50, 37 * cappedScale)) + 6;
const standTailReach = Math.ceil(Math.max(50, 46 * cappedScale)) + 6;

/** The beak tip's height above the crossbar in bird units: 42 above the figure's origin, 3 up, settled by the sit. */
const beakAboveBar = 45 - sitDrop;

/** The roost's drawing for this bird: a fixed stand, the bird at its own scale sitting on it, the beak to the left. */
export function roostFrame(bird: Bird): RoostFrame {
  const scale = roostScale * plumpScale(bird.plumpness);
  const perchY = standPerchY;
  // The beak tip is at (37, -42) in bird units, mirrored to face left.
  const beakReach = 37 * scale;
  const centreX = standCentreX;
  const beakX = centreX - beakReach;
  const beakY = perchY - beakAboveBar * scale;
  return {
    height: perchY + poleLength + shadowRoom,
    width: standCentreX + standTailReach,
    scale,
    perchY,
    centreX,
    beakX,
    beakY,
    drop: Math.ceil(headTopAboveBeak * scale) + roostDaylight,
    // The drawing sits at a constant offset, so the stand is centred in the column for every bird.
    stackBeakX: roostWidth / 2 - beakReach,
    rowReach: roostRowGap + beakX,
    rowTipY: beakY,
  };
}

export interface RoostProps {
  bird: Bird;
  /** The sky is at night: a bird that sleeps sleeps here too, and its bubble speaks woken. */
  night: boolean;
  /** A chip in the bubble was pressed: the page lands on the ledger row holding its working. */
  onChip: (chip: ChipKind) => void;
}

/** The bird on its perch with its bubble above, or to its left when the roost is wide, for the top right of the bird's page. */
export function Roost({ bird, night, onChip }: RoostProps) {
  const frame = roostFrame(bird);
  const look = birdLook(bird, night);
  const centre = frame.centreX;
  return (
    <section
      aria-label={`${bird.name} on its perch`}
      data-part="roost"
      data-facing="left"
      className="@container w-full"
    >
      <div
        data-part="roost-layout"
        className="flex flex-col @min-[460px]:flex-row @min-[460px]:items-start @min-[460px]:gap-(--row-gap)"
        style={
          {
            "--row-gap": `${roostRowGap}px`,
            "--row-bleed": `${roostRowBleed}px`,
            "--stack-gap": `${frame.drop - frame.beakY}px`,
            "--stack-left": `${frame.stackBeakX - frame.beakX}px`,
          } as CSSProperties
        }
      >
        <div
          data-part="roost-speech"
          className="@min-[460px]:min-w-0 @min-[460px]:flex-1"
        >
          <RoostBubble
            bubble={bird.bubble}
            night={night}
            tail={{ side: "left", inset: frame.stackBeakX }}
            drop={frame.drop}
            sideTail={{ reach: frame.rowReach, tipY: frame.rowTipY }}
            onChip={onChip}
          />
        </div>
        <svg
          role="img"
          aria-label={`${bird.name}, ${bird.adopted ? bird.mood : "not adopted"}${look.asleep ? ", asleep" : ""}`}
          data-mood={bird.mood}
          data-asleep={look.asleep}
          viewBox={`0 0 ${frame.width} ${frame.height}`}
          width={frame.width}
          height={frame.height}
          className="mt-(--stack-gap) ml-(--stack-left) block h-auto max-w-full shrink-0 overflow-visible @min-[460px]:-mb-(--row-bleed) @min-[460px]:mt-0 @min-[460px]:ml-0"
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
          <g
            transform={`translate(${centre} ${frame.perchY - 3 * frame.scale})`}
          >
            <PerchedFigure
              look={look}
              id={bird.id}
              scale={frame.scale}
              facing="left"
              pose="sitting"
              speaking={false}
              idle
            />
          </g>
        </svg>
      </div>
    </section>
  );
}
