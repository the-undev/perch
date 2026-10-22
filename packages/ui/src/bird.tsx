// The bird from the design board, drawn in its own units: the origin is the perch point, the toes
// end 3 units below it, the beak tip is at (37, -42). Every trait reads from the view model.

import type {
  Bird as BirdModel,
  BirdSize,
  Mood,
  Plumpness,
} from "@perch/core/viewmodel.ts";
import { type CustomProperties, hash } from "./motion.ts";

/** Which way the bird looks; the scene turns birds inwards. */
export type Facing = "left" | "right";

/** The breast colour each mood wears. */
export const moodColour: Record<Mood, string> = {
  content: "var(--color-green)",
  restless: "var(--color-amber)",
  distressed: "var(--color-red)",
};

/** How far each mood fidgets: the bob's lift in pixels and how much faster it runs. */
const restlessness: Record<Mood, number> = {
  content: 1,
  restless: 1.5,
  distressed: 2.2,
};

/** The scale every fence bird starts from, whatever its importance. */
export const fenceScale = 0.78;

/** Base scale from importance: the least important tier is 0.9, the most important 1.8. */
export function sizeScale(size: BirdSize): number {
  const steps = Math.max(size.tiers - 1, 1);
  return 0.9 + (0.9 * (size.tiers - 1 - size.rank)) / steps;
}

/** Plumpness from outstanding work: up to 65 per cent larger at the cap. */
export function plumpScale(plumpness: Plumpness): number {
  return 1 + 0.65 * plumpness.fullness;
}

/** The drawn scale of a bird: its importance on a wire, the fence's on the fence, times its plumpness. */
export function birdScale(bird: BirdModel): number {
  const base = bird.adopted ? sizeScale(bird.size) : fenceScale;
  return base * plumpScale(bird.plumpness);
}

/** What the drawing needs to know, derived once from the view model and the night. */
export interface BirdLook {
  breast: string;
  dim: boolean;
  asleep: boolean;
  singing: boolean;
  /** Fidget factor: 0 is still, 1 a content bob, up to 2.2 for a distressed bird. */
  restlessness: number;
  tailFlicks: boolean;
}

/** The look of a bird: dim on the fence, asleep at night only when it sleeps, singing while edited. */
export function birdLook(bird: BirdModel, night: boolean): BirdLook {
  const dim = !bird.adopted;
  const asleep = night && bird.sleepsAtNight;
  // The fence does not wear its mood, so it does not fidget with it either.
  const mood: Mood = dim ? "content" : bird.mood;
  return {
    breast: dim ? "var(--color-breast-dim)" : moodColour[bird.mood],
    dim,
    asleep,
    singing: !dim && bird.activity === "editing",
    restlessness: asleep ? 0 : restlessness[mood],
    tailFlicks: !dim && !asleep && bird.mood === "distressed",
  };
}

/** The idle timings for one bird: slower and gentler when content, offset by its id. */
function bobStyle(id: string, restless: number): CustomProperties {
  const seed = hash(id);
  return {
    "--bob-lift": String(2 * restless),
    "--bob-duration": `${3600 - restless * 500 + (seed % 1500)}ms`,
    "--bob-delay": `${seed % 2000}ms`,
  };
}

function flickStyle(id: string): CustomProperties {
  return { "--flick-duration": `${9000 + (hash(id) % 5000)}ms` };
}

/** The bird's parts at unit scale, facing right. */
export function BirdFigure({ look, id }: { look: BirdLook; id: string }) {
  const body = look.dim ? "var(--color-plumage-dim)" : "var(--color-plumage)";
  return (
    <g data-part="figure">
      <line
        x1={-6}
        y1={-8}
        x2={-7}
        y2={2}
        stroke="var(--color-leg)"
        strokeWidth={2.4}
      />
      <line
        x1={6}
        y1={-8}
        x2={7}
        y2={2}
        stroke="var(--color-leg)"
        strokeWidth={2.4}
      />
      <path
        d="M -7 2 L -12 3 M -7 2 L -3 3 M 7 2 L 2 3 M 7 2 L 12 3"
        stroke="var(--color-leg)"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <path
        data-part="tail"
        d="M -16 -22 L -42 -10 L -38 -20 L -44 -26 L -20 -32 Z"
        fill={body}
        className={
          look.tailFlicks ? "motion-safe:animate-tail-flick" : undefined
        }
        style={look.tailFlicks ? flickStyle(id) : undefined}
      />
      <ellipse data-part="body" cx={0} cy={-26} rx={23} ry={19} fill={body} />
      <path
        data-part="breast"
        d="M 10 -14 A 18 16 0 0 0 20 -34 A 23 19 0 0 1 2 -8 Z"
        fill={look.breast}
      />
      <circle cx={14} cy={-30} r={5.5} fill={look.breast} opacity={0.9} />
      <circle cx={16} cy={-44} r={11.5} fill={body} />
      <path
        data-part="beak"
        d="M 26 -45 L 37 -42 L 26 -39 Z"
        fill="var(--color-ink-accent)"
      />
      <circle
        data-part="eye"
        cx={19.5}
        cy={-46}
        r={1.8}
        fill={look.asleep ? "var(--color-leg)" : "var(--color-eye)"}
      />
      <path
        d="M -14 -28 Q 2 -36 8 -24 Q -2 -16 -14 -28 Z"
        fill="var(--color-shade)"
      />
    </g>
  );
}

