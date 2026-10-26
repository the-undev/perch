import type { Bird } from "@perch/core/viewmodel.ts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { sideTailOverlap } from "./bubble.tsx";
import { mockBird } from "./mock-birds.ts";
import {
  Roost,
  roostDaylight,
  roostFrame,
  roostRowAnchorY,
  roostRowGap,
  roostWidth,
} from "./roost.tsx";

afterEach(cleanup);

function roost(bird: Bird, night = false) {
  const { container } = render(<Roost bird={bird} night={night} />);
  const section = screen.getByRole("region", {
    name: `${bird.name} on its perch`,
  });
  return { container, section };
}

/** The scale transform the figure is drawn under. */
function figureTransform(container: HTMLElement): string {
  return (
    container
      .querySelector('[data-part="figure"]')
      ?.parentElement?.getAttribute("transform") ?? ""
  );
}

describe("the roost", () => {
  it("perches the bird on a T-stand in the post's colour, facing left toward its record, idle", () => {
    const perch = mockBird("dev/perch");
    const { container, section } = roost(perch);
    const { scale } = roostFrame(perch);

    expect(section.getAttribute("data-facing")).toBe("left");
    expect(figureTransform(container)).toBe(`scale(${-scale} ${scale})`);
    expect(
      container.querySelector('[data-part="stand"]')?.getAttribute("fill"),
    ).toBe("var(--color-post)");
    expect(container.querySelectorAll('[data-part="stand"] rect')).toHaveLength(
      2,
    );
    expect(
      container.getElementsByClassName("motion-safe:animate-bird-bob"),
    ).toHaveLength(1);
    expect(container.querySelector('[data-part="song"]')?.textContent).toBe(
      "♪",
    );
    expect(screen.getByRole("img", { name: "Perch, content" })).toBeDefined();
  });

  it("speaks the bubble's speech and chips, with no name, state word or key", () => {
    const prism = mockBird("undev/prism");
    const { section } = roost(prism);
    const bubble = within(section).getByRole("region", {
      name: "Prism says",
    });

    expect(bubble.querySelector('[data-part="speech"]')?.textContent).toBe(
      prism.bubble.speech,
    );
    expect(
      [...bubble.querySelectorAll("[data-kind]")].map(
        (chip) => chip.textContent,
      ),
    ).toEqual(prism.bubble.chips.map((chip) => chip.label));
    expect(within(section).queryByRole("heading")).toBeNull();
    expect(within(section).queryByRole("button")).toBeNull();
    expect(section.querySelector('[data-part="state-word"]')).toBeNull();
    expect(section.textContent).not.toContain(prism.name);
    expect(section.textContent).not.toContain("Tell me the full story");
  });

  it("hangs the stacked tail so its tip meets the left-facing beak", () => {
    const perch = mockBird("dev/perch");
    const { section } = roost(perch);
    const frame = roostFrame(perch);
    const tail = section.querySelector(
      '[data-part="tail-hanging"]',
    ) as unknown as SVGElement;
    const drawing = screen.getByRole("img") as unknown as SVGElement;
    const layout = section.querySelector(
      '[data-part="roost-layout"]',
    ) as HTMLElement;

    expect(frame.stackBeakX).toBeLessThan(roostWidth / 2);
    expect(tail.style.left).toBe(`${frame.stackBeakX - 2}px`);
    expect(tail.style.top).toBe("calc(100% - 3px)");
    expect(tail.getAttribute("height")).toBe(
      String(((frame.drop + 3) * 30) / 29),
    );
    expect(layout.style.getPropertyValue("--stack-gap")).toBe(
      `${frame.drop - frame.beakY}px`,
    );
    // The drawing's left edge puts its beak under the tail's tip.
    expect(
      Number.parseFloat(layout.style.getPropertyValue("--stack-left")) +
        frame.beakX,
    ).toBeCloseTo(frame.stackBeakX);
    expect(drawing.getAttribute("class")).toContain("mt-(--stack-gap)");
    expect(tail.getAttribute("class")).toContain("@min-[520px]:hidden");
  });

  it("drops the stacked tail far enough that the bubble's paper clears the head with daylight", () => {
    for (const id of ["undev/spool", "dev/perch"]) {
      const frame = roostFrame(mockBird(id));
      // The head's top is 13.5 bird units above the beak tip, the beak tip is where the tail ends.
      const headTopAboveBeak = 13.5 * frame.scale;

      expect(frame.drop - headTopAboveBeak).toBeGreaterThanOrEqual(
        roostDaylight,
      );
    }
    expect(roostFrame(mockBird("dev/perch")).drop).toBeGreaterThan(26);
  });

  it("becomes a row from 520px of its own width: bubble left, bird right, only as wide as the drawing needs", () => {
    const perch = mockBird("dev/perch");
    const { section } = roost(perch);
    const frame = roostFrame(perch);
    const layout = section.querySelector(
      '[data-part="roost-layout"]',
    ) as HTMLElement;
    const speech = section.querySelector('[data-part="roost-speech"]');
    const drawing = screen.getByRole("img") as unknown as SVGElement;

    expect(section.className).toContain("@container");
    expect(layout.className).toContain("@min-[520px]:flex-row");
    expect(layout.className).toContain("flex-col");
    expect(speech?.nextElementSibling).toBe(drawing);
    expect(speech?.className).toContain("@min-[520px]:flex-1");
    expect(drawing.getAttribute("class")).toContain("@min-[520px]:ml-0");
    expect(drawing.getAttribute("width")).toBe(String(frame.width));
    expect(frame.width).toBeLessThan(200);
    expect(frame.width).toBeGreaterThanOrEqual(100 + 2 * 6);
  });

  it("leaves a sideways tail from the bubble's right edge whose tip meets the beak whatever the bubble's height", () => {
    const perch = mockBird("dev/perch");
    const { section } = roost(perch);
    const frame = roostFrame(perch);
    const tail = section.querySelector(
      '[data-part="tail-side"]',
    ) as unknown as SVGElement;
    const layout = section.querySelector(
      '[data-part="roost-layout"]',
    ) as HTMLElement;

    expect(tail.parentElement?.getAttribute("data-part")).toBe("roost-bubble");
    expect(tail.getAttribute("class")).toContain("hidden");
    expect(tail.getAttribute("class")).toContain("@min-[520px]:block");
    expect(tail.style.left).toBe(`calc(100% - ${sideTailOverlap}px)`);
    // The tip is at 14 of the drawing's 32 units, so the anchor sits 26px below the bubble's top.
    expect(tail.style.top).toBe(`${roostRowAnchorY - 14}px`);
    // The tip lands on the beak: out across the gap and into the drawing as far as the beak.
    expect(Number(tail.getAttribute("width"))).toBe(
      roostRowGap + frame.beakX + sideTailOverlap,
    );
    // The bubble is lowered so its anchor is level with the beak, hanging the bird from it.
    expect(frame.rowLift + roostRowAnchorY).toBeCloseTo(frame.beakY);
    expect(layout.style.getPropertyValue("--row-lift")).toBe(
      `${frame.rowLift}px`,
    );
    expect(layout.style.getPropertyValue("--row-gap")).toBe(`${roostRowGap}px`);
    expect(
      section.querySelector('[data-part="roost-speech"]')?.className,
    ).toContain("@min-[520px]:mt-(--row-lift)");
  });

  it("grows the bird with its outstanding work, the stand tall enough to hold it", () => {
    const lean = roostFrame(mockBird("undev/spool"));
    const plump = roostFrame(mockBird("dev/perch"));

    expect(plump.scale).toBeGreaterThan(lean.scale);
    expect(plump.height).toBeGreaterThan(lean.height);
    expect(plump.beakY).toBeGreaterThan(0);
  });

  it("sleeps at night when the bird sleeps, still, and speaks woken", () => {
    const spool = mockBird("undev/spool");
    const { container, section } = roost(spool, true);

    expect(screen.getByRole("img").getAttribute("data-asleep")).toBe("true");
    expect(
      container.getElementsByClassName("motion-safe:animate-bird-bob"),
    ).toHaveLength(0);
    expect(section.querySelector('[data-part="speech"]')?.textContent).toBe(
      spool.bubble.wokenSpeech,
    );
  });

  it("roosts a fence bird dimmed, its bubble carrying no chips", () => {
    const hello = mockBird("dev/odin/hello");
    const { container, section } = roost(hello);

    expect(
      container.querySelector('[data-part="body"]')?.getAttribute("fill"),
    ).toBe("var(--color-plumage-dim)");
    expect(section.querySelector("[data-kind]")).toBeNull();
    expect(
      screen.getByRole("img", { name: "hello, not adopted" }),
    ).toBeDefined();
  });
});
