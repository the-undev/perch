import { mockAviary, mockSnapshot } from "@perch/core/mock.ts";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  layoutAviary,
  type PlacedBird,
  placeBubble,
  placedBirds,
  toPixels,
} from "./aviary-layout.ts";
import { AviaryScene, AviaryView } from "./aviary-view.tsx";
import type { PixelSize } from "./hooks.ts";
import { mockBird, mockBirds } from "./mock-birds.ts";
import { minPixelsPerUnit, sceneWidth } from "./scene.tsx";

afterEach(cleanup);

const morning = new Date(mockSnapshot.scannedAt);
const night = new Date(2026, 9, 22, 23, 30);

/** The mock aviary's scene drawn into a window of a given size. */
function scene(size: PixelSize) {
  return render(
    <AviaryScene
      aviary={mockAviary}
      now={morning}
      size={size}
      onLaunch={() => {}}
      onFullStory={() => {}}
      onAdopt={() => {}}
      onChip={() => {}}
      flyingIds={new Set()}
    />,
  );
}

function show(now = morning) {
  const onLaunch = vi.fn();
  const onFullStory = vi.fn();
  const onAdopt = vi.fn();
  const onChip = vi.fn();
  const { container } = render(
    <AviaryView
      aviary={mockAviary}
      now={now}
      onLaunch={onLaunch}
      onFullStory={onFullStory}
      onAdopt={onAdopt}
      onChip={onChip}
    />,
  );
  return { container, onLaunch, onFullStory, onAdopt, onChip };
}

function birdButton(id: string): HTMLElement {
  const bird = mockBird(id);
  return screen.getByRole("button", {
    name: `${bird.name}, ${bird.bubble.stateWord}`,
  });
}

