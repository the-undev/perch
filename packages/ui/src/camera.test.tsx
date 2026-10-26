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
import { type CameraPlace, CameraView } from "./camera.tsx";
import { mockBird } from "./mock-birds.ts";

afterEach(cleanup);

// The setup's animations never finish. The handover tests need to land a flyer on cue, so
// they swap in an animate that records each flyer's landing for the test to signal.
const stillAnimate = Element.prototype.animate;
const landings = new Map<string, () => void>();

beforeEach(() => {
  landings.clear();
  Element.prototype.animate = function animate(this: Element) {
    const flyerId = this.getAttribute("data-flyer");
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

  it("leaves the ground's scroll instant, so a chip's landing marks a row that holds still", () => {
    const { container } = camera(detailOf("dev/perch"));
    const ground = container.querySelector('[data-part="ground"]');

    expect(ground?.className).toContain("overflow-y-auto");
    expect(ground?.className).not.toContain("scroll-smooth");
  });

  it("keeps the strip's tally clear of the wire's name", () => {
    const { container } = camera(detailOf("undev/skiff"));
    const name = [...container.querySelectorAll("tspan")].find(
      (tspan) => tspan.textContent === "Projects",
    );

    expect(name?.nextElementSibling?.textContent).toBe("3 attention");
    expect(name?.nextElementSibling?.getAttribute("dx")).toBe("18");
  });

  it("alternates the names of a crowded fence's strip between two baselines", () => {
    const birds = Array.from({ length: 21 }, (_, position) => ({
      ...(mockAviary.fence.birds[position % 3] as Bird),
      id: `fence-${position}`,
      position,
    }));
    const { container } = camera(detailOf("fence-0"), false, now, {
      ...mockAviary,
      fence: { birds },
    });
    const names = [...container.querySelectorAll("[data-strip-bird] > text")];

    expect(names).toHaveLength(21);
    expect(names[0]?.getAttribute("y")).not.toBe(names[1]?.getAttribute("y"));
    expect(names[0]?.getAttribute("y")).toBe(names[2]?.getAttribute("y"));
    expect(names[0]?.getAttribute("data-name-size")).toBe("small");
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
