import { mockAviary } from "@perch/core/mock.ts";
import type { Bird, Wire } from "@perch/core/viewmodel.ts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sitDrop } from "./bird.tsx";
import { sideTailBaseTop, sideTailOverlap } from "./bubble.tsx";
import { mockBird } from "./mock-birds.ts";
import {
  Roost,
  roostDaylight,
  roostFrame,
  roostRowBleed,
  roostRowGap,
  roostWidth,
} from "./roost.tsx";
import { Scene } from "./scene.tsx";
import { Wire as WireDrawing } from "./wire.tsx";

afterEach(cleanup);

function roost(bird: Bird, night = false) {
  const onChip = vi.fn();
  const { container } = render(
    <Roost bird={bird} night={night} onChip={onChip} />,
  );
  const section = screen.getByRole("region", {
    name: `${bird.name} on its perch`,
  });
  return { container, section, onChip };
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

  it("sits the bird on its crossbar with no legs showing, while the wires' birds stand", () => {
    const perch = mockBird("dev/perch");
    const { container } = roost(perch);
    const frame = roostFrame(perch);
    const figure = container.querySelector('[data-part="figure"]');
    const body = container.querySelector('[data-part="body"]');
    const perched = figure?.parentElement?.parentElement?.parentElement;
    const crossbar = container.querySelector('[data-part="stand"] rect');

    expect(figure?.getAttribute("data-pose")).toBe("sitting");
    expect(figure?.querySelector('[data-part="legs"]')).toBeNull();
    expect(figure?.querySelector("line")).toBeNull();
    expect(figure?.getAttribute("transform")).toBe(`translate(0 ${sitDrop})`);
    // The figure's origin is 3 units above the crossbar; the body's foot comes down onto it.
    expect(perched?.getAttribute("transform")).toBe(
      `translate(${frame.centreX} ${frame.perchY - 3 * frame.scale})`,
    );
    expect(crossbar?.getAttribute("y")).toBe(String(frame.perchY));
    expect(
      Number(body?.getAttribute("cy")) +
        Number(body?.getAttribute("ry")) +
        sitDrop,
    ).toBe(3);
    // The beak is lower by the sit, and the side tail still ends on it.
    expect(frame.perchY - frame.beakY).toBeCloseTo(
      (45 - sitDrop) * frame.scale,
    );
    cleanup();

    const wire = mockAviary.wires[1] as Wire;
    const onWire = render(
      <Scene phase="day" height={400} label="test">
        <WireDrawing wire={wire} y={200} width={2000} night={false} />
      </Scene>,
    ).container;
    const standing = [...onWire.querySelectorAll('[data-part="figure"]')];

    expect(standing).toHaveLength(wire.birds.length);
    for (const each of standing) {
      expect(each.getAttribute("data-pose")).toBe("standing");
      expect(each.getAttribute("transform")).toBeNull();
      expect(each.querySelector('[data-part="legs"]')).not.toBeNull();
    }
  });

  it("speaks the bubble's speech and chips, with no name, state word or key beside the chips", () => {
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
    expect(
      within(section)
        .getAllByRole("button")
        .map((button) => button.getAttribute("data-kind")),
    ).toEqual(prism.bubble.chips.map((chip) => chip.kind));
    expect(section.querySelector('[data-part="state-word"]')).toBeNull();
    expect(section.textContent).not.toContain(prism.name);
    expect(section.textContent).not.toContain("Tell me the full story");
  });

  it("makes each chip a handle that hands back its kind when pressed", () => {
    const prism = mockBird("undev/prism");
    const { section, onChip } = roost(prism);
    const [first, second] = prism.bubble.chips;
    if (first === undefined || second === undefined) {
      throw new Error("prism carries two chips");
    }

    fireEvent.click(within(section).getByRole("button", { name: first.label }));
    fireEvent.click(
      within(section).getByRole("button", { name: second.label }),
    );

    expect(onChip.mock.calls).toEqual([[first.kind], [second.kind]]);
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
    expect(tail.getAttribute("class")).toContain("@min-[460px]:hidden");
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

  it("becomes a row from 460px of its container's width: bubble left at its reading cap, bird right, only as wide as the drawing needs", () => {
    const perch = mockBird("dev/perch");
    const { section } = roost(perch);
    const frame = roostFrame(perch);
    const layout = section.querySelector(
      '[data-part="roost-layout"]',
    ) as HTMLElement;
    const speech = section.querySelector('[data-part="roost-speech"]');
    const drawing = screen.getByRole("img") as unknown as SVGElement;

    // The roost is no container itself, so it has an intrinsic width a band can size to.
    expect(section.className.split(" ")).not.toContain("@container");
    expect(layout.className).toContain("@min-[460px]:flex-row");
    expect(layout.className).toContain("@min-[460px]:justify-end");
    expect(layout.className).toContain("flex-col");
    expect(speech?.nextElementSibling).toBe(drawing);
    expect(speech?.className.split(" ")).toEqual(
      expect.arrayContaining([
        "text-[13.5px]",
        "@min-[460px]:w-max",
        "@min-[460px]:max-w-[56ch]",
        "@min-[460px]:min-w-0",
        "@min-[460px]:flex-[0_1_auto]",
      ]),
    );
    expect(drawing.getAttribute("class")).toContain("shrink-0");
    expect(drawing.getAttribute("class")).toContain("@min-[460px]:ml-0");
    expect(drawing.getAttribute("width")).toBe(String(frame.width));
    expect(frame.width).toBe(150);
    expect(frame.width).toBe(roostFrame(mockBird("undev/spool")).width);
  });

  it("leaves a sideways tail from the bubble's right edge, slanting down to the beak, whatever the bubble's height", () => {
    for (const bird of [
      mockBird("dev/perch"),
      mockBird("undev/spool"),
      {
        ...mockBird("undev/spool"),
        plumpness: { outstanding: 50, fullness: 1 },
      },
    ]) {
      cleanup();
      const { section } = roost(bird);
      const frame = roostFrame(bird);
      const tail = section.querySelector(
        '[data-part="tail-side"]',
      ) as unknown as SVGElement;
      const width = roostRowGap + frame.beakX + sideTailOverlap;

      expect(tail.parentElement?.getAttribute("data-part")).toBe(
        "roost-bubble",
      );
      expect(tail.getAttribute("class")).toContain("hidden");
      expect(tail.getAttribute("class")).toContain("@min-[460px]:block");
      // Anchored from the bubble's top, which is the band's top, as the bird's drawing is.
      expect(tail.style.top).toBe("0px");
      expect(tail.style.left).toBe(`calc(100% - ${sideTailOverlap}px)`);
      expect(Number(tail.getAttribute("width"))).toBe(width);
      expect(Number(tail.getAttribute("height"))).toBe(
        Math.ceil(frame.beakY) + 1,
      );
      // The tip is at the beak: across the gap into the drawing as far as the beak, beakY down.
      expect(frame.rowTipY).toBe(frame.beakY);
      expect(tail.querySelector("path")?.getAttribute("d")).toContain(
        ` ${width} ${frame.beakY} `,
      );
      expect(tail.querySelector("path")?.getAttribute("d")).toMatch(
        new RegExp(`^M 0 ${sideTailBaseTop} `),
      );
    }
  });

  it("pins the row's bubble to the top and lets the pole and shadow hang below the band", () => {
    const perch = mockBird("dev/perch");
    const { section } = roost(perch);
    const layout = section.querySelector(
      '[data-part="roost-layout"]',
    ) as HTMLElement;
    const speech = section.querySelector('[data-part="roost-speech"]');
    const drawing = screen.getByRole("img") as unknown as SVGElement;

    expect(speech?.className).not.toContain("mt-");
    expect(layout.style.getPropertyValue("--row-lift")).toBe("");
    expect(layout.style.getPropertyValue("--row-bleed")).toBe("52px");
    expect(roostRowBleed).toBe(52);
    expect(drawing.getAttribute("class")).toContain(
      "@min-[460px]:-mb-(--row-bleed)",
    );
    expect(drawing.getAttribute("class")).toContain("overflow-visible");
    // The band is the drawing less the bleed: the bird on its crossbar.
    expect(roostFrame(perch).height - roostRowBleed).toBe(
      roostFrame(perch).perchY,
    );
  });

  it("fixes the stand and grows only the bird on it with its outstanding work", () => {
    const lean = roostFrame(mockBird("undev/spool"));
    const plump = roostFrame(mockBird("dev/perch"));
    const capped = roostFrame({
      ...mockBird("undev/spool"),
      plumpness: { outstanding: 50, fullness: 1 },
    });

    expect(plump.scale).toBeGreaterThan(lean.scale);
    expect(capped.scale).toBeGreaterThan(plump.scale);
    for (const frame of [plump, capped]) {
      expect(frame.perchY).toBe(lean.perchY);
      expect(frame.centreX).toBe(lean.centreX);
      expect(frame.width).toBe(lean.width);
      expect(frame.height).toBe(lean.height);
    }
    expect([lean.perchY, lean.centreX, lean.width, lean.height]).toEqual([
      103, 68, 150, 155,
    ]);
    expect(lean.beakY).toBeGreaterThan(plump.beakY);
    expect(plump.beakY).toBeGreaterThan(capped.beakY);
    expect(lean.beakX).toBeGreaterThan(capped.beakX);
    expect(capped.beakX).toBeGreaterThan(0);
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
