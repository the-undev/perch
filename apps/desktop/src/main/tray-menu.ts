// The tray icon and its menu. Electron builds the menu from this template; the actions are the
// main process's. The icon exists only while config keeps the window in the tray.

import type { UpdateState } from "@perch/core/update.ts";

/** What the tray menu's items do. */
export interface TrayActions {
  show(): void;
  rescan(): void;
  /** Shows the window on the Updates settings page. */
  openUpdates(): void;
  quit(): void;
}

/** One item of the tray menu, in the shape Electron's Menu.buildFromTemplate takes. */
export type TrayMenuItem =
  | { label: string; click: () => void }
  | { type: "separator" };

/** The update entry's words while there is something to say, else null. */
export function trayUpdateLabel(update: UpdateState): string | null {
  if (update.release === null) return null;
  return `${update.release.version} is out…`;
}

/** The tray menu: show, rescan, the update entry while there is one, and quit set apart beneath. */
export function trayMenu(
  actions: TrayActions,
  update: UpdateState,
): TrayMenuItem[] {
  const label = trayUpdateLabel(update);
  const entry: TrayMenuItem[] =
    label === null
      ? []
      : [{ label, click: () => actions.openUpdates() }, { type: "separator" }];
  return [
    { label: "Show", click: () => actions.show() },
    { label: "Rescan", click: () => actions.rescan() },
    { type: "separator" },
    ...entry,
    { label: "Quit", click: () => actions.quit() },
  ];
}

/** The part of a tray icon that taking it away uses. */
export interface TrayIcon {
  destroy(): void;
}

/** The icon held once the tray setting is applied: made while wanted and missing, destroyed once not wanted. */
export function syncTray<Icon extends TrayIcon>(
  held: Icon | null,
  wanted: boolean,
  create: () => Icon,
): Icon | null {
  if (!wanted) {
    held?.destroy();
    return null;
  }
  return held ?? create();
}
