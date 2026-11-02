import type { Bird } from "@perch/core/viewmodel.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Bubble } from "./bubble.tsx";
import { Icon } from "./icons.tsx";
import { mockBird } from "./mock-birds.ts";

afterEach(cleanup);

function speak(bird: Bird, night = false) {
  const onLaunch = vi.fn();
  const onFullStory = vi.fn();
  const onAdopt = vi.fn();
  const onChip = vi.fn();
  const { container } = render(
    <Bubble
      bubble={bird.bubble}
      night={night}
      actions={bird.detail.actions}
      onLaunch={onLaunch}
      onFullStory={onFullStory}
      onAdopt={bird.adopted ? null : onAdopt}
      onChip={onChip}
      tail={{ side: "left", inset: 40 }}
    />,
  );
  return { container, onLaunch, onFullStory, onAdopt, onChip };
}

describe("the bubble", () => {
  it("shows the name, the mood word and the first-person speech", () => {
    const prism = mockBird("undev/prism");
    speak(prism);

    expect(screen.getByRole("heading").textContent).toBe("Prismdistressed");
    expect(screen.getByText(prism.bubble.speech)).toBeDefined();
  });

  it("hangs the tail from the bubble's bottom edge, its tip 26px below it", () => {
    const { container } = speak(mockBird("undev/prism"));
    const tail = container.querySelector(
      '[data-part="tail-hanging"]',
    ) as unknown as SVGElement;

    expect(tail.style.top).toBe("calc(100% - 3px)");
    expect(tail.style.left).toBe("38px");
    expect(tail.getAttribute("height")).toBe("30");
  });

  it("carries every chip with its severity", () => {
    const { container } = speak(mockBird("undev/prism"));
    const chips = [...container.querySelectorAll("[data-kind]")].map((chip) => [
      chip.textContent,
      chip.getAttribute("data-severity"),
    ]);

    expect(chips).toEqual([
      ["ci failure", "red"],
      ["4 uncommitted", "amber"],
      ["2 open PRs", "none"],
      ["78 open items", "none"],
    ]);
  });

  it("makes each chip a handle that hands back its kind when pressed", () => {
    const { onChip, onFullStory } = speak(mockBird("undev/prism"));

    fireEvent.click(screen.getByRole("button", { name: "ci failure" }));
    fireEvent.click(screen.getByRole("button", { name: "2 open PRs" }));

    expect(onChip.mock.calls).toEqual([["ci"], ["pull-requests"]]);
    expect(onFullStory).not.toHaveBeenCalled();
  });

  it("shows no chips row for a bird that carries none", () => {
    const { container } = speak(mockBird("undev/spool"));

    expect(container.querySelectorAll("[data-kind]")).toHaveLength(0);
  });

  it("wakes a sleeping bird at night, and only a sleeping one", () => {
    const spool = mockBird("undev/spool");
    const prism = mockBird("undev/prism");

    expect(speak(spool, true).container.textContent).toContain(
      `Mm? You woke me. ${spool.bubble.speech}`,
    );
    cleanup();
    expect(speak(prism, true).container.textContent).not.toContain(
      "You woke me",
    );
  });

  it("names each launch action by its verb and hands it back when pressed", () => {
    const perch = mockBird("dev/perch");
    const { onLaunch, onFullStory } = speak(perch);

    fireEvent.click(screen.getByRole("button", { name: "Open in VS Code" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Tell me the full story" }),
    );

    expect(onLaunch).toHaveBeenCalledWith(perch.detail.actions[1]);
    expect(onFullStory).toHaveBeenCalledOnce();
  });

  it("draws each launch action's key with the icon the action carries", () => {
    const perch = mockBird("dev/perch");
    const { container: drawn } = render(<Icon name="edit" size={14} />);
    const editIcon = drawn.innerHTML;
    cleanup();
    speak({
      ...perch,
      detail: {
        ...perch.detail,
        actions: perch.detail.actions.map((action) => ({
          ...action,
          icon: "edit" as const,
        })),
      },
    });

    expect(
      perch.detail.actions.map(
        (action) =>
          screen.getByRole("button", { name: action.verb }).querySelector("svg")
            ?.outerHTML,
      ),
    ).toEqual(perch.detail.actions.map(() => editIcon));
  });

  it("offers adopt as a fence bird's one key beside the full story, and an adopted bird none", () => {
    const { onAdopt } = speak(mockBird("dev/odin/hello"));

    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    expect(onAdopt).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Tell me the full story" }),
    ).toBeDefined();
    cleanup();

    speak(mockBird("dev/perch"));
    expect(screen.queryByRole("button", { name: "Adopt" })).toBeNull();
  });
});
