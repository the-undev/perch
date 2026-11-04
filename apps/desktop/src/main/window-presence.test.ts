import { describe, expect, it, vi } from "vitest";
import {
  inFront,
  onClose,
  type PresentableWindow,
  present,
} from "./window-presence.ts";

interface WindowState {
  visible: boolean;
  focused: boolean;
  minimized: boolean;
}

/** A stand-in for the BrowserWindow that keeps its state and records every call that changes it. */
function stubWindow(initial: WindowState) {
  const state = { ...initial };
  const calls: string[] = [];
  const window: PresentableWindow = {
    isVisible: () => state.visible,
    isFocused: () => state.focused,
    isMinimized: () => state.minimized,
    show() {
      calls.push("show");
      state.visible = true;
    },
    restore() {
      calls.push("restore");
      state.minimized = false;
    },
    focus() {
      calls.push("focus");
      state.focused = true;
    },
    hide() {
      calls.push("hide");
      state.visible = false;
      state.focused = false;
    },
  };
  return { window, state, calls };
}

const hidden = { visible: false, focused: false, minimized: false };
const behind = { visible: true, focused: false, minimized: false };
const front = { visible: true, focused: true, minimized: false };
const minimised = { visible: true, focused: false, minimized: true };

describe("the window's presence", () => {
  it("is in front only when shown, focused and not minimised", () => {
    expect(inFront(stubWindow(front).window)).toBe(true);
    expect(inFront(stubWindow(behind).window)).toBe(false);
    expect(inFront(stubWindow(hidden).window)).toBe(false);
    expect(inFront(stubWindow({ ...minimised, focused: true }).window)).toBe(
      false,
    );
  });

  it("shows and focuses a hidden window", () => {
    const stub = stubWindow(hidden);
    present(stub.window, "show");
    expect(stub.calls).toEqual(["show", "focus"]);
    expect(stub.state).toEqual(front);
  });

  it("restores a minimised window before showing it", () => {
    const stub = stubWindow(minimised);
    present(stub.window, "show");
    expect(stub.calls).toEqual(["restore", "show", "focus"]);
  });

  it("keeps a window in front when asked only to show", () => {
    const stub = stubWindow(front);
    present(stub.window, "show");
    expect(stub.state).toEqual(front);
  });

  it("toggles a window in front to hidden", () => {
    const stub = stubWindow(front);
    present(stub.window, "toggle");
    expect(stub.calls).toEqual(["hide"]);
    expect(stub.state.visible).toBe(false);
  });

  it("toggles a hidden, background or minimised window to the front", () => {
    for (const initial of [hidden, behind, minimised]) {
      const stub = stubWindow(initial);
      present(stub.window, "toggle");
      expect(stub.state).toEqual(front);
    }
  });

  it("hides on close instead of closing while it lives in the tray", () => {
    const stub = stubWindow(front);
    const event = { preventDefault: vi.fn() };
    const quit = vi.fn();
    onClose(event, stub.window, { quitting: false, tray: true }, quit);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(stub.calls).toEqual(["hide"]);
    expect(quit).not.toHaveBeenCalled();
  });

  it("quits on close without the tray", () => {
    const stub = stubWindow(front);
    const event = { preventDefault: vi.fn() };
    const quit = vi.fn();
    onClose(event, stub.window, { quitting: false, tray: false }, quit);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(stub.calls).toEqual([]);
    expect(quit).toHaveBeenCalledOnce();
  });

  it("lets the window close when the app is quitting", () => {
    for (const tray of [true, false]) {
      const stub = stubWindow(front);
      const event = { preventDefault: vi.fn() };
      const quit = vi.fn();
      onClose(event, stub.window, { quitting: true, tray }, quit);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(stub.calls).toEqual([]);
      expect(quit).not.toHaveBeenCalled();
    }
  });
});
