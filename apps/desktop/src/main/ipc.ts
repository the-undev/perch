import { ipcMain } from "electron";
import { channels, type PerchCalls } from "../shared/ipc.ts";

/** Answers every renderer call on its channel with the matching handler. */
export function registerIpc(handlers: PerchCalls): void {
  ipcMain.handle(channels.appVersion, () => handlers.appVersion());
  ipcMain.handle(channels.state, () => handlers.state());
  ipcMain.handle(channels.rescan, () => handlers.rescan());
  ipcMain.handle(channels.keyFiles, (_event, birdId: string) =>
    handlers.keyFiles(birdId),
  );
  ipcMain.handle(
    channels.launch,
    (_event, birdId: string, kind: Parameters<PerchCalls["launch"]>[1]) =>
      handlers.launch(birdId, kind),
  );
}
