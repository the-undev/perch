import { mockAviary, mockSnapshot } from "@perch/core/mock.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type CameraPlace, CameraView } from "./camera.tsx";
import { mockBird } from "./mock-birds.ts";

afterEach(cleanup);

const now = new Date(mockSnapshot.scannedAt);
const aviaryPlace: CameraPlace = { at: "aviary" };
const detailOf = (birdId: string): CameraPlace => ({ at: "detail", birdId });

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

  it("keeps the strip's tally clear of the wire's name", () => {
    const { container } = camera(detailOf("undev/skiff"));
    const name = [...container.querySelectorAll("tspan")].find(
      (tspan) => tspan.textContent === "Projects",
    );

    expect(name?.nextElementSibling?.textContent).toBe("4 attention");
    expect(name?.nextElementSibling?.getAttribute("dx")).toBe("18");
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
