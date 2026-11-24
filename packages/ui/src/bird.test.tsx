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
import { mockBird, mockBirds } from "./mock-birds.ts";
import { Scene } from "./scene.tsx";
import { skyPhase } from "./sky.ts";
import {
  columnEdgeFor,
  Fence,
  fenceName,
  labelX,
  paintedInk,
  paintedSize,
  tallySize,
  Wire,
} from "./wire.tsx";

/** Two in the afternoon, by day. */
const afternoon = new Date(2026, 9, 22, 14, 0);
/** Three in the morning, in the sleep hours. */
const smallHours = new Date(2026, 9, 23, 3, 0);

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
      <Wire wire={wire} y={200} width={2000} now={afternoon} />
    </Scene>,
  ).container;
}

afterEach(cleanup);

function part(container: HTMLElement, name: string): Element {
  const element = container.querySelector(`[data-part="${name}"]`);
  if (element === null) throw new Error(`no ${name} drawn`);
  return element;
}

function portrait(bird: Bird, now = afternoon) {
  return render(<BirdPortrait bird={bird} facing="right" now={now} />)
    .container;
}

/** How the bird moves: still, or how high its bob lifts and whether its tail flicks. */
function motionOf(container: HTMLElement): string {
  const bob = container.querySelector(".motion-safe\\:animate-bird-bob");
  if (bob === null) return "still";
  const lift = (bob as HTMLElement).style.getPropertyValue("--bob-lift");
  const flicks =
    part(container, "tail").getAttribute("class") ===
    "motion-safe:animate-tail-flick";
  const bobs: Record<string, string> = {
    "2": "gentle bob",
    "3": "higher, quicker bob",
    "4.4": "highest bob",
  };
  return flicks ? `${bobs[lift]}, tail flicks` : (bobs[lift] ?? lift);
}

/** What the owner sees of a bird drawn at a time, in the look table's words. */
function seen(bird: Bird, now: Date) {
  const container = portrait(bird, now);
  const breast = part(container, "breast").getAttribute("fill");
  const colours: Record<string, string> = {
    "var(--color-breast-dim)": "dimmed",
    "var(--color-green)": "green",
    "var(--color-amber)": "amber",
    "var(--color-red)": "red",
  };
  const mark = container.querySelector('[data-part="mark"]')?.textContent;
  const label = container.querySelector("svg")?.getAttribute("aria-label");
  return {
    colour: colours[breast ?? ""],
    statePhrase: label?.split(", ")[1],
    eyes: part(container, "eye").tagName === "circle" ? "open" : "closed",
    mark: mark === "z" ? "z" : mark === "♪" ? "note" : "none",
    motion: motionOf(container),
  };
}