describe("the aviary view", () => {
  it("perches every mock bird, names every wire and counts the fence", () => {
    const { container } = show();
    const drawn = [...container.querySelectorAll("[data-bird]")].map((bird) =>
      bird.getAttribute("data-bird"),
    );

    expect(drawn.sort()).toEqual(mockBirds.map((bird) => bird.id).sort());
    for (const wire of mockAviary.wires) {
      expect(container.textContent).toContain(wire.name);
    }
    expect(container.textContent).toContain("On the fence · 3 not adopted");
  });

  it("paints each wire's name behind every wire and bird, cut round that wire's landed birds", () => {
    const flying = mockAviary.wires[1]?.birds[0]?.id ?? "";
    const { container } = render(
      <AviaryScene
        aviary={mockAviary}
        now={morning}
        size={{ width: 1400, height: 800 }}
        onLaunch={() => {}}
        onFullStory={() => {}}
        onAdopt={() => {}}
        onChip={() => {}}
        flyingIds={new Set([flying])}
      />,
    );
    const painted = [
      ...container.querySelectorAll('[data-part="painted-name"]'),
    ];
    const firstLine = container.querySelector(
      'path[stroke="var(--color-wire)"]',
    );
    const firstBird = container.querySelector("[data-bird]");
    const cutsOf = (name: Element) =>
      [...name.querySelectorAll("[data-cut]")]
        .map((cut) => cut.getAttribute("data-cut"))
        .sort();
    const precedes = (earlier: Element, later: Element | null) =>
      later !== null &&
      (earlier.compareDocumentPosition(later) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0;

    expect(
      painted.map((name) => name.querySelector("text")?.textContent),
    ).toEqual(mockAviary.wires.map((wire) => wire.name));
    for (const [i, name] of painted.entries()) {
      const wire = mockAviary.wires[i];
      expect(precedes(name, firstLine)).toBe(true);
      expect(precedes(name, firstBird)).toBe(true);
      expect(cutsOf(name)).toEqual(
        (wire?.birds ?? [])
          .map((bird) => bird.id)
          .filter((id) => id !== flying)
          .sort(),
      );
    }
  });

  it("opens a bird's bubble when it is clicked, and its beak wiggles", () => {
    const { container } = show();
    const prism = mockBird("undev/prism");

    fireEvent.click(birdButton("undev/prism"));

    const bubble = screen.getByRole("region", { name: "Prism says" });
    expect(within(bubble).getByText(prism.bubble.speech)).toBeDefined();
    expect(
      container
        .querySelector('[data-bird="undev/prism"] [data-part="beak"]')
        ?.getAttribute("class"),
    ).toContain("animate-beak-wiggle");
  });

  it("opens the bubble from the keyboard too", () => {
    show();

    fireEvent.keyDown(birdButton("dev/perch"), { key: "Enter" });

    expect(screen.getByRole("region", { name: "Perch says" })).toBeDefined();
  });

  it("closes the bubble on Escape and on a click in the open sky", () => {
    const { container } = show();

    fireEvent.click(birdButton("undev/spool"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Spool says" })).toBeNull();

    fireEvent.click(birdButton("undev/spool"));
    fireEvent.click(container.querySelector("[data-phase]") as Element);
    expect(screen.queryByRole("region", { name: "Spool says" })).toBeNull();
  });

  it("hands back a launch and the full story, closing the bubble for the second", () => {
    const { onLaunch, onFullStory } = show();
    const perch = mockBird("dev/perch");

    fireEvent.click(birdButton("dev/perch"));
    fireEvent.click(screen.getByRole("button", { name: "Open in VS Code" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Tell me the full story" }),
    );

    expect(onLaunch).toHaveBeenCalledWith(perch.detail.actions[1]);
    expect(onFullStory).toHaveBeenCalledWith(perch);
    expect(screen.queryByRole("region", { name: "Perch says" })).toBeNull();
  });

  it("hands back a fence bird's adopt key, closing its bubble, and gives an adopted bird none", () => {
    const { onAdopt } = show();
    const hello = mockBird("dev/odin/hello");

    fireEvent.click(birdButton("dev/perch"));
    expect(screen.queryByRole("button", { name: "Adopt" })).toBeNull();
    fireEvent.click(birdButton("dev/odin/hello"));
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));

    expect(onAdopt).toHaveBeenCalledWith(hello);
    expect(screen.queryByRole("region", { name: "hello says" })).toBeNull();
  });

  it("hands back the bird and the kind of a chip pressed in its bubble, closing the bubble", () => {
    const { onChip } = show();
    const prism = mockBird("undev/prism");
    const [ci] = prism.bubble.chips;
    if (ci === undefined) throw new Error("prism carries a CI chip");

    fireEvent.click(birdButton("undev/prism"));
    fireEvent.click(
      within(screen.getByRole("region", { name: "Prism says" })).getByRole(
        "button",
        { name: ci.label },
      ),
    );

    expect(onChip).toHaveBeenCalledWith(prism, "ci");
    expect(screen.queryByRole("region", { name: "Prism says" })).toBeNull();
  });

  it("wakes a sleeping bird clicked at night", () => {
    show(night);

    fireEvent.click(birdButton("undev/spool"));

    expect(
      screen.getByRole("region", { name: "Spool says" }).textContent,
    ).toContain("Mm? You woke me.");
  });

  it("shows a hovered bird's tip with the numbers it carries", () => {
    show();

    fireEvent.pointerMove(birdButton("undev/prism"));

    expect(screen.getByRole("tooltip").textContent).toBe(
      "Prism · distressedci failure · 4 uncommitted · 2 open PRs · 78 open items",
    );
  });

  it("states each failing source with its age, and the scan's warnings, in the sky", () => {
    const { container } = show();
    const notices = container.querySelector('[data-part="notices"]');

    expect(notices?.textContent).toContain(
      "Couldn't read Forgejo accounts, last read under an hour ago: fetch failed",
    );
    expect(notices?.textContent).toContain(
      "include not found: /home/owner/work",
    );
  });

  it("never draws a bird's name, a wire's words or the fence's below the floor fraction of their full pixel size", () => {
    for (const size of [
      { width: 3440, height: 1380 },
      { width: 1920, height: 1000 },
      { width: 1400, height: 800 },
      { width: 900, height: 900 },
      { width: 480, height: 900 },
    ]) {
      const { container } = scene(size);
      const drawing = container.querySelector("svg") as SVGSVGElement;
      const [, , unitsWide, unitsTall] = (drawing.getAttribute("viewBox") ?? "")
        .split(" ")
        .map(Number) as [number, number, number, number];
      const pixelsPerUnit = Math.min(
        size.width / unitsWide,
        size.height / unitsTall,
      );
      const texts = [...drawing.querySelectorAll("text")];

      expect(texts.length).toBeGreaterThan(mockBirds.length);
      for (const text of texts) {
        const full = Number(
          /text-\[([\d.]+)px\]/.exec(text.getAttribute("class") ?? "")?.[1] ??
            text.getAttribute("font-size"),
        );
        expect(full).toBeGreaterThan(0);
        // The height rounds to whole units: at most half a unit in 600 over the floor's due.
        expect(full * pixelsPerUnit).toBeGreaterThanOrEqual(
          full * minPixelsPerUnit * (1 - 1 / 1200),
        );
      }
      cleanup();
    }
  });

  it("opens a bubble on the beak of a bird in a narrowed scene", () => {
    const size = { width: 900, height: 900 };
    scene(size);
    const layout = layoutAviary(mockAviary, size);
    const placed = placedBirds(layout).find(
      (entry) => entry.bird.id === "undev/prism",
    ) as PlacedBird;
    // jsdom measures every element as 0 tall, the bubble included.
    const expected = placeBubble(
      toPixels(placed.beak, layout, size),
      placed.facing,
      size,
      0,
    );

    fireEvent.click(birdButton("undev/prism"));

    const holder = screen.getByRole("region", { name: "Prism says" })
      .parentElement as HTMLElement;
    expect(layout.width).toBeLessThan(sceneWidth);
    expect(holder.style.left).toBe(`${expected.left}px`);
    expect(holder.style.top).toBe(`${expected.top}px`);
    expect(holder.style.width).toBe(`${expected.width}px`);
  });

  it("staggers the arrival, the worst first", () => {
    const { container } = show();
    const arrival = (id: string) =>
      Number(
        container
          .querySelector(`[aria-label^="${mockBird(id).name},"]`)
          ?.getAttribute("data-arrival"),
      );

    expect(arrival("undev/prism")).toBeLessThan(arrival("undev/spool"));
    expect(arrival("undev/spool")).toBeLessThan(arrival("dev/odin/hello"));
  });

  describe("its motion", () => {
    const idleClasses = [
      "motion-safe:animate-bird-bob",
      "motion-safe:animate-tail-flick",
    ];

    function idleCount(container: HTMLElement): number {
      return idleClasses.reduce(
        (count, name) => count + container.getElementsByClassName(name).length,
        0,
      );
    }

    /** jsdom has no `animationend` style property, so React listens for the webkit-prefixed name. */
    function endAnimation(element: Element, animationName: string) {
      const event = new Event("webkitAnimationEnd", { bubbles: true });
      Object.defineProperty(event, "animationName", { value: animationName });
      act(() => {
        element.dispatchEvent(event);
      });
    }

    function arriveGroup(id: string): Element {
      const group = birdButton(id).querySelector(
        '[class~="motion-safe:animate-arrive"]',
      );
      if (group === null) throw new Error(`${id} is not arriving`);
      return group;
    }

    it("runs no idle animation on a bird while it arrives", () => {
      const { container } = show();

      expect(arriveGroup("undev/prism")).not.toBeNull();
      expect(idleCount(container)).toBe(0);
    });

    it("sets a bird idling once its arrive animation ends, and the others keep arriving", () => {
      const { container } = show();

      endAnimation(arriveGroup("undev/prism"), "arrive");

      const arrived = birdButton("undev/prism");
      expect(
        arrived.getElementsByClassName("motion-safe:animate-arrive"),
      ).toHaveLength(0);
      expect(
        arrived.getElementsByClassName("motion-safe:animate-tail-flick"),
      ).toHaveLength(1);
      expect(idleCount(container)).toBe(
        arrived.getElementsByClassName("motion-safe:animate-tail-flick")
          .length +
          arrived.getElementsByClassName("motion-safe:animate-bird-bob").length,
      );
      expect(arriveGroup("undev/spool")).not.toBeNull();
    });

    it("ignores the beak wiggle ending, which bubbles up from inside the figure", () => {
      const { container } = show();
      const group = arriveGroup("undev/prism");

      endAnimation(group, "beak-wiggle");

      expect(arriveGroup("undev/prism")).toBe(group);
      expect(idleCount(container)).toBe(0);
    });
  });
});
