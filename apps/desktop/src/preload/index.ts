import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { channels, type PerchApi, type PerchState } from "../shared/ipc.ts";

const api: PerchApi = {
  state: () => ipcRenderer.invoke(channels.state),
  onState(listener) {
    const handler = (_event: IpcRendererEvent, state: PerchState) =>
      listener(state);
    ipcRenderer.on(channels.onState, handler);
    return () => ipcRenderer.removeListener(channels.onState, handler);
  },
  rescan: () => ipcRenderer.invoke(channels.rescan),
  keyFiles: (birdId) => ipcRenderer.invoke(channels.keyFiles, birdId),
  launch: (action) => ipcRenderer.invoke(channels.launch, action),
  openConfig: () => ipcRenderer.invoke(channels.openConfig),
  writeStarterConfig: () => ipcRenderer.invoke(channels.writeStarterConfig),
  entryForm: (birdId) => ipcRenderer.invoke(channels.entryForm, birdId),
  saveEntry: (birdId, values) =>
    ipcRenderer.invoke(channels.saveEntry, birdId, values),
  removeEntry: (birdId) => ipcRenderer.invoke(channels.removeEntry, birdId),
  settingsForm: () => ipcRenderer.invoke(channels.settingsForm),
  saveSettings: (values) => ipcRenderer.invoke(channels.saveSettings, values),
  storeToken: (key, token) =>
    ipcRenderer.invoke(channels.storeToken, key, token),
  testSource: (values) => ipcRenderer.invoke(channels.testSource, values),
  checkForUpdate: () => ipcRenderer.invoke(channels.checkForUpdate),
  installUpdate: () => ipcRenderer.invoke(channels.installUpdate),
  restartIntoUpdate: () => ipcRenderer.invoke(channels.restartIntoUpdate),
  onOpenUpdates(listener) {
    const handler = () => listener();
    ipcRenderer.on(channels.onOpenUpdates, handler);
    return () => ipcRenderer.removeListener(channels.onOpenUpdates, handler);
  },
};

contextBridge.exposeInMainWorld("perch", api);