export interface BirdProps {
  bird: BirdModel;
  /** Where the toes rest, on the wire line, in scene units. */
  x: number;
  y: number;
  facing: Facing;
  night: boolean;
  /** How far below the wire the name sits; the fence staggers it so names do not collide. */
  labelDrop: number;
}

/** One bird perched in a scene: its figure, its song when edited, and its name beneath. */
export function Bird({ bird, x, y, facing, night, labelDrop }: BirdProps) {
  const look = birdLook(bird, night);
  const scale = birdScale(bird);
  const face = facing === "right" ? 1 : -1;
  return (
    <g
      data-bird={bird.id}
      data-mood={bird.mood}
      data-asleep={look.asleep}
      transform={`translate(${x} ${y - 3 * scale})`}
    >
      <g
        className={
          look.restlessness > 0 ? "motion-safe:animate-bird-bob" : undefined
        }
        style={bobStyle(bird.id, look.restlessness)}
      >
        <g transform={`scale(${scale * face} ${scale})`}>
          <BirdFigure look={look} id={bird.id} />
        </g>
        {look.singing && (
          <text
            data-part="song"
            x={48 * face * scale}
            y={-60 * scale}
            fill="var(--color-ink-accent)"
            fontSize={Math.max(15, 13 * scale)}
            textAnchor="middle"
            className="motion-safe:animate-song"
          >
            ♪
          </text>
        )}
      </g>
      <text
        y={labelDrop + 3 * scale}
        textAnchor="middle"
        className={
          look.dim
            ? "fill-ink-fence font-body font-medium text-[12.5px]"
            : "fill-ink-muted font-body font-medium text-[13.5px]"
        }
      >
        {bird.name}
      </text>
    </g>
  );
}

export interface BirdPortraitProps {
  bird: BirdModel;
  facing: Facing;
  night: boolean;
}

/** A portrait's size in pixels, and where in it the beak tip lands: a bubble's tail tip meets it. */
export interface PortraitFrame {
  width: number;
  height: number;
  beakX: number;
  beakY: number;
}

/** The frame a portrait of this bird is drawn in. */
export function portraitFrame(bird: BirdModel, facing: Facing): PortraitFrame {
  const scale = birdScale(bird);
  const half = Math.ceil(62 * scale + 40);
  const top = Math.ceil(80 * scale + 8);
  const face = facing === "right" ? 1 : -1;
  return {
    width: 2 * half,
    height: top + 44,
    // The beak tip is at (37, -42) in bird units, the bird 3 units above the wire.
    beakX: half + 37 * scale * face,
    beakY: top - 45 * scale,
  };
}

/** A bird alone on a short length of wire, at its true size: for pages that show one bird. */
export function BirdPortrait({ bird, facing, night }: BirdPortraitProps) {
  const frame = portraitFrame(bird, facing);
  const half = frame.width / 2;
  const top = frame.height - 44;
  const look = birdLook(bird, night);
  return (
    <svg
      role="img"
      aria-label={`${bird.name}, ${bird.adopted ? bird.mood : "not adopted"}${look.asleep ? ", asleep" : ""}`}
      viewBox={`${-half} ${-top} ${frame.width} ${frame.height}`}
      width={frame.width}
      height={frame.height}
      className="h-auto max-w-full overflow-visible"
    >
      <line
        x1={-half}
        y1={0}
        x2={half}
        y2={0}
        stroke={look.dim ? "var(--color-post)" : "var(--color-wire)"}
        strokeWidth={look.dim ? 6 : 3}
      />
      <Bird
        bird={bird}
        x={0}
        y={0}
        facing={facing}
        night={night}
        labelDrop={30}
      />
    </svg>
  );
}
