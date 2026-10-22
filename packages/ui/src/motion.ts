// Per-bird variety for the idle animations, seeded from the bird's id so a bird keeps its rhythm
// across renders. The hash and mixer are the board's.

import type { CSSProperties } from "react";

/** A string hash, stable across runs. */
export function hash(text: string): number {
  let value = 7;
  for (const char of text) {
    value = (value * 31 + char.charCodeAt(0)) >>> 0;
  }
  return value;
}

/** A number in [0, 1) from an integer seed, mixed so neighbouring seeds do not correlate. */
export function scatter(seed: number): number {
  let x = (seed ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Inline custom properties, which React's style type does not declare. */
export type CustomProperties = CSSProperties & Record<`--${string}`, string>;
