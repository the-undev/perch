import { describe, expect, it, vi } from "vitest";
import { trayMenu } from "./tray-menu.ts";

describe("the tray menu", () => {
  it("offers show, rescan and quit, each doing its own thing", () => {
    const actions = { show: vi.fn(), rescan: vi.fn(), quit: vi.fn() };
    const menu = trayMenu(actions);

    expect(menu.map((item) => ("label" in item ? item.label : "---"))).toEqual([
      "Show",
      "Rescan",
      "---",
      "Quit",
    ]);
    for (const item of menu) {
      if ("click" in item) item.click();
    }
    expect(actions.show).toHaveBeenCalledOnce();
    expect(actions.rescan).toHaveBeenCalledOnce();
    expect(actions.quit).toHaveBeenCalledOnce();
  });

  it("calls only the action of the item clicked", () => {
    const actions = { show: vi.fn(), rescan: vi.fn(), quit: vi.fn() };
    const rescan = trayMenu(actions).find(
      (item) => "label" in item && item.label === "Rescan",
    );
    if (rescan === undefined || !("click" in rescan))
      throw new Error("no Rescan");
    rescan.click();
    expect(actions.rescan).toHaveBeenCalledOnce();
    expect(actions.show).not.toHaveBeenCalled();
    expect(actions.quit).not.toHaveBeenCalled();
  });
});
