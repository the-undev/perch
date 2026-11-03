import { mockAviary, mockSnapshot } from "@perch/core/mock.ts";
import type { Bird } from "@perch/core/viewmodel.ts";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  layoutAviary,
  type PlacedBird,
  pixelsPerUnit,
  placedBirds,
  toPixels,
} from "./aviary-layout.ts";
import {
  type BirdTab,
  type CameraPlace,
  CameraView,
  cameraTabs,
  panDirection,
  stripHeight,
  stripLayout,
  stripWireY,
} from "./camera.tsx";
import { mockBird } from "./mock-birds.ts";
import { minPixelsPerUnit, sceneWidth, sceneWidthFor } from "./scene.tsx";
import {
  columnEdge,
  edgeMargin,
  labelX,
  paintedInk,
  paintedSize,
} from "./wire.tsx";

/** Whether `later` comes after `earlier` in the document, so it is drawn in front of it. */
function drawnAfter(earlier: Element, later: Element): boolean {
  return (
    (earlier.compareDocumentPosition(later) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
    0
  );
}

// jsdom measures nothing, so the camera keeps its assumed 1400px window, narrower than the floor's
// width: its strip is fewer units wide than the full 2000, drawn at the floor.
const assumedWidth = 1400;
const stripUnits = sceneWidthFor(assumedWidth);

afterEach(cleanup);

// The setup's animations never finish. The handover tests need to land a flyer or settle a pan
// on cue, so they swap in an animate that records each one's ending for the test to signal.
const stillAnimate = Element.prototype.animate;
const landings = new Map<string, () => void>();
/** Each flyer's keyframes, by bird id: the last is where it lands. */
const flightPaths = new Map<string, Keyframe[]>();
/** Each pan of the ground's track in the order started: its keyframes and its ending. */
const pans: { keyframes: Keyframe[]; settle: () => void }[] = [];
/** The elements scrolled into view, since jsdom does no scrolling. */
const scrolled: Element[] = [];

beforeEach(() => {
  landings.clear();
  flightPaths.clear();
  pans.length = 0;
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    scrolled.push(this);
  };
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
      if (
        this.getAttribute("data-part") === "pan-track" &&
        Array.isArray(keyframes)
      ) {
        pans.push({ keyframes, settle: resolve });
      }
    });
    return { finished, cancel: () => {} } as unknown as Animation;
  };
});

afterEach(() => {
  Element.prototype.animate = stillAnimate;
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
});

async function land(birdId: string) {
  await act(async () => {
    landings.get(birdId)?.();
  });
}

/** Ends the latest pan of the ground. */
async function settlePan() {
  await act(async () => {
    pans.at(-1)?.settle();
  });
}

/** The pages on the ground's track, left to right, by bird id. */
function groundPages(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll("[data-page]")].map((page) =>
    page.getAttribute("data-page"),
  );
}

