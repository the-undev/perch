import type { EntryValues } from "@perch/core/entry-form.ts";
import type { SettingsValues } from "@perch/core/settings-form.ts";
import type { LaunchAction } from "@perch/core/viewmodel.ts";
import { ipcMain } from "electron";
import { channels, type PerchCalls } from "../shared/ipc.ts";

/** Answers every renderer call on its channel with the matching handler. */
export function registerIpc(handlers: PerchCalls): void {
  ipcMain.handle(channels.state, () => handlers.state());
  ipcMain.handle(channels.rescan, () => handlers.rescan());
  ipcMain.handle(channels.keyFiles, (_event, birdId: string) =>
    handlers.keyFiles(birdId),
  );
  ipcMain.handle(channels.launch, (_event, action: LaunchAction) =>
    handlers.launch(action),
  );
  ipcMain.handle(channels.writeStarterConfig, () =>
    handlers.writeStarterConfig(),
  );
  ipcMain.handle(channels.entryForm, (_event, birdId: string) =>
    handlers.entryForm(birdId),
  );
  ipcMain.handle(
    channels.saveEntry,
    (_event, birdId: string, values: EntryValues) =>
      handlers.saveEntry(birdId, values),
  );
  ipcMain.handle(channels.removeEntry, (_event, birdId: string) =>
    handlers.removeEntry(birdId),
  );
  ipcMain.handle(channels.settingsForm, () => handlers.settingsForm());
  ipcMain.handle(channels.saveSettings, (_event, values: SettingsValues) =>
    handlers.saveSettings(values),
  );
}
