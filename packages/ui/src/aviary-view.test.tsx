import { mockAviary, mockSnapshot } from "@perch/core/mock.ts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AviaryView } from "./aviary-view.tsx";
import { mockBird, mockBirds } from "./mock-birds.ts";

afterEach(cleanup);

const morning = new Date(mockSnapshot.scannedAt);
const night = new Date(2026, 9, 22, 23, 30);

function show(now = morning) {
  const onLaunch = vi.fn();
  const onFullStory = vi.fn();
  const { container } = render(
    <AviaryView
      aviary={mockAviary}
      now={now}
      onLaunch={onLaunch}
      onFullStory={onFullStory}
    />,
  );
  return { container, onLaunch, onFullStory };
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
      "Forgejo accounts not read, last read under an hour ago: fetch failed",
    );
    expect(notices?.textContent).toContain(
      "include not found: /home/owner/work",
    );
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
});
