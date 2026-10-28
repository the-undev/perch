import { mockAviary, mockSnapshot } from "@perch/core/mock.ts";
import type { Bird } from "@perch/core/viewmodel.ts";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BirdTab,
  type CameraPlace,
  CameraView,
  cameraTabs,
  stripHeight,
  stripLayout,
  stripWireY,
} from "./camera.tsx";
import { mockBird } from "./mock-birds.ts";
import { edgeMargin } from "./wire.tsx";

afterEach(cleanup);

// The setup's animations never finish. The handover tests need to land a flyer on cue, so
// they swap in an animate that records each flyer's landing for the test to signal.
const stillAnimate = Element.prototype.animate;
const landings = new Map<string, () => void>();
/** Each flyer's keyframes, by bird id: the last is where it lands. */
const flightPaths = new Map<string, Keyframe[]>();

beforeEach(() => {
  landings.clear();
  flightPaths.clear();
  Element.prototype.animate = function animate(
    this: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
  ) {
    const flyerId = this.getAttribute("data-flyer");
    if (flyerId !== null && Array.isArray(keyframes)) {
      flightPaths.set(flyerId, keyframes);
    }
    const finished = new Promise<void>((resolve) => {
      if (flyerId !== null) landings.set(flyerId, resolve);
    });
    return { finished, cancel: () => {} } as unknown as Animation;
  };
});

afterEach(() => {
  Element.prototype.animate = stillAnimate;
});

async function land(birdId: string) {
  await act(async () => {
    landings.get(birdId)?.();
  });
}

/** Whether the aviary scene draws the named bird: false while it is hidden for its flyer. */
function sceneDraws(container: HTMLElement, name: string): boolean {
  const bird = container.querySelector(
    `[data-part="aviary"] [role="button"][aria-label^="${name}, "]`,
  ) as HTMLElement;
  return bird.style.visibility !== "hidden";
}

/** Whether the strip draws the bird with this id. */
function stripDraws(container: HTMLElement, birdId: string): boolean {
  const bird = container.querySelector(`[data-strip-bird="${birdId}"]`);
  return bird?.getAttribute("visibility") !== "hidden";
}

