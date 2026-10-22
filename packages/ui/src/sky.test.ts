import { describe, expect, it } from "vitest";
import { isNight, skyPhase } from "./sky.ts";

const at = (hour: number) => new Date(2026, 9, 22, hour, 30);

describe("the sky", () => {
  it("follows the local hour through night, dawn, day and dusk", () => {
    expect(
      [0, 5, 6, 8, 9, 16, 17, 20, 21, 23].map((h) => skyPhase(at(h))),
    ).toEqual([
      "night",
      "night",
      "dawn",
      "dawn",
      "day",
      "day",
      "dusk",
      "dusk",
      "night",
      "night",
    ]);
  });

  it("counts only the night phase as night", () => {
    expect(isNight("night")).toBe(true);
    expect(isNight("dusk")).toBe(false);
  });
});
