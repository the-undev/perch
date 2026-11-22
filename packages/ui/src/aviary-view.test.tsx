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
import { AviaryScene, AviaryView, tipLine } from "./aviary-view.tsx";
import type { PixelSize } from "./hooks.ts";
import { mockBird, mockBirds, quietSnooze, snoozing } from "./mock-birds.ts";
import { minPixelsPerUnit, sceneWidth } from "./scene.tsx";

afterEach(cleanup);

const morning = new Date(mockSnapshot.scannedAt);
/** Three in the morning, in the sleep hours. */
const smallHours = new Date(2026, 9, 23, 3, 0);

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
      snooze={quietSnooze}
      flyingIds={new Set()}
    />,
  );
}

function show(now = morning, aviary = mockAviary, pickedAt = () => now) {
  const onLaunch = vi.fn();
  const onFullStory = vi.fn();
  const onAdopt = vi.fn();
  const onChip = vi.fn();
  const onSnooze = vi.fn();
  const onWake = vi.fn();
  const { container } = render(
    <AviaryView
      aviary={aviary}
      now={now}
      onLaunch={onLaunch}
      onFullStory={onFullStory}
      onAdopt={onAdopt}
      onChip={onChip}
      snooze={{ onSnooze, onWake, pickedAt }}
    />,
  );
  return {
    container,
    onLaunch,
    onFullStory,
    onAdopt,
    onChip,
    onSnooze,
    onWake,
  };
}

