// The sky a scene is drawn on: the phase's gradient, the sun or moon, and the stars. Scene units are
// the board's: 2000 wide, any height; the drawing scales to the element's width.

import type { ReactNode } from "react";
import { type CustomProperties, scatter } from "./motion.ts";
import type { SkyPhase } from "./sky.ts";

/** The scene's width in its own units; wires and the fence are laid out across it. */
export const sceneWidth = 2000;

const starCount: Record<SkyPhase, number> = {
  dawn: 60,
  day: 0,
  dusk: 60,
  night: 110,
};

function Sun({ phase, x, y }: { phase: "dawn" | "day"; x: number; y: number }) {
  const fill = phase === "day" ? "var(--color-sun)" : "var(--color-sun-low)";
  return (
    <g data-part="sun">
      <circle cx={x} cy={y} r={42} fill={fill} opacity={0.9} />
      <circle cx={x} cy={y} r={58} fill={fill} opacity={0.12} />
    </g>
  );
}

function Moon({ x, y }: { x: number; y: number }) {
  return (
    <path
      data-part="moon"
      d={`M ${x} ${y - 44} A 44 44 0 1 0 ${x} ${y + 44} A 34 34 0 1 1 ${x} ${y - 44} Z`}
      fill="var(--color-moon)"
      opacity={0.85}
    />
  );
}

function Stars({ count, height }: { count: number; height: number }) {
  return (
    <g data-part="stars">
      {Array.from({ length: count }, (_, i) => {
        const twinkles = i % 7 === 0;
        const style: CustomProperties | undefined = twinkles
          ? {
              "--twinkle-duration": `${3000 + Math.round(scatter(i * 4 + 5) * 4000)}ms`,
            }
          : undefined;
        const cx = scatter(i * 4) * sceneWidth;
        const cy = scatter(i * 4 + 1) * height * 0.5;
        return (
          <circle
            key={`${cx} ${cy}`}
            cx={cx}
            cy={cy}
            r={scatter(i * 4 + 2) * 1.4 + 0.3}
            fill="var(--color-star)"
            opacity={0.25 + scatter(i * 4 + 3) * 0.4}
            className={twinkles ? "motion-safe:animate-twinkle" : undefined}
            style={style}
          />
        );
      })}
    </g>
  );
}

export interface SceneProps {
  phase: SkyPhase;
  /** The scene's height in scene units; the width is always 2000. */
  height: number;
  /** What the scene shows, for assistive technology. */
  label: string;
  /** Wires, the fence and birds, in scene units. */
  children: ReactNode;
}

/** A piece of sky at one phase, holding wires and birds drawn in scene units. */
export function Scene({ phase, height, label, children }: SceneProps) {
  const lightX = sceneWidth - 300;
  const lightY = height * 0.11;
  return (
    <div
      data-phase={phase}
      className="overflow-hidden"
      style={{
        background:
          "linear-gradient(var(--color-sky-top), var(--color-sky-low) 78%, var(--color-horizon))",
      }}
    >
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${sceneWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
      >
        {phase === "day" || phase === "dawn" ? (
          <Sun phase={phase} x={lightX} y={lightY} />
        ) : (
          <Moon x={lightX} y={lightY} />
        )}
        <Stars count={starCount[phase]} height={height} />
        {children}
      </svg>
    </div>
  );
}