/** The ground's page for a bird. */
function groundPage(container: HTMLElement, birdId: string): HTMLElement {
  const page = container.querySelector(`[data-page="${birdId}"]`);
  if (page === null) throw new Error(`the ground holds no page for ${birdId}`);
  return page as HTMLElement;
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
  const onLocalSources = vi.fn();
  const onCopy = vi.fn<(text: string) => Promise<void>>(async () => undefined);
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
      onLocalSources={onLocalSources}
      onCopy={onCopy}
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
    onLocalSources,
    onCopy,
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

  it("paints its name behind the wire and its birds, its tally in front, the birds right of the column at the new height", () => {
    const { container } = camera(detailOf("undev/skiff"));
    const strip = container.querySelector('[data-part="strip"]') as HTMLElement;
    const sky = container.querySelector('[data-part="sky"]') as HTMLElement;
    const drawing = strip.querySelector("svg");
    const line = strip.querySelector("svg > path");
    const painted = strip.querySelector('[data-part="painted-name"] text');
    const mask = strip.querySelector('[data-part="painted-name"] mask');
    const tally = strip.querySelector('[data-part="strip-tally"]');
    const birds = [...strip.querySelectorAll("[data-strip-bird]")];
    const projects = cameraTabs(mockAviary)[2] as BirdTab;
    const layout = stripLayout(projects, stripUnits);
    const xs = stripXs(container);
    if (line === null || painted === null || mask === null || tally === null) {
      throw new Error("no wire, painted name, mask or tally drawn");
    }

    expect(stripHeight).toBe(124);
    expect(drawing?.getAttribute("viewBox")).toBe(
      `0 0 ${stripUnits} ${stripHeight}`,
    );
    expect(strip.style.height).toBe(`${stripHeight}px`);
    expect(sky.style.height).toBe(`${stripHeight}px`);
    expect(line.getAttribute("d")).toMatch(new RegExp(`^M -20 ${stripWireY} `));
    // The name is painted just above the wire's left end, behind the line and every bird.
    expect(painted.textContent).toBe("Projects");
    expect(painted.getAttribute("x")).toBe(String(labelX));
    expect(painted.getAttribute("y")).toBe(String(stripWireY - 12));
    expect(painted.getAttribute("font-size")).toBe(String(paintedSize));
    expect(painted.getAttribute("opacity")).toBe(String(paintedInk));
    expect(painted.getAttribute("mask")).toBe(`url(#${mask.id})`);
    expect(drawnAfter(painted, line)).toBe(true);
    expect(birds.every((bird) => drawnAfter(painted, bird))).toBe(true);
    expect(
      [...mask.querySelectorAll("[data-cut]")].map((cut) =>
        cut.getAttribute("data-cut"),
      ),
    ).toEqual(birds.map((bird) => bird.getAttribute("data-strip-bird")));
    expect(strip.querySelector('[data-part="strip-name"]')).toBeNull();
    // The tally keeps its one line under the wire's left end, in front and in colour.
    expect(tally.getAttribute("x")).toBe("36");
    expect(tally.getAttribute("y")).toBe(String(stripWireY + 16));
    expect(tally.textContent).toBe("3 attention · 1 drifting");
    expect(
      [...tally.querySelectorAll("tspan")]
        .map((tspan) => tspan.getAttribute("class"))
        .filter((ink) => ink !== null),
    ).toEqual(["fill-red", "fill-amber"]);
    expect(birds.every((bird) => drawnAfter(bird, tally))).toBe(true);
    // The birds keep their size and centre in the room right of the column.
    expect(xs).toEqual(layout.places.map((place) => place.x));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(columnEdge);
    expect(Math.max(...xs)).toBeLessThanOrEqual(stripUnits - edgeMargin);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(layout.middle);
    expect(
      container
        .querySelector('[data-strip-bird] [data-part="figure"]')
        ?.parentElement?.getAttribute("transform"),
    ).toMatch(/^scale\(-?1 1\)$/);
  });

  it("starts every tab's birds at the column at any width, whatever its name or tally", () => {
    for (const width of [300, 500, 1000, stripUnits, sceneWidth]) {
      for (const tab of cameraTabs(mockAviary)) {
        if (tab.kind === "aviary") continue;
        const renamed = { ...tab, label: "A tab with a very long name indeed" };

        for (const place of stripLayout(tab, width).places) {
          expect(place.x).toBeGreaterThanOrEqual(columnEdge);
        }
        expect(stripLayout(renamed, width)).toEqual(stripLayout(tab, width));
      }
    }
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

  it("alternates the names of a crowded fence's strip between two baselines, its name painted and counted", () => {
    const birds = Array.from({ length: 21 }, (_, position) => ({
      ...(mockAviary.fence.birds[position % 3] as Bird),
      id: `fence-${position}`,
      position,
    }));
    const crowded = { ...mockAviary, fence: { birds } };
    const { container } = camera(detailOf("fence-0"), false, now, crowded);
    const names = [...container.querySelectorAll("[data-strip-bird] > text")];
    const layout = stripLayout(
      cameraTabs(crowded).at(-1) as BirdTab,
      stripUnits,
    );
    const xs = stripXs(container);

    expect(names).toHaveLength(21);
    expect(names[0]?.getAttribute("y")).not.toBe(names[1]?.getAttribute("y"));
    expect(names[0]?.getAttribute("y")).toBe(names[2]?.getAttribute("y"));
    expect(names[0]?.getAttribute("data-name-size")).toBe("small");
    expect(
      container.querySelector('[data-part="strip-tally"]')?.textContent,
    ).toBe("21 not adopted");
    const strip = container.querySelector('[data-part="strip"]') as HTMLElement;
    expect(
      strip.querySelector('[data-part="painted-name"] text')?.textContent,
    ).toBe("On the fence");
    expect(
      [...strip.querySelectorAll("[data-cut] > g")].every((cut) =>
        /scale\(-?0\.8 0\.8\)/.test(cut.getAttribute("transform") ?? ""),
      ),
    ).toBe(true);
    expect(strip.querySelectorAll("[data-cut]")).toHaveLength(21);
    expect(layout.spacing).toBeLessThan(175);
    expect(Math.min(...xs)).toBeCloseTo(columnEdge);
    expect(Math.max(...xs)).toBeCloseTo(stripUnits - edgeMargin);
  });

  it("holds the strip at the floor in a window narrower than the floor's width, its birds bunching right of the column", () => {
    const { container } = camera(detailOf("undev/skiff"));
    const drawing = container.querySelector('[data-part="strip"] svg');
    const unitsWide = Number(drawing?.getAttribute("viewBox")?.split(" ")[2]);
    const projects = cameraTabs(mockAviary)[2] as BirdTab;
    const full = stripLayout(projects, sceneWidth);
    const narrow = stripLayout(projects, unitsWide);
    const xs = narrow.places.map((place) => place.x);

    expect(unitsWide).toBeLessThan(sceneWidth);
    expect(Math.min(assumedWidth / unitsWide, 1)).toBeCloseTo(minPixelsPerUnit);
    expect(full.spacing).toBe(175);
    expect(narrow.spacing).toBeLessThan(full.spacing);
    expect(narrow.spacing).toBeCloseTo(
      (unitsWide - edgeMargin - columnEdge) / (projects.birds.length - 1),
    );
    expect(Math.min(...xs)).toBeCloseTo(columnEdge);
    expect(Math.max(...xs)).toBeCloseTo(unitsWide - edgeMargin);
  });

  it("draws the strip at full size in a wide window, shrinking with the window only down to the floor", () => {
    const projects = cameraTabs(mockAviary)[2] as BirdTab;
    const scale = (pixels: number) =>
      Math.min(pixels / sceneWidthFor(pixels), 1);

    expect(scale(3440)).toBe(1);
    expect(scale(2000)).toBe(1);
    expect(scale(1900)).toBeCloseTo(1900 / sceneWidth);
    expect(scale(1800)).toBeCloseTo(minPixelsPerUnit);
    expect(scale(1000)).toBeCloseTo(minPixelsPerUnit);
    expect(stripLayout(projects, sceneWidthFor(3440))).toEqual(
      stripLayout(projects, sceneWidth),
    );
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

  it("lifts each wire-mate's flight from its perch in the narrowed aviary and lands it where the strip draws it", () => {
    const { container, moveTo } = camera(aviaryPlace);
    const tab = cameraTabs(mockAviary)[1] as BirdTab;
    // The assumed 1400px window is narrower than the floor's width: the strip at the floor.
    const k = assumedWidth / stripUnits;
    const size = { width: assumedWidth, height: 800 };
    const layout = layoutAviary(mockAviary, size);

    moveTo(detailOf("obsidian/Hothouse"));

    expect(k).toBeCloseTo(minPixelsPerUnit);
    expect(layout.width).toBe(stripUnits);
    expect(flightPaths.size).toBe(tab.birds.length);
    for (const { bird, x } of stripLayout(tab, stripUnits).places) {
      const perch = placedBirds(layout).find(
        (entry) => entry.bird.id === bird.id,
      ) as PlacedBird;
      const lift = toPixels(
        { x: perch.x, y: perch.y - 3 * perch.scale },
        layout,
        size,
      );
      expect(flightPaths.get(bird.id)?.[0]?.transform).toBe(
        `translate(${lift.x - 50}px, ${lift.y - 62}px) scale(${perch.scale * pixelsPerUnit(layout, size)})`,
      );
      const landing = flightPaths.get(bird.id)?.at(-1)?.transform;
      const left = (assumedWidth - stripUnits * k) / 2;
      const y = (stripHeight - stripHeight * k) / 2 + (stripWireY - 3) * k;
      expect(landing).toBe(
        `translate(${left + x * k - 50}px, ${y - 62}px) scale(${k})`,
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

  it("hands a no-clone slip's Open Sources and Copy to the caller, the camera staying put", async () => {
    const { onLocalSources, onCopy, onSettings, onNavigate } = camera(
      detailOf("forgejo:finch/field-notes"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Sources" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    });

    expect(onLocalSources).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledWith(
      "ssh://git@forgejo:2222/finch/field-notes.git",
    );
    expect(onSettings).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("says quietly while a scan runs, and waits for it", () => {
    const { onRescan } = camera(aviaryPlace, true);

    expect(screen.getByRole("status").textContent).toBe("scanning");
    fireEvent.click(screen.getByTitle("Scan now"));

    expect(onRescan).not.toHaveBeenCalled();
  });
});

describe("the pan between birds", () => {
  it("pans the ground between two birds towards the chosen one and settles with one article", async () => {
    const { container, moveTo } = camera(detailOf("undev/skiff"));
    const strip = container.querySelector('[data-part="strip"] svg');
    const track = container.querySelector('[data-part="pan-track"]');

    moveTo(detailOf("undev/spool"));

    // Spool sits right of Skiff, so its page comes in from the right and the ground slides left.
    expect(track?.getAttribute("data-pan")).toBe("right");
    expect(pans.map((pan) => pan.keyframes)).toEqual([
      [{ transform: "translateX(0%)" }, { transform: "translateX(-100%)" }],
    ]);
    expect(groundPages(container)).toEqual(["undev/skiff", "undev/spool"]);
    expect(container.querySelectorAll("article")).toHaveLength(2);
    // The strip holds still, its brightness already on the chosen bird.
    expect(container.querySelector('[data-part="strip"] svg')).toBe(strip);
    expect(
      container
        .querySelector('[data-strip-bird="undev/spool"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
    expect(
      container
        .querySelector('[data-strip-bird="undev/skiff"]')
        ?.getAttribute("aria-current"),
    ).toBeNull();

    await settlePan();

    expect(groundPages(container)).toEqual(["undev/spool"]);
    expect(container.querySelectorAll("article")).toHaveLength(1);
    expect(
      screen.getAllByRole("article").map((article) => article.ariaLabel),
    ).toEqual(["Spool in full"]);
    expect(track?.hasAttribute("data-pan")).toBe(false);
    expect((track as HTMLElement).style.transform).toBe("");
  });

  it("pans the other way towards a bird earlier along the strip", async () => {
    const { container, moveTo } = camera(detailOf("undev/spool"));

    moveTo(detailOf("undev/prism"));

    expect(
      container
        .querySelector('[data-part="pan-track"]')
        ?.getAttribute("data-pan"),
    ).toBe("left");
    expect(pans.map((pan) => pan.keyframes)).toEqual([
      [{ transform: "translateX(-100%)" }, { transform: "translateX(0%)" }],
    ]);
    expect(groundPages(container)).toEqual(["undev/prism", "undev/spool"]);

    await settlePan();

    expect(groundPages(container)).toEqual(["undev/prism"]);
  });

  it("lays the strips end to end in the tabs' order, so a later wire or the fence lies to the right", () => {
    const tabs = cameraTabs(mockAviary);
    const fenceBird = mockAviary.fence.birds[0]?.id ?? "";

    expect(panDirection(tabs, ".dotfiles", "undev/gramophone")).toBe("right");
    expect(panDirection(tabs, "undev/spool", fenceBird)).toBe("right");
    expect(panDirection(tabs, fenceBird, "undev/spool")).toBe("left");
    expect(panDirection(tabs, "undev/gramophone", "obsidian/Pocket")).toBe(
      "left",
    );
  });

  it("replaces the page instantly with reduced motion, with no pan", () => {
    const stillMatch = window.matchMedia;
    window.matchMedia = (query: string) =>
      ({
        ...stillMatch(query),
        matches: query === "(prefers-reduced-motion: reduce)",
      }) as MediaQueryList;
    try {
      const { container, moveTo } = camera(detailOf("undev/skiff"));

      moveTo(detailOf("undev/spool"));

      expect(pans).toEqual([]);
      expect(groundPages(container)).toEqual(["undev/spool"]);
      expect(container.querySelectorAll("article")).toHaveLength(1);
      expect(
        container
          .querySelector('[data-part="pan-track"]')
          ?.hasAttribute("data-pan"),
      ).toBe(false);
    } finally {
      window.matchMedia = stillMatch;
    }
  });

  it("lands an arrival chip only after the pan settles", async () => {
    const { container, moveTo } = camera(detailOf("undev/skiff"));

    moveTo({
      at: "detail",
      birdId: "undev/prism",
      papers: false,
      chip: "ci",
    });
    const arriving = groundPage(container, "undev/prism");

    expect(scrolled).toEqual([]);
    expect(container.querySelector('[data-part="landing"]')).toBeNull();

    await settlePan();

    const ciRow = arriving.querySelector(
      '[data-part="record"] [data-chip="ci"]',
    );
    expect(scrolled).toEqual([ciRow]);
    expect(ciRow?.querySelector('[data-part="landing"]')).not.toBeNull();
  });

  it("keeps the leaving page inert and out of the tree during the pan, the arriving page owning it", async () => {
    const { container, moveTo } = camera(detailOf("undev/skiff"));

    moveTo(detailOf("undev/spool"));
    const leaving = groundPage(container, "undev/skiff");
    const arriving = groundPage(container, "undev/spool");

    expect(leaving.hasAttribute("inert")).toBe(true);
    expect(leaving.getAttribute("aria-hidden")).toBe("true");
    expect(arriving.hasAttribute("inert")).toBe(false);
    expect(arriving.hasAttribute("aria-hidden")).toBe(false);
    expect(screen.getByRole("article").ariaLabel).toBe("Spool in full");
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Spool"]);
    expect(screen.queryByRole("region", { name: "Skiff says" })).toBeNull();

    await settlePan();

    expect(screen.getByRole("article").ariaLabel).toBe("Spool in full");
    expect(screen.getByRole("region", { name: "Spool on its perch" })).toBe(
      within(arriving).getByRole("region", { name: "Spool on its perch" }),
    );
    expect(container.contains(leaving)).toBe(false);
  });

  it("starts the arriving page fresh at the top of its panes, playing no swap of its own", async () => {
    const { container, moveTo } = camera(detailOf("undev/skiff"));
    const leavingRecord = container.querySelector(
      '[data-part="record"]',
    ) as HTMLElement;
    leavingRecord.scrollTop = 300;

    moveTo(detailOf("undev/spool"));
    await settlePan();
    const record = container.querySelector(
      '[data-part="record"]',
    ) as HTMLElement;

    expect(record).not.toBe(leavingRecord);
    expect(record.scrollTop).toBe(0);
    expect(screen.getByRole("article").className).not.toContain("animate-swap");
  });

  it("keeps the swap for the first arrival from the aviary, with no pan", () => {
    const { container, moveTo } = camera(aviaryPlace);

    moveTo(detailOf("undev/skiff"));

    expect(pans).toEqual([]);
    expect(groundPages(container)).toEqual(["undev/skiff"]);
    expect(screen.getByRole("article").className).toContain(
      "motion-safe:animate-swap",
    );
  });

  it("pans on from the arriving page when the camera moves again mid-pan, dropping the page left", async () => {
    const { container, moveTo } = camera(detailOf("undev/skiff"));

    moveTo(detailOf("undev/spool"));
    const spool = groundPage(container, "undev/spool");
    moveTo(detailOf("undev/prism"));

    expect(groundPages(container)).toEqual(["undev/prism", "undev/spool"]);
    expect(groundPage(container, "undev/spool")).toBe(spool);
    expect(spool.hasAttribute("inert")).toBe(true);

    await act(async () => {
      pans[0]?.settle();
    });
    expect(groundPages(container)).toEqual(["undev/prism", "undev/spool"]);

    await settlePan();
    expect(groundPages(container)).toEqual(["undev/prism"]);
  });
});
