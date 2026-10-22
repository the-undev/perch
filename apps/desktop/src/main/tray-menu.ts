// The tray icon's menu. Electron builds it from this template; the actions are the main process's.

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
