import { mockAviary } from "@perch/core/mock.ts";
import type { Bird } from "@perch/core/viewmodel.ts";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BirdPortrait, birdScale, fenceScale, portraitFrame } from "./bird.tsx";
import { mockBird } from "./mock-birds.ts";
import { Scene } from "./scene.tsx";
import { Fence, Wire } from "./wire.tsx";

afterEach(cleanup);

function part(container: HTMLElement, name: string): Element {
  const element = container.querySelector(`[data-part="${name}"]`);
  if (element === null) throw new Error(`no ${name} drawn`);
  return element;
}

function portrait(bird: Bird, night = false) {
  return render(<BirdPortrait bird={bird} facing="right" night={night} />)
    .container;
}

describe("the bird", () => {
  it("wears each mood as its breast colour", () => {
    const breasts = {
      content: part(portrait(mockBird("undev/spool")), "breast"),
      restless: part(portrait(mockBird("undev/skiff")), "breast"),
      distressed: part(portrait(mockBird("undev/prism")), "breast"),
    };

    expect(breasts.content.getAttribute("fill")).toBe("var(--color-green)");
    expect(breasts.restless.getAttribute("fill")).toBe("var(--color-amber)");
    expect(breasts.distressed.getAttribute("fill")).toBe("var(--color-red)");
  });

  it("is dimmed on the fence, whatever its mood", () => {
    const container = portrait(mockBird("dev/odin/hello"));

    expect(part(container, "breast").getAttribute("fill")).toBe(
      "var(--color-breast-dim)",
    );
    expect(part(container, "body").getAttribute("fill")).toBe(
      "var(--color-plumage-dim)",
    );
  });

  it("sleeps at night only when content and not edited, eyes closed and still", () => {
    const spool = portrait(mockBird("undev/spool"), true);
    const skiff = portrait(mockBird("undev/skiff"), true);
    const spoolByDay = portrait(mockBird("undev/spool"), false);

    expect(part(spool, "eye").getAttribute("fill")).toBe("var(--color-leg)");
    expect(
      spool.querySelector("[data-asleep=true] .motion-safe\\:animate-bird-bob"),
    ).toBeNull();
    expect(part(skiff, "eye").getAttribute("fill")).toBe("var(--color-eye)");
    expect(part(spoolByDay, "eye").getAttribute("fill")).toBe(
      "var(--color-eye)",
    );
  });

  it("sings while edited, by night as by day, and never on the fence", () => {
    const perch = mockBird("dev/perch");

    expect(part(portrait(perch, true), "song").textContent).toBe("♪");
    expect(part(portrait(perch, false), "song").textContent).toBe("♪");
    expect(
      portrait(mockBird("undev/spool")).querySelector('[data-part="song"]'),
    ).toBeNull();
  });

  it("flicks its tail only when distressed", () => {
    const flick = "motion-safe:animate-tail-flick";

    expect(
      part(portrait(mockBird("undev/prism")), "tail").getAttribute("class"),
    ).toBe(flick);
    expect(
      part(portrait(mockBird("undev/skiff")), "tail").getAttribute("class"),
    ).toBeNull();
  });

  it("grows with importance and with outstanding work", () => {
    const base = mockBird("undev/spool");
    const important = { ...base, size: { ...base.size, rank: 0 } };
    const plump = { ...base, plumpness: { outstanding: 50, fullness: 1 } };

    expect(birdScale(base)).toBeCloseTo(0.9);
    expect(birdScale(mockBird(".dotfiles"))).toBeGreaterThan(
      birdScale(base) * 1.4,
    );
    expect(birdScale(important)).toBeCloseTo(1.8);
    expect(birdScale(plump)).toBeCloseTo(0.9 * 1.65);
    expect(birdScale(mockBird("dev/odin/hello"))).toBeCloseTo(fenceScale);
  });
  it("frames a portrait with the beak tip above the wire, mirrored when facing left", () => {
    const spool = mockBird("undev/spool");
    const right = portraitFrame(spool, "right");
    const left = portraitFrame(spool, "left");
    const scale = birdScale(spool);

    expect(right.beakX - right.width / 2).toBeCloseTo(37 * scale);
    expect(left.beakX + right.beakX).toBeCloseTo(right.width);
    expect(right.height - 44 - right.beakY).toBeCloseTo(45 * scale);
  });
});

describe("the wire and the fence", () => {
  it("perches a wire's birds in view model order, leftmost first, under its name", () => {
    const wire = mockAviary.wires[1];
    if (wire === undefined) throw new Error("the mock has a second wire");
    const { container } = render(
      <Scene phase="day" height={400} label="test">
        <Wire wire={wire} y={200} width={2000} night={false} />
      </Scene>,
    );
    const drawn = [...container.querySelectorAll("[data-bird]")];
    const xs = drawn.map((g) =>
      Number(
        /translate\(([-\d.]+)/.exec(g.getAttribute("transform") ?? "")?.[1],
      ),
    );

    expect(drawn.map((g) => g.getAttribute("data-bird"))).toEqual(
      wire.birds.map((bird) => bird.id),
    );
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(container.textContent).toContain("Projects");
    expect(container.textContent).toContain("4 attention");
  });

  it("dims every fence bird and counts them", () => {
    const { container } = render(
      <Scene phase="night" height={400} label="test">
        <Fence
          fence={mockAviary.fence}
          y={300}
          width={2000}
          height={400}
          night={true}
        />
      </Scene>,
    );
    const breasts = [...container.querySelectorAll('[data-part="breast"]')];

    expect(breasts).toHaveLength(mockAviary.fence.birds.length);
    expect(
      breasts.every(
        (b) => b.getAttribute("fill") === "var(--color-breast-dim)",
      ),
    ).toBe(true);
    expect(container.textContent).toContain("On the fence · 3 not adopted");
  });
});
