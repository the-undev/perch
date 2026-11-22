// The bird from the design board, drawn in its own units: the origin is the perch point, the toes
// end 3 units below it, the beak tip is at (37, -42). Every trait reads from the view model and
// the render's clock.

import { hasSnoozeEnded, snoozeWords } from "@perch/core/snooze-date.ts";
import type {
  Bird as BirdModel,
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

/** The scale every bird on a wire starts from. */
export const wireScale = 0.9;

/** The scale every fence bird starts from. */
export const fenceScale = 0.78;

/** Plumpness from outstanding work: up to 65 per cent larger at the cap. */
export function plumpScale(plumpness: Plumpness): number {
  return 1 + 0.65 * plumpness.fullness;
}

/** The drawn scale of a bird: the wire's or the fence's, times its plumpness. */
export function birdScale(bird: BirdModel): number {
  const base = bird.adopted ? wireScale : fenceScale;
  return base * plumpScale(bird.plumpness);
}

/** Birds sleep from midnight until 06:00 on the local clock, whatever the sky shows. */
function inSleepHours(at: Date): boolean {
  return at.getHours() < 6;
}

/** Whether the owner has set the bird aside and its snooze has not run out by this time. */
export function isSnoozed(bird: BirdModel, now: Date): boolean {
  return bird.snooze !== null && !hasSnoozeEnded(bird.snooze.until, now);
}

/** The word beside a bird's name: its mood, where a fence bird stands, or that it is snoozed. */
export type StateWord = Mood | "not adopted" | "snoozed";

/** The text colour of each state word, where the word is written. */
export const stateTone: Record<StateWord, string> = {
  content: "text-green",
  restless: "text-amber",
  distressed: "text-red",
  "not adopted": "text-ink-faint",
  snoozed: "text-ink-faint",
};

/** What a bird shows beside its head: the z while asleep, the note while singing. */
export type BirdMark = "z" | "note" | null;

/** What the drawing needs to know, worked out at render from the view model and the time. */
export interface BirdLook {
  stateWord: StateWord;
  /** The snooze's end in words while snoozed, such as "until Friday"; else null. */
  snoozedUntil: string | null;
  breast: string;
  dim: boolean;
  /** Eyes closed and still, with the z. */
  asleep: boolean;
  mark: BirdMark;
  /** Fidget factor: 0 is still, 1 a content bob, up to 2.2 for a distressed bird. */
  restlessness: number;
  tailFlicks: boolean;
}

/** A dimmed bird that does not wear its mood: awake with a gentle bob, or asleep. */
function dimLook(
  stateWord: StateWord,
  snoozedUntil: string | null,
  asleep: boolean,
): BirdLook {
  return {
    stateWord,
    snoozedUntil,
    breast: "var(--color-breast-dim)",
    dim: true,
    asleep,
    mark: asleep ? "z" : null,
    restlessness: asleep ? 0 : restlessness.content,
    tailFlicks: false,
  };
}

/** The look of a bird at a time: the fence first, then a snooze not yet run out, then mood, editing and the hour. */
export function birdLook(bird: BirdModel, now: Date): BirdLook {
  const sleepHours = inSleepHours(now);
  if (!bird.adopted) return dimLook("not adopted", null, sleepHours);
  if (bird.snooze !== null && isSnoozed(bird, now)) {
    return dimLook("snoozed", snoozeWords(bird.snooze.until, now), true);
  }
  const awake = {
    stateWord: bird.mood,
    snoozedUntil: null,
    breast: moodColour[bird.mood],
    dim: false,
    asleep: false,
    restlessness: restlessness[bird.mood],
    tailFlicks: bird.mood === "distressed",
  };
  if (bird.activity === "editing") return { ...awake, mark: "note" };
  if (bird.mood === "distressed" || !sleepHours) {
    return { ...awake, mark: null };
  }
  return { ...awake, asleep: true, mark: "z", restlessness: 0 };
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

/** How a bird holds itself: standing on its toes on a wire, or sitting settled on its own perch. */
export type Pose = "standing" | "sitting";

/** How far a sitting bird settles, in its units: its body's foot comes down to the line its toes stood on. */
export const sitDrop = 10;

export interface BirdFigureProps {
  look: BirdLook;
  id: string;
  pose: Pose;
  /** The bird has just been asked to speak: its beak wiggles as the bubble opens. */
  speaking: boolean;
  /** The bird is at rest: its idle animations run. False while it arrives. */
  idle: boolean;
}

/** The tail's outline at unit scale, facing right. */
const tailPath = "M -16 -22 L -42 -10 L -38 -20 L -44 -26 L -20 -32 Z";

/** The beak's outline at unit scale, facing right. */
const beakPath = "M 26 -45 L 37 -42 L 26 -39 Z";

/** How wide the rim of sky round a bird's cut is, in bird units: the stroke that fattens its silhouette. */
export const cutRim = 9;

/** A standing bird's silhouette fattened by a rim, at unit scale facing right; black in a mask, it cuts that shape out. The legs need no cut. */
export function BirdCut() {
  return (
    <g fill="#000" stroke="#000" strokeWidth={cutRim} strokeLinejoin="round">
      <path d={tailPath} />
      <ellipse cx={0} cy={-26} rx={23} ry={19} />
      <circle cx={16} cy={-44} r={11.5} />
      <path d={beakPath} />
    </g>
  );
}

/** The bird's parts at unit scale, facing right; sitting, it shows no legs and rests its body where its toes were. */
export function BirdFigure({
  look,
  id,
  pose,
  speaking,
  idle,
}: BirdFigureProps) {
  const body = look.dim ? "var(--color-plumage-dim)" : "var(--color-plumage)";
  const sitting = pose === "sitting";
  return (
    <g
      data-part="figure"
      data-pose={pose}
      transform={sitting ? `translate(0 ${sitDrop})` : undefined}
    >
      {!sitting && (
        <g data-part="legs">
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
        </g>
      )}
      <path
        data-part="tail"
        d={tailPath}
        fill={body}
        className={
          idle && look.tailFlicks ? "motion-safe:animate-tail-flick" : undefined
        }
        style={idle && look.tailFlicks ? flickStyle(id) : undefined}
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
        d={beakPath}
        fill="var(--color-ink-accent)"
        className={
          speaking
            ? "origin-left [transform-box:fill-box] motion-safe:animate-beak-wiggle"
            : undefined
        }
      />
      {look.asleep ? (
        <path
          data-part="eye"
          d="M 16.5 -46 Q 19.5 -43.2 22.5 -46"
          fill="none"
          stroke="var(--color-leg)"
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      ) : (
        <circle
          data-part="eye"
          cx={19.5}
          cy={-46}
          r={1.8}
          fill="var(--color-eye)"
        />
      )}
      <path
        d="M -14 -28 Q 2 -36 8 -24 Q -2 -16 -14 -28 Z"
        fill="var(--color-shade)"
      />
    </g>
  );
}

export interface PerchedFigureProps {
  look: BirdLook;
  id: string;
  /** The drawn scale: 1 is the board's unit bird. */
  scale: number;
  facing: Facing;
  pose: Pose;
  /** Its bubble has just opened: the beak wiggles. */
  speaking: boolean;
  /** The bird is at rest: bob, tail flick and its mark run. */
  idle: boolean;
}

/** A mark's font size at a bird's scale: the note and the z are the same size. */
function markSize(scale: number): number {
  return Math.max(17, 14 * scale);
}

/** How each mark is drawn: its glyph, ink (the note in the accent, the z in the bird's own breast colour) and class. */
const markDrawing: Record<
  Exclude<BirdMark, null>,
  {
    glyph: string;
    ink: (look: BirdLook) => string;
    className: string;
  }
> = {
  note: {
    glyph: "♪",
    ink: () => "var(--color-ink-accent)",
    className: "motion-safe:animate-song",
  },
  z: {
    glyph: "z",
    ink: (look) => look.breast,
    className: "font-display font-semibold italic motion-safe:animate-song",
  },
};

/** A bird's figure above its perch point at a scale, bobbing and singing while idle. */
export function PerchedFigure({
  look,
  id,
  scale,
  facing,
  pose,
  speaking,
  idle,
}: PerchedFigureProps) {
  const face = facing === "right" ? 1 : -1;
  const settle = pose === "sitting" ? sitDrop : 0;
  const mark = look.mark === null ? null : markDrawing[look.mark];
  return (
    <g
      className={
        idle && look.restlessness > 0
          ? "motion-safe:animate-bird-bob"
          : undefined
      }
      style={idle ? bobStyle(id, look.restlessness) : undefined}
    >
      <g transform={`scale(${scale * face} ${scale})`}>
        <BirdFigure
          look={look}
          id={id}
          pose={pose}
          speaking={speaking}
          idle={idle}
        />
      </g>
      {idle && mark !== null && (
        <text
          data-part="mark"
          x={48 * face * scale}
          y={(settle - 60) * scale}
          textAnchor="middle"
          fill={mark.ink(look)}
          fontSize={markSize(scale)}
          className={mark.className}
        >
          {mark.glyph}
        </text>
      )}
    </g>
  );
}

/** Where a bird's name sits: how far below the perch, and at which of two type sizes. */
export interface NamePlace {
  drop: number;
  size: "full" | "small";
}

/** A name with room around it: just beneath the perch, at full size. */
export const roomyName: NamePlace = { drop: 30, size: "full" };

export interface BirdProps {
  bird: BirdModel;
  /** Where the toes rest, on the wire line, in scene units. */
  x: number;
  y: number;
  facing: Facing;
  /** How the bird looks now, from `birdLook`. */
  look: BirdLook;
  /** Where the name sits; crowded neighbours alternate baselines so names do not collide. */
  namePlace: NamePlace;
  /** Its bubble has just opened: the beak wiggles. */
  speaking: boolean;
  /** The bird is at rest: bob, tail flick and its mark run. False while it arrives. */
  idle: boolean;
}

/** The name's ink and size: muted, brighter when an enclosing group is hovered or focused from the keyboard. */
const labelClass = {
  wire: {
    full: "fill-ink-muted font-body font-medium text-[13.5px]",
    small: "fill-ink-muted font-body font-medium text-[12px]",
  },
  fence: {
    full: "fill-ink-fence font-body font-medium text-[12.5px]",
    small: "fill-ink-fence font-body font-medium text-[11px]",
  },
};

const labelReacts =
  "group-hover:fill-ink group-focus-visible:fill-ink group-focus-visible:underline";

/** One bird perched in a scene: its figure, its song when edited, and its name beneath. */
export function Bird({
  bird,
  x,
  y,
  facing,
  look,
  namePlace,
  speaking,
  idle,
}: BirdProps) {
  const scale = birdScale(bird);
  return (
    <g
      data-bird={bird.id}
      data-mood={bird.mood}
      data-asleep={look.asleep}
      transform={`translate(${x} ${y - 3 * scale})`}
    >
      <PerchedFigure
        look={look}
        id={bird.id}
        scale={scale}
        facing={facing}
        pose="standing"
        speaking={speaking}
        idle={idle}
      />
      <text
        y={namePlace.drop + 3 * scale}
        textAnchor="middle"
        data-name-size={namePlace.size}
        className={`${labelClass[bird.adopted ? "wire" : "fence"][namePlace.size]} ${labelReacts}`}
      >
        {bird.name}
      </text>
    </g>
  );
}

export interface BirdPortraitProps {
  bird: BirdModel;
  facing: Facing;
  /** The render's clock: the look follows the hour. */
  now: Date;
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
export function BirdPortrait({ bird, facing, now }: BirdPortraitProps) {
  const frame = portraitFrame(bird, facing);
  const half = frame.width / 2;
  const top = frame.height - 44;
  const look = birdLook(bird, now);
  return (
    <svg
      role="img"
      aria-label={`${bird.name}, ${look.stateWord}${look.asleep ? ", asleep" : ""}`}
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
        stroke={bird.adopted ? "var(--color-wire)" : "var(--color-post)"}
        strokeWidth={bird.adopted ? 3 : 6}
      />
      <Bird
        bird={bird}
        x={0}
        y={0}
        facing={facing}
        look={look}
        namePlace={roomyName}
        speaking={false}
        idle
      />
    </svg>
  );
}
