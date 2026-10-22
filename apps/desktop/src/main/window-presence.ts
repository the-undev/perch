// Showing, hiding and toggling the one window, and hiding it when closed. Electron stays outside:
// the window is anything that answers these few calls.

/** The calls on a BrowserWindow that showing and hiding use. */
export interface PresentableWindow {
  isVisible(): boolean;
  isFocused(): boolean;
  isMinimized(): boolean;
  show(): void;
  restore(): void;
  focus(): void;
  hide(): void;
}

/** What a launch or the tray asks of the window: to be shown, or toggled. */
export type WindowRequest = "show" | "toggle";

/** The window is in front when it is shown, not minimised and focused. */
export function inFront(window: PresentableWindow): boolean {
  return window.isVisible() && !window.isMinimized() && window.isFocused();
}

/** Shows and focuses the window; a toggle hides it instead when it is already in front. */
export function present(
  window: PresentableWindow,
  request: WindowRequest,
): void {
  if (request === "toggle" && inFront(window)) {
    window.hide();
    return;
  }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

/** The part of a close event that can stop the close. */
export interface CloseEvent {
  preventDefault(): void;
}

/** Hides the window instead of letting it close, unless the app is quitting. */
export function hideOnClose(
  event: CloseEvent,
  window: PresentableWindow,
  quitting: boolean,
): void {
  if (quitting) return;
  event.preventDefault();
  window.hide();
}