/** Each strip bird's x in the strip's units, left to right as drawn. */
function stripXs(container: HTMLElement): number[] {
  return [...container.querySelectorAll("[data-strip-bird]")].map((bird) =>
    Number(
      /translate\(([-\d.e]+)/.exec(bird.getAttribute("transform") ?? "")?.[1],
    ),
  );
}

const now = new Date(mockSnapshot.scannedAt);
const aviaryPlace: CameraPlace = { at: "aviary" };
const detailOf = (birdId: string): CameraPlace => ({
  at: "detail",
  birdId,
  papers: false,
  chip: null,
});

function camera(
  place: CameraPlace,
  scanning = false,
  clock = now,
  aviary = mockAviary,
) {
  const onNavigate = vi.fn();
  const onRescan = vi.fn();
  const onSettings = vi.fn();
  const view = (at: CameraPlace) => (
    <CameraView
      aviary={aviary}
      now={clock}
      place={at}
      onNavigate={onNavigate}
      onLaunch={() => {}}
      sheets={[]}
      scanning={scanning}
      onRescan={onRescan}
      onSettings={onSettings}
      entry={{ form: null, onSave: () => {}, onRemove: () => {} }}
      problems={[]}
    />
  );
  const { container, rerender } = render(view(place));
  return {
    container,
    onNavigate,
    onRescan,
    onSettings,
    moveTo: (at: CameraPlace) => rerender(view(at)),
  };
}

function tab(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

/** The leftmost bird on a wire: it needs attention first. */
function leftmost(wireName: string): string {
  const wire = mockAviary.wires.find(
    (candidate) => candidate.name === wireName,
  );
  const bird = wire?.birds.find((candidate) => candidate.position === 0);
  if (bird === undefined) throw new Error(`no birds on ${wireName}`);
  return bird.id;
}

describe("the camera", () => {
  it("puts the tabs in the scene's own order, The Aviary current at home", () => {
    camera(aviaryPlace);
    const tabs = screen
      .getByRole("navigation", { name: "The camera" })
      .querySelectorAll("button");

    expect([...tabs].map((button) => button.textContent)).toEqual([
      "The Aviary",
      "Machine & Home",
      "Projects",
      "On the fence",
    ]);
    expect(tab("The Aviary").getAttribute("aria-current")).toBe("page");
  });

  it("opens a wire's most urgent bird from its tab", () => {
    const { onNavigate } = camera(aviaryPlace);

    fireEvent.click(tab("Projects"));
    fireEvent.click(tab("On the fence"));

    expect(onNavigate).toHaveBeenNthCalledWith(
      1,
      detailOf(leftmost("Projects")),
    );
    expect(onNavigate).toHaveBeenNthCalledWith(
      2,
      detailOf(mockAviary.fence.birds[0]?.id ?? ""),
    );
  });

  it("shows an empty wire's tab, quietly saying so, and goes nowhere from it", () => {
    const withEmpty = {
      ...mockAviary,
      wires: [...mockAviary.wires, { name: "Servers", birds: [] }],
    };
    const { container, onNavigate } = camera(
      aviaryPlace,
      false,
      now,
      withEmpty,
    );
    const empty = container.querySelector("[data-empty-tab]");
    if (empty === null) throw new Error("no empty tab drawn");

    expect(empty.textContent).toBe("Servers empty");
    expect(screen.queryByRole("button", { name: /Servers/ })).toBeNull();
    fireEvent.click(empty);

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("rides down to a bird's detail from its bubble", () => {
    const { onNavigate } = camera(aviaryPlace);
    const skiff = mockBird("undev/skiff");

    fireEvent.click(
      screen.getByRole("button", {
        name: `Skiff, ${skiff.bubble.stateWord}`,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tell me the full story" }),
    );

    expect(onNavigate).toHaveBeenCalledWith(detailOf("undev/skiff"));
  });

  it("rides to a bird's page from a chip in its bubble, carrying the chip", () => {
    const { onNavigate } = camera(aviaryPlace);

    fireEvent.click(
      screen.getByRole("button", { name: /^Prism, distressed/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "ci failure" }));

    expect(onNavigate).toHaveBeenCalledWith({
      at: "detail",
      birdId: "undev/prism",
      papers: false,
      chip: "ci",
    });
  });

  it("shows the open bird's detail beneath its wire's strip, its tab current", () => {
    const { container } = camera(detailOf("undev/skiff"));

    expect(
      screen.getByRole("article", { name: "Skiff in full" }),
    ).toBeDefined();
    expect(tab("Projects").getAttribute("aria-current")).toBe("page");
    expect(
      [...container.querySelectorAll("[data-strip-bird]")].map((bird) =>
        bird.getAttribute("data-strip-bird"),
      ),
    ).toEqual(
      mockAviary.wires[1]?.birds
        .toSorted((a, b) => a.position - b.position)
        .map((bird) => bird.id),
    );
  });

  it("holds the bird page's ground still while the record and paper panes scroll, instantly, beneath the fixed band", () => {
    const { container } = camera(detailOf("dev/perch"));
    const part = (name: string) => {
      const element = container.querySelector(`[data-part="${name}"]`);
      if (element === null) throw new Error(`the page has no ${name}`);
      return element;
    };
    const classes = (element: Element) => element.className.split(" ");
    const ground = part("ground");
    const band = part("band");
    const panes = [part("record"), part("paper")];

    expect(classes(ground)).toContain("overflow-hidden");
    expect(classes(ground)).not.toContain("overflow-y-auto");
    expect(ground.contains(band)).toBe(true);
    for (const pane of panes) {
      expect(classes(pane)).toEqual(
        expect.arrayContaining([
          "@min-[960px]:overflow-y-auto",
          "pane-scroll",
          "min-h-0",
        ]),
      );
      expect(pane.className).not.toContain("scroll-smooth");
      expect(pane.contains(band)).toBe(false);
      expect(band.contains(pane)).toBe(false);
      for (
        let link = pane.parentElement;
        link !== ground && link !== null;
        link = link.parentElement
      ) {
        expect(classes(link)).toContain("min-h-0");
      }
    }
  });

  it("holds its label on the wire with the birds in the remaining width at the new height", () => {
    const { container } = camera(detailOf("undev/skiff"));
    const strip = container.querySelector('[data-part="strip"]') as HTMLElement;
    const sky = container.querySelector('[data-part="sky"]') as HTMLElement;
    const drawing = strip.querySelector("svg");
    const name = strip.querySelector('[data-part="strip-name"]');
    const tally = strip.querySelector('[data-part="strip-tally"]');
    const projects = cameraTabs(mockAviary)[2] as BirdTab;
    const layout = stripLayout(projects);
    const xs = stripXs(container);

    expect(stripHeight).toBe(124);
    expect(drawing?.getAttribute("viewBox")).toBe(`0 0 2000 ${stripHeight}`);
    expect(strip.style.height).toBe(`${stripHeight}px`);
    expect(sky.style.height).toBe(`${stripHeight}px`);
    expect(strip.querySelector("path")?.getAttribute("d")).toMatch(
      new RegExp(`^M -20 ${stripWireY} `),
    );
    // The name's baseline rests just above the wire at its left end; the tally sits beneath it.
    expect(name?.textContent).toBe("Projects");
    expect(name?.getAttribute("x")).toBe("36");
    expect(Number(name?.getAttribute("y"))).toBeLessThan(stripWireY);
    expect(Number(name?.getAttribute("y"))).toBeGreaterThanOrEqual(
      stripWireY - 10,
    );
    expect(tally?.getAttribute("x")).toBe("36");
    expect(Number(tally?.getAttribute("y"))).toBeGreaterThan(stripWireY);
    expect(tally?.textContent).toMatch(/^3 attention/);
    expect(tally?.querySelector("tspan")?.getAttribute("dx")).toBe("0");
    // The birds keep their size and centre in the room right of the label.
    expect(layout.labelRight).toBeGreaterThan(36);
    expect(xs).toEqual(layout.places.map((place) => place.x));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(
      layout.labelRight + edgeMargin,
    );
    expect(Math.max(...xs)).toBeLessThanOrEqual(2000 - edgeMargin);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(layout.middle);
    expect(
      container
        .querySelector('[data-strip-bird] [data-part="figure"]')
        ?.parentElement?.getAttribute("transform"),
    ).toMatch(/^scale\(-?1 1\)$/);
  });

  it("brightens the open bird in the strip and dims the rest", () => {
    const { container } = camera(detailOf("undev/skiff"));
    const birds = [...container.querySelectorAll("[data-strip-bird]")];
    const open = birds.filter((bird) =>
      bird.getAttribute("class")?.split(" ").includes("opacity-55"),
    );

    expect(
      container
        .querySelector('[data-strip-bird="undev/skiff"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
    expect(open).toHaveLength(birds.length - 1);
    expect(
      open.map((bird) => bird.getAttribute("data-strip-bird")),
    ).not.toContain("undev/skiff");
  });

  it("alternates the names of a crowded fence's strip between two baselines, yielding to the label", () => {
    const birds = Array.from({ length: 21 }, (_, position) => ({
      ...(mockAviary.fence.birds[position % 3] as Bird),
      id: `fence-${position}`,
      position,
    }));
    const crowded = { ...mockAviary, fence: { birds } };
    const { container } = camera(detailOf("fence-0"), false, now, crowded);
    const names = [...container.querySelectorAll("[data-strip-bird] > text")];
    const layout = stripLayout(cameraTabs(crowded).at(-1) as BirdTab);
    const xs = stripXs(container);

    expect(names).toHaveLength(21);
    expect(names[0]?.getAttribute("y")).not.toBe(names[1]?.getAttribute("y"));
    expect(names[0]?.getAttribute("y")).toBe(names[2]?.getAttribute("y"));
    expect(names[0]?.getAttribute("data-name-size")).toBe("small");
    expect(
      container.querySelector('[data-part="strip-tally"]')?.textContent,
    ).toBe("21 not adopted");
    expect(layout.spacing).toBeLessThan(175);
    expect(Math.min(...xs)).toBeCloseTo(layout.labelRight + edgeMargin);
    expect(Math.max(...xs)).toBeCloseTo(2000 - edgeMargin);
  });

  it("sits the bird on its page's perch while its wire-mates stand in the strip", () => {
    const { container } = camera(detailOf("undev/skiff"));
    const poses = (selector: string) =>
      [...container.querySelectorAll(`${selector} [data-part="figure"]`)].map(
        (figure) => figure.getAttribute("data-pose"),
      );

    expect(poses('[data-part="roost"]')).toEqual(["sitting"]);
    expect(poses("[data-strip-bird]")).toEqual(
      mockAviary.wires[1]?.birds.map(() => "standing"),
    );
  });

  it("presses and keys the strip's birds as tabs", () => {
    const { onNavigate } = camera(detailOf("undev/skiff"));
    const spool = screen.getByRole("button", { name: "Open Spool" });

    fireEvent.keyDown(spool, { key: "Enter" });
    fireEvent.keyDown(spool, { key: " " });
    fireEvent.keyDown(spool, { key: "a" });

    expect(spool.getAttribute("tabindex")).toBe("0");
    expect(onNavigate.mock.calls).toEqual([
      [detailOf("undev/spool")],
      [detailOf("undev/spool")],
    ]);
  });

  it("switches to a wire-mate from the strip", () => {
    const { onNavigate } = camera(detailOf("undev/skiff"));

    fireEvent.click(screen.getByRole("button", { name: "Open Spool" }));

    expect(onNavigate).toHaveBeenCalledWith(detailOf("undev/spool"));
  });

  it("rides home on Escape, the brand and The Aviary", () => {
    const { onNavigate } = camera(detailOf("undev/skiff"));

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "perch" }));
    fireEvent.click(tab("The Aviary"));

    expect(onNavigate.mock.calls).toEqual([
      [aviaryPlace],
      [aviaryPlace],
      [aviaryPlace],
    ]);
  });

  it("does not ride home on Escape when already home", () => {
    const { onNavigate } = camera(aviaryPlace);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("remembers the bird last open on each wire", () => {
    const { onNavigate, moveTo } = camera(detailOf("undev/spool"));

    moveTo(detailOf(".dotfiles"));
    moveTo(aviaryPlace);
    fireEvent.click(tab("Projects"));
    fireEvent.click(tab("Machine & Home"));

    expect(onNavigate.mock.calls).toEqual([
      [detailOf("undev/spool")],
      [detailOf(".dotfiles")],
    ]);
  });

  it("flies the wire-mates up into the strip when the camera pulls back", () => {
    const { container, moveTo } = camera(aviaryPlace);

    moveTo(detailOf("obsidian/Hothouse"));

    expect(
      [...container.querySelectorAll("[data-flyer]")]
        .map((flyer) => flyer.getAttribute("data-flyer"))
        .sort(),
    ).toEqual(mockAviary.wires[0]?.birds.map((bird) => bird.id).sort());
  });

  it("lands each wire-mate's flight where the strip draws it", () => {
    const { container, moveTo } = camera(aviaryPlace);
    const tab = cameraTabs(mockAviary)[1] as BirdTab;
    // jsdom measures nothing, so the camera keeps its assumed 1400px window: the strip at 0.7.
    const k = 1400 / 2000;

    moveTo(detailOf("obsidian/Hothouse"));

    expect(flightPaths.size).toBe(tab.birds.length);
    for (const { bird, x } of stripLayout(tab).places) {
      const landing = flightPaths.get(bird.id)?.at(-1)?.transform;
      const y = (stripHeight - stripHeight * k) / 2 + (stripWireY - 3) * k;
      expect(landing).toBe(
        `translate(${x * k - 50}px, ${y - 62}px) scale(${k})`,
      );
      expect(stripXs(container)).toContain(x);
    }
  });

  it("hides each wire-mate at both ends while its flyer is in the air", () => {
    const { container, moveTo } = camera(aviaryPlace);
    const wire = mockAviary.wires[0]?.birds ?? [];
    const outsider = mockAviary.fence.birds[0] as Bird;

    moveTo(detailOf("obsidian/Hothouse"));

    for (const mate of wire) {
      expect(sceneDraws(container, mate.name)).toBe(false);
      expect(stripDraws(container, mate.id)).toBe(false);
    }
    expect(sceneDraws(container, outsider.name)).toBe(true);
  });

  it("shows a bird at its perch once its own flyer lands, and no other", async () => {
    const { container, moveTo } = camera(aviaryPlace);
    const wire = mockAviary.wires[0]?.birds ?? [];
    const [landing, ...flying] = wire as [Bird, ...Bird[]];
    moveTo(detailOf("obsidian/Hothouse"));

    await land(landing.id);

    expect(container.querySelector(`[data-flyer="${landing.id}"]`)).toBeNull();
    expect(stripDraws(container, landing.id)).toBe(true);
    expect(sceneDraws(container, landing.name)).toBe(true);
    for (const mate of flying) {
      expect(stripDraws(container, mate.id)).toBe(false);
      expect(sceneDraws(container, mate.name)).toBe(false);
    }
  });

  it("hides the wire-mates on the way home too, until each lands in the aviary", async () => {
    const { container, moveTo } = camera(detailOf("obsidian/Hothouse"));
    const wire = mockAviary.wires[0]?.birds ?? [];
    const [landing, ...flying] = wire as [Bird, ...Bird[]];

    moveTo(aviaryPlace);

    expect(sceneDraws(container, landing.name)).toBe(false);
    expect(stripDraws(container, landing.id)).toBe(false);
    await land(landing.id);
    expect(sceneDraws(container, landing.name)).toBe(true);
    for (const mate of flying) {
      expect(sceneDraws(container, mate.name)).toBe(false);
    }
  });

  it("stays home when asked for a bird the aviary no longer holds", () => {
    camera(detailOf("dev/gone"));

    expect(tab("The Aviary").getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("says how old the scan is, and scans again when its line is pressed", () => {
    const later = new Date(Date.parse(mockSnapshot.scannedAt) + 30 * 3_600_000);
    const { onRescan } = camera(aviaryPlace, false, later);

    const line = screen.getByTitle("Scan now");
    expect(line.textContent).toMatch(/, scanned \d\d:\d\d, 30 hours ago$/);
    fireEvent.click(line);

    expect(onRescan).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says just now for a scan seconds old and minutes for one a few minutes old", () => {
    const scannedAt = Date.parse(mockSnapshot.scannedAt);
    camera(aviaryPlace, false, new Date(scannedAt + 20_000));
    expect(screen.getByTitle("Scan now").textContent).toMatch(
      /, scanned \d\d:\d\d, just now$/,
    );
    cleanup();

    camera(aviaryPlace, false, new Date(scannedAt + 4 * 60_000));
    expect(screen.getByTitle("Scan now").textContent).toMatch(
      /, scanned \d\d:\d\d, 4 min ago$/,
    );
  });

  it("says in the header how many sources it couldn't read, naming each on hover", () => {
    camera(aviaryPlace, false, now);

    const failing = screen.getByText("couldn't read 1 source");
    expect(failing.getAttribute("title")).toBe(
      "Couldn't read Forgejo accounts, last read under an hour ago",
    );
  });

  it("leaves for the settings from the header's last word", () => {
    const { onSettings, onNavigate } = camera(detailOf("dev/perch"));

    fireEvent.click(screen.getByRole("button", { name: "settings" }));

    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("says quietly while a scan runs, and waits for it", () => {
    const { onRescan } = camera(aviaryPlace, true);

    expect(screen.getByRole("status").textContent).toBe("scanning");
    fireEvent.click(screen.getByTitle("Scan now"));

    expect(onRescan).not.toHaveBeenCalled();
  });
});
