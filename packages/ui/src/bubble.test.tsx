import type { Bird } from "@perch/core/viewmodel.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Bubble } from "./bubble.tsx";
import { mockBird } from "./mock-birds.ts";

afterEach(cleanup);

function speak(bird: Bird, night = false) {
  const onLaunch = vi.fn();
  const onFullStory = vi.fn();
  const onAdopt = vi.fn();
  const { container } = render(
    <Bubble
      bubble={bird.bubble}
      night={night}
      actions={bird.detail.actions}
      onLaunch={onLaunch}
      onFullStory={onFullStory}
      onAdopt={bird.adopted ? null : onAdopt}
      tail={{ side: "left", inset: 40 }}
    />,
  );
  return { container, onLaunch, onFullStory, onAdopt };
}

describe("the bubble", () => {
  it("shows the name, the mood word and the first-person speech", () => {
    const prism = mockBird("undev/prism");
    speak(prism);

    expect(screen.getByRole("heading").textContent).toBe("Prismdistressed");
    expect(screen.getByText(prism.bubble.speech)).toBeDefined();
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
