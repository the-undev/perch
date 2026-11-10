import { mockUpdates } from "@perch/core/mock.ts";
import { describe, expect, it, vi } from "vitest";
import { syncTray, trayMenu, trayUpdateLabel } from "./tray-menu.ts";

/** Every tray action as a spy. */
const trayActions = () => ({
  show: vi.fn(),
  rescan: vi.fn(),
  openUpdates: vi.fn(),
  restart: vi.fn(),
  quit: vi.fn(),
});

/** The menu's labels, a separator as ---. */
const labels = (menu: ReturnType<typeof trayMenu>) =>
  menu.map((item) => ("label" in item ? item.label : "---"));

describe("the tray menu", () => {
  it("offers show, rescan and quit, each doing its own thing", () => {
    const actions = trayActions();
    const menu = trayMenu(actions, mockUpdates.upToDate);

    expect(labels(menu)).toEqual(["Show", "Rescan", "---", "Quit"]);
    for (const item of menu) {
      if ("click" in item) item.click();
    }
    expect(actions.show).toHaveBeenCalledOnce();
    expect(actions.rescan).toHaveBeenCalledOnce();
    expect(actions.quit).toHaveBeenCalledOnce();
  });

  it("calls only the action of the item clicked", () => {
    const actions = trayActions();
    const rescan = trayMenu(actions, mockUpdates.upToDate).find(
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

describe("the tray's update entry", () => {
  it("is there only while a newer release is known", () => {
    for (const quiet of [
      mockUpdates.noCheck,
      mockUpdates.checking,
      mockUpdates.upToDate,
      mockUpdates.checkOff,
      mockUpdates.sourceRun,
    ]) {
      expect(trayUpdateLabel(quiet)).toBeNull();
    }
    expect(trayUpdateLabel(mockUpdates.found)).toBe("0.3.0 is out…");
    expect(trayUpdateLabel(mockUpdates.foundInstall)).toBe("0.3.0 is out…");
  });

  it("sits above Quit, set apart, and opens the Updates page", () => {
    const actions = trayActions();
    const menu = trayMenu(actions, mockUpdates.found);

    expect(labels(menu)).toEqual([
      "Show",
      "Rescan",
      "---",
      "0.3.0 is out…",
      "---",
      "Quit",
    ]);
    const entry = menu[3];
    if (entry === undefined || !("click" in entry)) throw new Error("no entry");
    entry.click();
    expect(actions.openUpdates).toHaveBeenCalledOnce();
    expect(actions.show).not.toHaveBeenCalled();
  });
});

describe("the tray's restart entry", () => {
  it("reads Restart into the downloaded version and restarts, rather than opening the page", () => {
    const actions = trayActions();
    const menu = trayMenu(actions, mockUpdates.ready);

    expect(labels(menu)).toEqual([
      "Show",
      "Rescan",
      "---",
      "Restart into 0.3.0",
      "---",
      "Quit",
    ]);
    const entry = menu[3];
    if (entry === undefined || !("click" in entry)) throw new Error("no entry");
    entry.click();
    expect(actions.restart).toHaveBeenCalledOnce();
    expect(actions.openUpdates).not.toHaveBeenCalled();
  });

  it("keeps saying the release is out while it downloads or after a failed download", () => {
    expect(trayUpdateLabel(mockUpdates.downloading)).toBe("0.3.0 is out…");
    expect(trayUpdateLabel(mockUpdates.downloadFailed)).toBe("0.3.0 is out…");
  });
});

describe("the tray icon", () => {
  it("is never made while the tray setting is off, and one held is destroyed", () => {
    const create = vi.fn(() => ({ destroy: vi.fn() }));
    const held = { destroy: vi.fn() };

    expect(syncTray(null, false, create)).toBeNull();
    expect(syncTray(held, false, create)).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(held.destroy).toHaveBeenCalledOnce();
  });

  it("is made once while the tray setting is on, and kept after", () => {
    const made = { destroy: vi.fn() };
    const create = vi.fn(() => made);

    const first = syncTray(null, true, create);
    const again = syncTray(first, true, create);

    expect(again).toBe(made);
    expect(create).toHaveBeenCalledOnce();
    expect(made.destroy).not.toHaveBeenCalled();
  });
});
