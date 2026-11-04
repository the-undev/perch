import { describe, expect, it, vi } from "vitest";
import { handOver, parseArguments, startsHidden } from "./command-line.ts";

const exe = "/tmp/.mount_perchX/perch";

describe("the command line", () => {
  it("asks a plain launch to show the window", () => {
    expect(parseArguments([exe])).toEqual({
      window: "show",
      scan: false,
      hidden: false,
    });
  });

  it("reads --toggle, --show and --scan", () => {
    expect(parseArguments([exe, "--toggle"]).window).toBe("toggle");
    expect(parseArguments([exe, "--show"]).window).toBe("show");
    expect(parseArguments([exe, "--scan"])).toEqual({
      window: null,
      scan: true,
      hidden: false,
    });
  });

  it("lets a toggle win over a show and scan beside either", () => {
    expect(parseArguments([exe, "--show", "--toggle", "--scan"])).toEqual({
      window: "toggle",
      scan: true,
      hidden: false,
    });
  });

  it("starts hidden with --hidden and asks nothing of a window already running", () => {
    expect(parseArguments([exe, "--hidden"])).toEqual({
      window: null,
      scan: false,
      hidden: true,
    });
  });

  it("ignores Chromium's switches and anything it does not know", () => {
    expect(
      parseArguments([
        exe,
        "--original-process-start-time=13401234",
        "--toggled",
        "--toggle",
      ]),
    ).toEqual({ window: "toggle", scan: false, hidden: false });
  });

  it("hands a second launch's window request and scan to the running instance", () => {
    const actions = { present: vi.fn(), rescan: vi.fn() };
    handOver(parseArguments([exe, "--toggle", "--scan"]), true, actions);
    expect(actions.present).toHaveBeenCalledExactlyOnceWith("toggle");
    expect(actions.rescan).toHaveBeenCalledOnce();
  });

  it("hands a plain second launch over as a show", () => {
    const actions = { present: vi.fn(), rescan: vi.fn() };
    handOver(parseArguments([exe]), true, actions);
    expect(actions.present).toHaveBeenCalledExactlyOnceWith("show");
    expect(actions.rescan).not.toHaveBeenCalled();
  });

  it("leaves the window alone for a second launch that only scans", () => {
    const actions = { present: vi.fn(), rescan: vi.fn() };
    handOver(parseArguments([exe, "--scan"]), true, actions);
    expect(actions.present).not.toHaveBeenCalled();
    expect(actions.rescan).toHaveBeenCalledOnce();
  });

  it("starts hidden with --hidden only with the tray, and shown without it", () => {
    expect(startsHidden(parseArguments([exe, "--hidden"]), true)).toBe(true);
    expect(startsHidden(parseArguments([exe, "--hidden"]), false)).toBe(false);
    expect(startsHidden(parseArguments([exe]), true)).toBe(false);
  });

  it("shows the window for every second launch without the tray, a toggle and a scan among them", () => {
    for (const argv of [
      [exe],
      [exe, "--toggle"],
      [exe, "--scan"],
      [exe, "--hidden"],
    ]) {
      const actions = { present: vi.fn(), rescan: vi.fn() };
      handOver(parseArguments(argv), false, actions);
      expect(actions.present).toHaveBeenCalledExactlyOnceWith("show");
    }
    const scan = { present: vi.fn(), rescan: vi.fn() };
    handOver(parseArguments([exe, "--toggle", "--scan"]), false, scan);
    expect(scan.rescan).toHaveBeenCalledOnce();
  });
});
