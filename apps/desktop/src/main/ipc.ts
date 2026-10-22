import { ipcMain } from "electron";
import { channels, type PerchApi } from "../shared/ipc.ts";

/** Answers every renderer call on its channel with the matching handler. */
export function registerIpc(handlers: PerchApi): void {
  ipcMain.handle(channels.appVersion, () => handlers.appVersion());
}
