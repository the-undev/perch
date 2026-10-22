import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { channels, type PerchApi, type PerchState } from "../shared/ipc.ts";

const api: PerchApi = {
  appVersion: () => ipcRenderer.invoke(channels.appVersion),
  state: () => ipcRenderer.invoke(channels.state),
  onState(listener) {
    const handler = (_event: IpcRendererEvent, state: PerchState) =>
      listener(state);
    ipcRenderer.on(channels.onState, handler);
    return () => ipcRenderer.removeListener(channels.onState, handler);
  },
  rescan: () => ipcRenderer.invoke(channels.rescan),
  keyFiles: (birdId) => ipcRenderer.invoke(channels.keyFiles, birdId),
  launch: (birdId, kind) => ipcRenderer.invoke(channels.launch, birdId, kind),
};

contextBridge.exposeInMainWorld("perch", api);
