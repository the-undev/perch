import type { Bird } from "@perch/core/viewmodel.ts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { tailDrop } from "./bubble.tsx";
import { mockBird } from "./mock-birds.ts";
import { Roost, roostFrame, roostWidth } from "./roost.tsx";

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

  it("hangs the bubble's tail so its tip meets the left-facing beak", () => {
    const perch = mockBird("dev/perch");
    const { section } = roost(perch);
    const frame = roostFrame(perch);
    const tail = section.querySelector(
      '[data-part="roost-bubble"] > svg',
    ) as SVGElement;
    const drawing = screen.getByRole("img") as unknown as SVGElement;

    expect(frame.beakX).toBeLessThan(roostWidth / 2);
    expect(tail.style.left).toBe(`${frame.beakX - 2}px`);
    expect(drawing.style.marginTop).toBe(`${tailDrop - frame.beakY}px`);
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
