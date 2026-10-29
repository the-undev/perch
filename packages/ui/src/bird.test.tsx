import { mockAviary } from "@perch/core/mock.ts";
import type { Bird, Wire as WireModel } from "@perch/core/viewmodel.ts";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  BirdPortrait,
  birdScale,
  fenceScale,
  plumpScale,
  portraitFrame,
  wireScale,
} from "./bird.tsx";
import { mockBird } from "./mock-birds.ts";
import { Scene } from "./scene.tsx";
import {
  columnEdge,
  Fence,
  fenceName,
  labelX,
  paintedInk,
  paintedSize,
  tallySize,
  Wire,
} from "./wire.tsx";

/** Whether `later` comes after `earlier` in the document, so it is drawn in front of it. */
function drawnAfter(earlier: Element, later: Element): boolean {
  return (
    (earlier.compareDocumentPosition(later) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
    0
  );
}

function wireScene(wire: WireModel) {
  return render(
    <Scene phase="day" width={2000} height={400} label="test">
      <Wire wire={wire} y={200} width={2000} night={false} />
    </Scene>,
  ).container;
}

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

  it("idles from the start when it is drawn outside the aviary", () => {
    const distressed = portrait(mockBird("undev/prism"));

    expect(
      distressed.getElementsByClassName("motion-safe:animate-bird-bob").length,
    ).toBeGreaterThan(0);
    expect(part(distressed, "tail").getAttribute("class")).toBe(
      "motion-safe:animate-tail-flick",
    );
  });

  it("draws every bird on a wire at one size, grown only by outstanding work", () => {
    const base = mockBird("undev/spool");
    const plump = { ...base, plumpness: { outstanding: 50, fullness: 1 } };
    const onWires = mockAviary.wires.flatMap((wire) => wire.birds);

    expect(birdScale(base)).toBeCloseTo(wireScale);
    for (const bird of onWires) {
      expect(birdScale(bird)).toBeCloseTo(
        wireScale * plumpScale(bird.plumpness),
      );
    }
    expect(birdScale(plump)).toBeCloseTo(wireScale * 1.65);
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
      <Scene phase="day" width={2000} height={400} label="test">
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
    expect(container.textContent).toContain("3 attention");
  });

  it("paints the wire's name on the sky behind its line and birds, cut round each bird", () => {
    const projects = mockAviary.wires[1] as WireModel;
    const container = wireScene(projects);
    const painted = container.querySelector('[data-part="painted-name"] text');
    const mask = container.querySelector('[data-part="painted-name"] mask');
    const line = container.querySelector("[data-wire] > path");
    const birds = [...container.querySelectorAll("[data-bird]")];
    if (painted === null || mask === null || line === null) {
      throw new Error("no painted name, mask or wire drawn");
    }

    expect(painted.textContent).toBe(projects.name);
    expect(painted.getAttribute("x")).toBe(String(labelX));
    expect(painted.getAttribute("font-size")).toBe(String(paintedSize));
    expect(painted.getAttribute("opacity")).toBe(String(paintedInk));
    expect(painted.getAttribute("class")).toContain("font-display");
    expect(painted.getAttribute("mask")).toBe(`url(#${mask.id})`);
    expect(drawnAfter(painted, line)).toBe(true);
    expect(birds.every((bird) => drawnAfter(painted, bird))).toBe(true);
    expect(mask.querySelector("rect")?.getAttribute("fill")).toBe("#fff");
    expect(
      [...mask.querySelectorAll("[data-cut]")].map((cut) =>
        cut.getAttribute("data-cut"),
      ),
    ).toEqual(birds.map((bird) => bird.getAttribute("data-bird")));
    expect(
      mask
        .querySelector('[data-cut] [stroke="#000"]')
        ?.getAttribute("stroke-width"),
    ).toBe("9");
  });

  it("hangs the tally under the wire's left end in front, a line per word group in its colour", () => {
    const [machine, projects] = mockAviary.wires as [WireModel, WireModel];
    const settled = {
      name: "Quiet",
      birds: projects.birds.filter((bird) => bird.mood === "content"),
    };
    const lines = [machine, projects, settled].map((wire) => {
      const container = wireScene(wire);
      const tally = [...container.querySelectorAll('[data-part="tally"] text')];
      const birds = [...container.querySelectorAll("[data-bird]")];
      expect(
        tally.every((line) => birds.every((bird) => drawnAfter(bird, line))),
      ).toBe(true);
      cleanup();
      return tally.map((line) => ({
        words: line.textContent,
        x: line.getAttribute("x"),
        y: line.getAttribute("y"),
        size: line.getAttribute("font-size"),
        ink: /fill-[\w-]+/.exec(line.getAttribute("class") ?? "")?.[0],
      }));
    });
    const at = (words: string, y: number, ink: string) => ({
      words,
      x: String(labelX),
      y: String(y),
      size: String(tallySize),
      ink,
    });

    expect(lines).toEqual([
      [at("2 drifting", 218, "fill-amber")],
      [at("3 attention", 218, "fill-red"), at("1 drifting", 238, "fill-amber")],
      [at("all settled", 218, "fill-ink-faint")],
    ]);
  });

  it("starts the wire's birds at the column edge", () => {
    const container = wireScene(mockAviary.wires[1] as WireModel);
    const xs = [...container.querySelectorAll("[data-bird]")].map((g) =>
      Number(
        /translate\(([-\d.]+)/.exec(g.getAttribute("transform") ?? "")?.[1],
      ),
    );

    expect(Math.min(...xs)).toBe(columnEdge);
  });

  it("dims every fence bird, paints its name behind them and counts them beneath the rail", () => {
    const { container } = render(
      <Scene phase="night" width={2000} height={400} label="test">
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
    const birds = [...container.querySelectorAll("[data-bird]")];
    const painted = container.querySelector('[data-part="painted-name"] text');
    const count = container.querySelector('[data-part="fence-count"]');
    const xs = birds.map((g) =>
      Number(
        /translate\(([-\d.]+)/.exec(g.getAttribute("transform") ?? "")?.[1],
      ),
    );
    if (painted === null || count === null) {
      throw new Error("no painted name or count drawn");
    }

    expect(breasts).toHaveLength(mockAviary.fence.birds.length);
    expect(
      breasts.every(
        (b) => b.getAttribute("fill") === "var(--color-breast-dim)",
      ),
    ).toBe(true);
    expect(painted.textContent).toBe(fenceName);
    expect(Number(painted.getAttribute("y"))).toBeLessThan(300);
    expect(birds.every((bird) => drawnAfter(painted, bird))).toBe(true);
    expect(
      [...container.querySelectorAll("[data-cut]")].map((cut) =>
        cut.getAttribute("data-cut"),
      ),
    ).toEqual(birds.map((bird) => bird.getAttribute("data-bird")));
    expect(count.textContent).toBe("3 not adopted");
    expect(count.getAttribute("x")).toBe(String(labelX));
    expect(Number(count.getAttribute("y"))).toBeGreaterThan(300);
    expect(count.getAttribute("class")).toContain("fill-ink-faint");
    expect(birds.every((bird) => drawnAfter(bird, count))).toBe(true);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(columnEdge);
    expect(container.textContent).not.toContain("·");
  });

  it("drops every other name to a lower baseline on a crowded fence", () => {
    const birds = Array.from({ length: 21 }, (_, position) => ({
      ...(mockAviary.fence.birds[position % 3] as Bird),
      id: `fence-${position}`,
      position,
    }));
    const { container } = render(
      <Scene phase="day" width={2000} height={400} label="test">
        <Fence
          fence={{ birds }}
          y={300}
          width={2000}
          height={400}
          night={false}
        />
      </Scene>,
    );
    const names = [...container.querySelectorAll("[data-bird] > text")];
    const [first, second] = names;

    expect(names).toHaveLength(21);
    expect(first?.getAttribute("y")).not.toBe(second?.getAttribute("y"));
    expect(first?.getAttribute("data-name-size")).toBe("small");
  });
});