describe("the bird's look", () => {
  it.each([
    [
      "dev/odin/hello",
      "on the fence",
      "06:00 to midnight",
      "dimmed",
      "not adopted",
      "open",
      "none",
      "gentle bob",
    ],
    [
      "dev/odin/hello",
      "on the fence",
      "midnight to 06:00",
      "dimmed",
      "not adopted",
      "closed",
      "z",
      "still",
    ],
    [
      "undev/spool",
      "content, not edited",
      "06:00 to midnight",
      "green",
      "content",
      "open",
      "none",
      "gentle bob",
    ],
    [
      "undev/spool",
      "content, not edited",
      "midnight to 06:00",
      "green",
      "content",
      "closed",
      "z",
      "still",
    ],
    [
      "dev/perch",
      "content, edited",
      "06:00 to midnight",
      "green",
      "content",
      "open",
      "note",
      "gentle bob",
    ],
    [
      "dev/perch",
      "content, edited",
      "midnight to 06:00",
      "green",
      "content",
      "open",
      "note",
      "gentle bob",
    ],
    [
      "undev/skiff",
      "restless, not edited",
      "06:00 to midnight",
      "amber",
      "restless",
      "open",
      "none",
      "higher, quicker bob",
    ],
    [
      "undev/skiff",
      "restless, not edited",
      "midnight to 06:00",
      "amber",
      "restless",
      "closed",
      "z",
      "still",
    ],
    [
      "obsidian/Hothouse",
      "restless, edited",
      "06:00 to midnight",
      "amber",
      "restless",
      "open",
      "note",
      "higher, quicker bob",
    ],
    [
      "obsidian/Hothouse",
      "restless, edited",
      "midnight to 06:00",
      "amber",
      "restless",
      "open",
      "note",
      "higher, quicker bob",
    ],
    [
      "undev/Hollow-legacy",
      "distressed, not edited",
      "06:00 to midnight",
      "red",
      "distressed",
      "open",
      "none",
      "highest bob, tail flicks",
    ],
    [
      "undev/Hollow-legacy",
      "distressed, not edited",
      "midnight to 06:00",
      "red",
      "distressed",
      "open",
      "none",
      "highest bob, tail flicks",
    ],
    [
      "undev/prism",
      "distressed, edited",
      "06:00 to midnight",
      "red",
      "distressed",
      "open",
      "note",
      "highest bob, tail flicks",
    ],
    [
      "undev/prism",
      "distressed, edited",
      "midnight to 06:00",
      "red",
      "distressed",
      "open",
      "note",
      "highest bob, tail flicks",
    ],
  ])(
    "looks right for %s, %s, %s",
    (id, _row, hour, colour, statePhrase, eyes, mark, motion) => {
      const now = hour === "06:00 to midnight" ? afternoon : smallHours;

      expect(seen(mockBird(id), now)).toEqual({
        colour,
        statePhrase,
        eyes,
        mark,
        motion,
      });
    },
  );

  it.each([
    ["undev/spool", "content, not edited", "06:00 to midnight"],
    ["undev/skiff", "restless, not edited", "midnight to 06:00"],
    ["undev/Hollow-legacy", "distressed, not edited", "06:00 to midnight"],
    ["undev/prism", "distressed, edited", "06:00 to midnight"],
    ["undev/prism", "distressed, edited", "midnight to 06:00"],
  ])("looks snoozed for %s, %s, %s", (id, _row, hour) => {
    const now = hour === "06:00 to midnight" ? afternoon : smallHours;
    const snoozed = { ...mockBird(id), snooze: { until: "2026-11-01" } };

    expect(seen(snoozed, now)).toEqual({
      colour: "dimmed",
      statePhrase: "snoozed",
      eyes: "closed",
      mark: "z",
      motion: "still",
    });
  });

  it("looks snoozed with no end date until woken", () => {
    const snoozed = { ...mockBird("undev/skiff"), snooze: { until: null } };

    expect(seen(snoozed, afternoon).statePhrase).toBe("snoozed");
  });

  it("wears its real mood from the start of the snooze's end date", () => {
    const skiff = mockBird("undev/skiff");
    const snoozed = { ...skiff, snooze: { until: "2026-10-22" } };

    expect(seen(snoozed, afternoon)).toEqual(seen(skiff, afternoon));
    expect(seen(snoozed, new Date(2026, 9, 21, 23, 59)).statePhrase).toBe(
      "snoozed",
    );
  });

  it("keeps a snoozed bird's plumpness and stands it on the wire", () => {
    const plump = {
      ...mockBird("undev/skiff"),
      plumpness: { outstanding: 50, fullness: 1 },
    };
    const snoozed = { ...plump, snooze: { until: null } };

    expect(birdScale(snoozed)).toBeCloseTo(birdScale(plump));
    expect(
      portrait(snoozed).querySelector("line")?.getAttribute("stroke"),
    ).toBe("var(--color-wire)");
  });

  it("sleeps from midnight until 06:00, and not in the sky's night before midnight", () => {
    const at = (hours: number, minutes: number) =>
      new Date(2026, 9, 22, hours, minutes);
    const asleep = (now: Date) =>
      mockBirds.filter((bird) => seen(bird, now).eyes === "closed").length;

    expect(skyPhase(at(22, 30))).toBe("night");
    expect([at(21, 0), at(23, 59), at(6, 0)].map(asleep)).toEqual([0, 0, 0]);
    expect([at(0, 0), at(5, 59)].map(asleep)).toEqual([11, 11]);
  });

  it("wakes and sleeps every fence bird by the hour, whatever its health, dimmed", () => {
    const hello = mockBird("dev/odin/hello");
    const distressed = { ...hello, mood: "distressed" as const };

    expect([afternoon, smallHours].map((now) => seen(distressed, now))).toEqual(
      [afternoon, smallHours].map((now) => seen(hello, now)),
    );
    expect(part(portrait(distressed), "body").getAttribute("fill")).toBe(
      "var(--color-plumage-dim)",
    );
  });

  it("puts the z where the note sits, in the bird's own colour", () => {
    const spool = mockBird("undev/spool");
    const asleep = portrait(spool, smallHours);
    const z = part(asleep, "mark");
    cleanup();
    const singing = portrait(
      { ...spool, workState: "uncommitted" },
      smallHours,
    );
    const note = part(singing, "mark");

    expect([z.getAttribute("x"), z.getAttribute("y")]).toEqual([
      note.getAttribute("x"),
      note.getAttribute("y"),
    ]);
    expect(z.getAttribute("fill")).toBe("var(--color-green)");
    expect(z.getAttribute("class")).toContain("font-display");
    expect(z.getAttribute("class")).toContain("italic");
  });

  it("looks the same committed as merged, by day and by night", () => {
    const spool = mockBird("undev/spool");
    const committed = { ...spool, workState: "committed" as const };

    for (const now of [afternoon, smallHours]) {
      expect(seen(committed, now)).toEqual(seen(spool, now));
    }
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
        <Wire wire={wire} y={200} width={2000} now={afternoon} />
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
    const allContent = {
      name: "Quiet",
      birds: projects.birds.filter((bird) => bird.mood === "content"),
    };
    const lines = [machine, projects, allContent].map((wire) => {
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
      [at("2 restless", 218, "fill-amber")],
      [
        at("3 distressed", 218, "fill-red"),
        at("1 restless", 238, "fill-amber"),
      ],
      [at("all content", 218, "fill-ink-faint")],
    ]);
  });

  it("starts the wire's birds at the column edge", () => {
    const container = wireScene(mockAviary.wires[1] as WireModel);
    const xs = [...container.querySelectorAll("[data-bird]")].map((g) =>
      Number(
        /translate\(([-\d.]+)/.exec(g.getAttribute("transform") ?? "")?.[1],
      ),
    );

    expect(Math.min(...xs)).toBe(columnEdgeFor(2000));
  });

  it("dims every fence bird, paints its name behind them and counts them beneath the rail", () => {
    const { container } = render(
      <Scene phase="night" width={2000} height={400} label="test">
        <Fence
          fence={mockAviary.fence}
          y={300}
          width={2000}
          height={400}
          now={smallHours}
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
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(columnEdgeFor(2000));
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
          now={afternoon}
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
