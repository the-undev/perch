// The arguments perch is launched with. A second launch hands its command line to the running
// instance and quits; the first reads only whether to start hidden. Without the tray nothing may
// leave the window unreachable: the window never starts hidden and every second launch shows it.

import type { WindowRequest } from "./window-presence.ts";

/** What a launch asks for. */
export interface LaunchArguments {
  /** What it asks of the window, or null when it asks nothing of it. */
  window: WindowRequest | null;
  /** It asks for a scan now. */
  scan: boolean;
  /** The window starts hidden; only the first launch reads this, and only with the tray. */
  hidden: boolean;
}

/** --toggle, then --show; a launch with neither asks to show unless it only scans or starts hidden. */
function windowRequest(argv: readonly string[]): WindowRequest | null {
  if (argv.includes("--toggle")) return "toggle";
  if (argv.includes("--show")) return "show";
  if (argv.includes("--scan") || argv.includes("--hidden")) return null;
  return "show";
}

/** Reads a command line; the executable, Chromium's switches and anything unknown are ignored. */
export function parseArguments(argv: readonly string[]): LaunchArguments {
  return {
    window: windowRequest(argv),
    scan: argv.includes("--scan"),
    hidden: argv.includes("--hidden"),
  };
}

/** Whether the first launch starts with the window hidden: asked to, and with the tray to show it from. */
export function startsHidden(args: LaunchArguments, tray: boolean): boolean {
  return args.hidden && tray;
}

/** What the running instance does for a second launch. */
export interface HandOverActions {
  present(request: WindowRequest): void;
  rescan(): void;
}

/** Carries out in the running instance what a second launch asked for; without the tray it shows. */
export function handOver(
  args: LaunchArguments,
  tray: boolean,
  actions: HandOverActions,
): void {
  const request = tray ? args.window : "show";
  if (request !== null) actions.present(request);
  if (args.scan) actions.rescan();
}
