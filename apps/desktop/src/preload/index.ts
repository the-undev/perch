import { contextBridge, ipcRenderer } from "electron";
import { channels, type PerchApi } from "../shared/ipc.ts";

const api: PerchApi = {
  appVersion: () => ipcRenderer.invoke(channels.appVersion),
};

contextBridge.exposeInMainWorld("perch", api);
