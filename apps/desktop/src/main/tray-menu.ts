// The tray icon and its menu. Electron builds the menu from this template; the actions are the
// main process's. The icon exists only while config keeps the window in the tray.

/** What the tray menu's items do. */
export interface TrayActions {
  show(): void;
  rescan(): void;
  quit(): void;
}

/** One item of the tray menu, in the shape Electron's Menu.buildFromTemplate takes. */
export type TrayMenuItem =
  | { label: string; click: () => void }
  | { type: "separator" };

/** The tray menu: show, rescan, and quit set apart beneath them. */
export function trayMenu(actions: TrayActions): TrayMenuItem[] {
  return [
    { label: "Show", click: () => actions.show() },
    { label: "Rescan", click: () => actions.rescan() },
    { type: "separator" },
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
