import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { registerIpc } from "./ipc.ts";

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window.once("ready-to-show", () => window.show());

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl);
    return window;
  }
  void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  return window;
}

function start(): void {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  let mainWindow: BrowserWindow | undefined;
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  void app.whenReady().then(() => {
    registerIpc({ appVersion: async () => app.getVersion() });
    mainWindow = createWindow();
  });
}

start();
