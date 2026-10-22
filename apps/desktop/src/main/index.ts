import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "@perch/core/config.ts";
import { runCommand } from "@perch/core/exec.ts";
import { readTextIfExists } from "@perch/core/fs.ts";
import { readSnapshot, runAggregate, runGather } from "@perch/core/scan.ts";
import { app, BrowserWindow, shell } from "electron";
import { channels, type PerchState } from "../shared/ipc.ts";
import { appPaths, examplePathFor } from "./app-paths.ts";
import { createAppState } from "./app-state.ts";
import { createConfigStore } from "./config-store.ts";
import { isWebUrl } from "./external-links.ts";
import { registerIpc } from "./ipc.ts";
import { createSpawnDetached, launch } from "./launch.ts";
import { createScanScheduler } from "./scan-scheduler.ts";

/** A focus scans only once this long has passed since the last scan finished. */
const focusGapMs = 60_000;
/** Without any config, the next attempt to read it and scan comes this soon. */
const noConfigRetryMs = 60_000;

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#101214",
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window.once("ready-to-show", () => window.show());

  // Links leave for the browser; the window itself never navigates away from the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
    if (isWebUrl(url)) void shell.openExternal(url);
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devServerUrl) {
    void window.loadURL(devServerUrl);
    return window;
  }
  void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  return window;
}

function start(): void {
  const home = homedir();
  const env = process.env;
  const paths = appPaths(
    home,
    examplePathFor(app.isPackaged, process.resourcesPath, import.meta.dirname),
  );
  // Before anything reads it: the single-instance lock lives in userData.
  app.setPath("userData", paths.userData);

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

  const config = createConfigStore(() =>
    loadConfig({
      home,
      userPath: paths.userConfigPath,
      examplePath: paths.examplePath,
      readText: readTextIfExists,
    }),
  );
  const spawnDetached = createSpawnDetached(spawn, { cwd: home, env });
  const run = ([program, ...args]: string[]) =>
    runCommand(program ?? "", args, { cwd: home, env });
  const now = () => new Date();
  const state = createAppState({
    config,
    // The cache is only a head start: one that cannot be read is no cache.
    readCached: () => readSnapshot(paths.snapshotPath).catch(() => null),
    gather: async (current) => {
      await runGather({
        home,
        env,
        config: current,
        rawDir: paths.rawDir,
        now,
      });
    },
    aggregate: (loaded) =>
      runAggregate({
        config: loaded.config,
        configPath: loaded.path,
        rawDir: paths.rawDir,
        snapshotPath: paths.snapshotPath,
        now,
      }),
    launch: (action, current) =>
      launch(action, current.launch.commands, { run, spawnDetached }),
    readText: (path) => readFile(path, "utf8"),
    publish: (next: PerchState) => {
      if (mainWindow === undefined || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send(channels.onState, next);
    },
  });
  const scheduler = createScanScheduler({
    scan: () => state.scan(),
    intervalMs: () => {
      const loaded = config.current().loaded;
      return loaded === null
        ? noConfigRetryMs
        : loaded.config.scan.intervalMinutes * 60_000;
    },
    focusGapMs,
    now: Date.now,
    onScanning: (scanning) => state.setScanning(scanning),
  });
  const ready = state.start();

  app.on("before-quit", () => scheduler.stop());

  void app.whenReady().then(async () => {
    registerIpc({
      state: async () => {
        await ready;
        return state.state();
      },
      rescan: () => scheduler.request(),
      keyFiles: (birdId) => state.keyFiles(birdId),
      launch: (action) => state.launch(action),
    });
    mainWindow = createWindow();
    mainWindow.on("focus", () => void ready.then(() => scheduler.focused()));
    await ready;
    scheduler.start();
  });
}

start();
