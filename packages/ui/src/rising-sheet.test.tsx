import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RisingSheet } from "./rising-sheet.tsx";

afterEach(cleanup);

function sheet(shown = true) {
  const onDismiss = vi.fn();
  const onCard = vi.fn();
  const view = (next: boolean) => (
    <div className="grid">
      <RisingSheet shown={next} onDismiss={onDismiss}>
        <button type="button" onClick={onCard}>
          Inside the card
        </button>
      </RisingSheet>
    </div>
  );
  const { container, rerender } = render(view(shown));
  return {
    container,
    onDismiss,
    onCard,
    set: (next: boolean) => rerender(view(next)),
  };
}

describe("the rising sheet", () => {
  it("renders nothing until shown, and the children once it is", () => {
    const { container, set } = sheet(false);
    expect(container.querySelector('[data-part="rising-sheet"]')).toBeNull();
    set(true);
    expect(
      screen.getByRole("button", { name: "Inside the card" }),
    ).toBeDefined();
  });

  it("dismisses on a press on the background and not on a press inside the card", () => {
    const { container, onDismiss, onCard } = sheet();
    fireEvent.click(screen.getByRole("button", { name: "Inside the card" }));
    expect(onCard).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    const background = container.querySelector(
      '[data-part="rising-sheet-background"]',
    );
    expect(background).not.toBeNull();
    if (background !== null) fireEvent.click(background);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("spreads the background over every row of the caller's grid, beneath the card in the last row", () => {
    const { container } = sheet();
    const background = container.querySelector(
      '[data-part="rising-sheet-background"]',
    );
    const surface = container.querySelector(
      '[data-part="rising-sheet-surface"]',
    );
    expect(background?.parentElement).toBe(surface?.parentElement);
    expect(
      (background?.compareDocumentPosition(surface as Node) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(surface?.contains(background)).toBe(false);
    expect(background?.className.split(" ")).toContain("row-span-full");
    expect(surface?.className.split(" ")).toContain("row-[-2/-1]");
  });

  it("contains Escape pressed inside it, so the page beneath never hears it", () => {
    const { onDismiss } = sheet();
    const heard = vi.fn();
    window.addEventListener("keydown", heard);
    fireEvent.keyDown(screen.getByRole("button", { name: "Inside the card" }), {
      key: "Escape",
    });
    window.removeEventListener("keydown", heard);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(heard).not.toHaveBeenCalled();
  });

  it("moves focus into the sheet as it rises, and back to the opener on dismissal", () => {
    const onDismiss = vi.fn();
    const view = (shown: boolean) => (
      <div className="grid">
        <button type="button">Opener</button>
        <RisingSheet shown={shown} onDismiss={onDismiss}>
          <button type="button">Inside the card</button>
        </RisingSheet>
      </div>
    );
    const { container, rerender } = render(view(false));
    const opener = screen.getByRole("button", { name: "Opener" });
    opener.focus();

    rerender(view(true));
    const surface = container.querySelector(
      '[data-part="rising-sheet-surface"]',
    );
    expect(document.activeElement).toBe(surface);

    rerender(view(false));
    expect(document.activeElement).toBe(opener);
  });

  it("focuses without scrolling, and scrolls nothing as it rises, since the stage beneath holds still", () => {
    const scrolled: { element: Element; options: unknown }[] = [];
    const scrollInto = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (
      this: Element,
      options?: boolean | ScrollIntoViewOptions,
    ) {
      scrolled.push({ element: this, options });
    };
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    try {
      const onDismiss = vi.fn();
      const view = (shown: boolean) => (
        <div className="grid">
          <button type="button">Opener</button>
          <RisingSheet shown={shown} onDismiss={onDismiss}>
            <button type="button">Inside the card</button>
          </RisingSheet>
        </div>
      );
      const { container, rerender } = render(view(false));
      const opener = screen.getByRole("button", { name: "Opener" });
      opener.focus();
      focus.mockClear();

      rerender(view(true));
      const surface = container.querySelector(
        '[data-part="rising-sheet-surface"]',
      );
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(focus.mock.contexts[0]).toBe(surface);
      expect(scrolled).toEqual([]);

      focus.mockClear();
      rerender(view(false));
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      expect(focus.mock.contexts[0]).toBe(opener);
      expect(scrolled).toEqual([]);
    } finally {
      focus.mockRestore();
      Element.prototype.scrollIntoView = scrollInto;
    }
  });

  it("stops the surface at its row's foot and scrolls the surface's own contents", () => {
    const { container } = sheet();
    const layer = container.querySelector('[data-part="rising-sheet"]');
    const surface = container.querySelector(
      '[data-part="rising-sheet-surface"]',
    );

    expect(layer?.className.split(" ")).toEqual(
      expect.arrayContaining(["min-h-0", "grid-rows-subgrid", "row-span-full"]),
    );
    expect(surface?.className.split(" ")).toEqual(
      expect.arrayContaining(["max-h-full", "overflow-y-auto", "pane-scroll"]),
    );
  });

  it("leaves focus on a child that already holds it as the sheet rises", () => {
    const onDismiss = vi.fn();
    render(
      <RisingSheet shown={true} onDismiss={onDismiss}>
        {/* biome-ignore lint/a11y/noAutofocus: the child under test holds focus as it mounts. */}
        <input aria-label="Held" autoFocus />
      </RisingSheet>,
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Held"));
  });

  it("lets other keys through", () => {
    const { onDismiss } = sheet();
    const heard = vi.fn();
    window.addEventListener("keydown", heard);
    fireEvent.keyDown(screen.getByRole("button", { name: "Inside the card" }), {
      key: "a",
    });
    window.removeEventListener("keydown", heard);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("leaves inert and hidden, falling faster than it rose, then unmounts just after the fall", () => {
    vi.useFakeTimers();
    try {
      const { container, set } = sheet();
      const surface = () =>
        container
          .querySelector('[data-part="rising-sheet-surface"]')
          ?.className.split(" ") ?? [];
      expect(surface()).toEqual(
        expect.arrayContaining([
          "motion-safe:duration-420",
          "motion-safe:ease-[cubic-bezier(0.3,1,0.4,1)]",
        ]),
      );
      set(false);
      const leaving = container.querySelector('[data-part="rising-sheet"]');
      expect(leaving?.hasAttribute("inert")).toBe(true);
      expect(leaving?.getAttribute("aria-hidden")).toBe("true");
      expect(surface()).toEqual(
        expect.arrayContaining([
          "translate-y-[103%]",
          "motion-safe:duration-260",
          "motion-safe:ease-[cubic-bezier(0.55,0,0.8,0.4)]",
        ]),
      );
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(container.querySelector('[data-part="rising-sheet"]')).toBe(
        leaving,
      );
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(container.querySelector('[data-part="rising-sheet"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