/** A bird's button, named by the bird's name and its state word. */
function birdButton(id: string): HTMLElement {
  const bird = mockBird(id);
  return screen.getByRole("button", {
    name: (name) => name.startsWith(`${bird.name}, `),
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
    expect(container.textContent).toContain("On the fence");
    expect(
      container.querySelector('[data-part="fence-count"]')?.textContent,
    ).toBe("3 not adopted");
    expect(container.querySelector('[class*="tracking-"]')).toBeNull();
  });

  it("paints each wire's name and the fence's behind every wire and bird, cut round its own landed birds", () => {
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
        snooze={quietSnooze}
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

    const groups = [
      ...mockAviary.wires,
      { name: "On the fence", birds: mockAviary.fence.birds },
    ];

    expect(
      painted.map((name) => name.querySelector("text")?.textContent),
    ).toEqual(groups.map((group) => group.name));
    for (const [i, name] of painted.entries()) {
      const group = groups[i];
      expect(precedes(name, firstLine)).toBe(true);
      expect(precedes(name, firstBird)).toBe(true);
      expect(cutsOf(name)).toEqual(
        (group?.birds ?? [])
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

  it("hands back a fence bird's adopt action, closing its bubble, and gives an adopted bird none", () => {
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

  it("wakes any bird with closed eyes when clicked, and no bird with open eyes", () => {
    const spoken = (id: string, now: Date) => {
      show(now);
      fireEvent.click(birdButton(id));
      const bird = mockBird(id);
      const words = screen
        .getByRole("region", { name: `${bird.name} says` })
        .querySelector('[data-part="speech"]')?.textContent;
      cleanup();
      return words?.startsWith("Mm? You woke me. ") ?? false;
    };
    const asleep = ["undev/spool", "undev/skiff", "dev/odin/hello"];
    const awake = ["undev/prism", "dev/perch", "obsidian/Hothouse"];

    expect(asleep.map((id) => spoken(id, smallHours))).toEqual([
      true,
      true,
      true,
    ]);
    expect(awake.map((id) => spoken(id, smallHours))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it.each([
    ["2026-10-23", "until Friday"],
    ["2026-12-04", "until 4 December"],
    [null, "until you wake it"],
  ])(
    "says a bird snoozed to %s is snoozed %s, wakes it with the prefix and keeps its true chips",
    (until, words) => {
      show(morning, snoozing(["undev/skiff"], until));
      const skiff = mockBird("undev/skiff");

      fireEvent.click(birdButton("undev/skiff"));

      const bubble = screen.getByRole("region", { name: "Skiff says" });
      const part = (name: string) =>
        bubble.querySelector(`[data-part="${name}"]`)?.textContent;
      expect([part("state-word"), part("snoozed-until")]).toEqual([
        "snoozed",
        words,
      ]);
      expect(part("speech")).toBe(`Mm? You woke me. ${skiff.bubble.speech}`);
      expect(
        skiff.bubble.chips.every(
          (chip) =>
            within(bubble).getByRole("button", { name: chip.label }) !== null,
        ),
      ).toBe(true);
      expect(birdButton("undev/skiff").getAttribute("aria-label")).toBe(
        "Skiff, snoozed",
      );
    },
  );

  it("speaks a run-out snooze's bird in its real mood, with no end and no prefix", () => {
    show(morning, snoozing(["undev/skiff"], "2026-10-22"));

    fireEvent.click(birdButton("undev/skiff"));

    const bubble = screen.getByRole("region", { name: "Skiff says" });
    expect(bubble.querySelector('[data-part="state-word"]')?.textContent).toBe(
      "restless",
    );
    expect(bubble.querySelector('[data-part="snoozed-until"]')).toBeNull();
    expect(
      bubble.querySelector('[data-part="speech"]')?.textContent,
    ).not.toContain("You woke me");
  });

  describe("its snooze and wake actions", () => {
    /** The snooze and wake actions a bird's bubble offers, by name. */
    function snoozeActions(id: string): string[] {
      fireEvent.click(birdButton(id));
      const bubble = screen.getByRole("region", {
        name: `${mockBird(id).name} says`,
      });
      return ["Snooze", "Wake"].filter(
        (name) => within(bubble).queryByRole("button", { name }) !== null,
      );
    }

    it("offers the snooze action on an adopted bird whatever its mood, and a fence bird neither action", () => {
      show();

      expect(
        ["dev/perch", "undev/skiff", "undev/prism", "dev/odin/hello"].map(
          snoozeActions,
        ),
      ).toEqual([["Snooze"], ["Snooze"], ["Snooze"], []]);
    });

    it("opens the durations from the snooze action, shortest first and indefinitely last", () => {
      show();

      fireEvent.click(birdButton("undev/skiff"));
      fireEvent.click(screen.getByRole("button", { name: "Snooze" }));

      expect(screen.getByRole("button", { name: "Snooze" }).ariaExpanded).toBe(
        "true",
      );
      expect(
        within(screen.getByRole("menu", { name: "Snooze Skiff for" }))
          .getAllByRole("menuitem")
          .map((item) => item.textContent),
      ).toEqual([
        "1 day",
        "3 days",
        "1 week",
        "2 weeks",
        "1 month",
        "Indefinitely",
      ]);
    });

    it.each([
      ["1 day", "2026-10-23"],
      ["3 days", "2026-10-25"],
      ["1 week", "2026-10-29"],
      ["2 weeks", "2026-11-05"],
      ["1 month", "2026-11-22"],
      ["Indefinitely", null],
    ])(
      "snoozes a bird picked for %s until %s, closing the durations and the bubble",
      (duration, until) => {
        const { onSnooze } = show();

        fireEvent.click(birdButton("undev/skiff"));
        fireEvent.click(screen.getByRole("button", { name: "Snooze" }));
        fireEvent.click(screen.getByRole("menuitem", { name: duration }));

        expect(onSnooze).toHaveBeenCalledWith("undev/skiff", until);
        expect(screen.queryByRole("menu")).toBeNull();
        expect(screen.queryByRole("region", { name: "Skiff says" })).toBeNull();
      },
    );

    it("counts a duration from the moment of the pick, not the window's clock a minute behind midnight", () => {
      const lastMinute = new Date(2026, 9, 22, 23, 59);
      const afterMidnight = new Date(2026, 9, 23, 0, 0);
      const { onSnooze } = show(lastMinute, mockAviary, () => afterMidnight);

      fireEvent.click(birdButton("undev/skiff"));
      fireEvent.click(screen.getByRole("button", { name: "Snooze" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "1 day" }));

      expect(onSnooze).toHaveBeenCalledWith("undev/skiff", "2026-10-24");
    });

    it("offers a snoozed bird the wake action in place of the snooze action, which wakes it", () => {
      const { onWake } = show(morning, snoozing(["undev/skiff"], null));

      expect(snoozeActions("undev/skiff")).toEqual(["Wake"]);
      fireEvent.click(screen.getByRole("button", { name: "Wake" }));

      expect(onWake).toHaveBeenCalledWith("undev/skiff");
      expect(screen.queryByRole("region", { name: "Skiff says" })).toBeNull();
    });

    it("leaves the bubble open while the durations open and fold with Escape", () => {
      show();

      fireEvent.click(birdButton("undev/skiff"));
      fireEvent.click(screen.getByRole("button", { name: "Snooze" }));
      expect(screen.getByRole("region", { name: "Skiff says" })).toBeTruthy();
      fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });

      expect(screen.queryByRole("menu")).toBeNull();
      expect(screen.getByRole("region", { name: "Skiff says" })).toBeTruthy();
    });

    it("moves focus through the durations with the arrow keys, Home and End, and Escape returns it to the button", () => {
      show();

      fireEvent.click(birdButton("undev/skiff"));
      const button = screen.getByRole("button", { name: "Snooze" });
      fireEvent.click(button);
      const items = screen.getAllByRole("menuitem");
      const menu = screen.getByRole("menu");
      expect(document.activeElement).toBe(items[0]);

      fireEvent.keyDown(menu, { key: "ArrowDown" });
      expect(document.activeElement).toBe(items[1]);
      fireEvent.keyDown(menu, { key: "ArrowUp" });
      fireEvent.keyDown(menu, { key: "ArrowUp" });
      expect(document.activeElement).toBe(items[5]);
      fireEvent.keyDown(menu, { key: "ArrowDown" });
      expect(document.activeElement).toBe(items[0]);
      fireEvent.keyDown(menu, { key: "End" });
      expect(document.activeElement).toBe(items[5]);
      fireEvent.keyDown(menu, { key: "Home" });
      expect(document.activeElement).toBe(items[0]);

      fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
      expect(screen.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(button);
    });

    it("offers the snooze action again once a bird's snooze has run out", () => {
      show(morning, snoozing(["undev/skiff"], "2026-10-22"));

      expect(snoozeActions("undev/skiff")).toEqual(["Snooze"]);
    });
  });

  it("shows a hovered bird's tip with the numbers it carries", () => {
    show();

    fireEvent.pointerMove(birdButton("undev/prism"));

    expect(screen.getByRole("tooltip").textContent).toBe(
      "Prism · distressedci failure · 4 uncommitted · 2 open PRs · 78 open items",
    );
  });

  it("tells in a fence bird's tip where it lives, then its last commit when it has one", () => {
    expect(tipLine(mockBird("dev/odin/hello"), morning)).toBe(
      "one disk only · last commit twelve months ago",
    );
    expect(tipLine(mockBird("github:finch/obsidian-tidy"), morning)).toBe(
      "only on github",
    );
    expect(tipLine(mockBird("dev/hearth-config"), morning)).toBe(
      "last commit ten days ago",
    );
    expect(tipLine(mockBird("undev/prism"), morning)).toBe(
      "ci failure · 4 uncommitted · 2 open PRs · 78 open items",
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

  describe("its wire tallies", () => {
    /** Each wire's tally lines, top wire first. */
    function tallies(container: HTMLElement): string[][] {
      return [...container.querySelectorAll('[data-part="tally"]')].map(
        (tally) =>
          [...tally.querySelectorAll("text")].map((line) => line.textContent),
      ) as string[][];
    }

    it("counts a snoozed bird as snoozed, out of attention, drifting and settled", () => {
      const { container } = show(
        morning,
        snoozing(["undev/gramophone", "undev/skiff", ".dotfiles"], null),
      );

      expect(tallies(container)).toEqual([
        ["1 drifting", "1 snoozed"],
        ["2 attention", "2 snoozed"],
      ]);
    });

    it("never says all settled while a bird on the wire is snoozed", () => {
      const { container } = show(
        morning,
        snoozing([".dotfiles", "obsidian/Hothouse"], null),
      );

      expect(tallies(container)[0]).toEqual(["2 snoozed"]);
    });

    it("counts a run-out snooze's bird by its mood again", () => {
      const { container } = show(
        morning,
        snoozing(["undev/gramophone", "undev/skiff"], "2026-10-22"),
      );

      expect(tallies(container)[1]).toEqual(["3 attention", "1 drifting"]);
    });

    it("counts a restless bird asleep at night as drifting", () => {
      const { container } = show(smallHours);

      expect(tallies(container)[0]).toEqual(["2 drifting"]);
    });
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

  it("lands snoozed birds after every awake bird on a wire, and before the fence", () => {
    const snoozed = ["undev/prism", "undev/Hollow-legacy"];
    const { container } = show(morning, snoozing(snoozed, null));
    const arrivals = (birds: typeof mockBirds) =>
      birds.map((bird) =>
        Number(
          container
            .querySelector(`[aria-label^="${bird.name},"]`)
            ?.getAttribute("data-arrival"),
        ),
      );
    const onWires = mockBirds.filter((bird) => bird.adopted);
    const awake = arrivals(onWires.filter((b) => !snoozed.includes(b.id)));
    const asleep = arrivals(onWires.filter((b) => snoozed.includes(b.id)));
    const fence = arrivals(mockBirds.filter((bird) => !bird.adopted));

    expect(Math.min(...asleep)).toBeGreaterThan(Math.max(...awake));
    expect(Math.max(...asleep)).toBeLessThan(Math.min(...fence));
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
