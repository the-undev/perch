import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { defaultTray } from "@perch/core/config.ts";
import { runCommand } from "@perch/core/exec.ts";
import { errorMessage, readTextIfExists } from "@perch/core/fs.ts";
import { createFetchJson } from "@perch/core/http.ts";
import { readSnapshot, runAggregate, runGather } from "@perch/core/scan.ts";
import { createKeyringTokenLookup } from "@perch/core/secrets.ts";
import type { UpdateState } from "@perch/core/update.ts";
import { app, BrowserWindow, Menu, shell, Tray } from "electron";
import { channels, type PerchState } from "../shared/ipc.ts";
import { appPaths } from "./app-paths.ts";
import { createAppState } from "./app-state.ts";
import {
  autostartPath,
  createAutostart,
  removeFile,
  replaceFile,
} from "./autostart.ts";
import { handOver, parseArguments, startsHidden } from "./command-line.ts";
import { editConfigFile, writeTextAtomic } from "./config-edit.ts";
import { createConfigStore } from "./config-store.ts";
import { createConfigWatch, rescanOnConfigChange } from "./config-watch.ts";
import { isWebUrl } from "./external-links.ts";
import { iconPaths, resourceDirFor } from "./icons.ts";
import { registerIpc } from "./ipc.ts";
import { createStoreToken, testSource } from "./keyring.ts";
import { createSpawnDetached, launch } from "./launch.ts";
import { createScanScheduler } from "./scan-scheduler.ts";
import { writeStarterConfig } from "./starter-config.ts";
import {
  syncTray,
  type TrayActions,
  trayMenu,
  trayUpdateLabel,
} from "./tray-menu.ts";
import { createElectronUpdater } from "./updater.ts";
import { onClose, present } from "./window-presence.ts";

/** A focus scans only once this long has passed since the last scan finished. */
const focusGapMs = 60_000;
/** With a config file that has never parsed, the next attempt to read it and scan comes this soon. */
const noConfigRetryMs = 60_000;
/** An edit to the config file outside the app is read once the file has been quiet this long. */
const configQuietMs = 300;
/** A connection test gives up on a forge that has not answered in this long, as a scan does. */
const testTimeoutMs = 10_000;
/** The release check gives up on GitHub after this long. */
const releaseTimeoutMs = 10_000;

/** Held while the tray setting is on: a tray icon that is collected leaves the tray. */
let tray: Tray | null = null;
/** The update entry the tray's menu was last built with; undefined before it was built. */
let trayMenuLabel: string | null | undefined;

/** The tray icon on the window; activating it toggles the window. */
function createTray(icon: string, window: BrowserWindow): Tray {
  const made = new Tray(icon);
  made.setToolTip("Perch");
  // On Plasma a left click activates the icon, which Electron reports as a click.
  made.on("click", () => present(window, "toggle"));
  return made;
}

function createWindow(icon: string, showWhenReady: boolean): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon,
    autoHideMenuBar: true,
    backgroundColor: "#101214",
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  // Started with --hidden, the window waits for the tray or a second launch to show it.
  if (showWhenReady) window.once("ready-to-show", () => window.show());

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
  const paths = appPaths(home);
  const icons = iconPaths(
    resourceDirFor(app.isPackaged, process.resourcesPath, import.meta.dirname),
  );
  // Before anything reads it: the single-instance lock lives in userData.
  app.setPath("userData", paths.userData);

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  const launchArguments = parseArguments(process.argv);
  let mainWindow: BrowserWindow | undefined;

  const config = createConfigStore({
    home,
    path: paths.userConfigPath,
    readText: readTextIfExists,
  });
  const spawnDetached = createSpawnDetached(spawn, { cwd: home, env });
  const run = ([program, ...args]: string[]) =>
    runCommand(program ?? "", args, { cwd: home, env });
  const storeToken = createStoreToken(spawn, { cwd: home, env });
  const testDeps = {
    lookupToken: createKeyringTokenLookup(home, env),
    fetchJson: createFetchJson(testTimeoutMs),
  };
  const now = () => new Date();
  /** The running AppImage; null when run from source. */
  const image = env.APPIMAGE || null;
  const autostart = createAutostart({
    path: autostartPath(home, env.XDG_CONFIG_HOME),
    image,
    readText: readTextIfExists,
    writeText: replaceFile,
    remove: removeFile,
  });
  /** Whether the window lives in the tray: config's setting, its default without a config. */
  const trayOn = () =>
    config.current().loaded?.config.window.tray ?? defaultTray;
  /** What the tray menu's items do on the window. */
  const trayActions = (window: BrowserWindow): TrayActions => ({
    show: () => present(window, "show"),
    rescan: () => void scheduler.request(),
    openUpdates: () => {
      present(window, "show");
      window.webContents.send(channels.onOpenUpdates);
    },
    restart: () => state.restartIntoUpdate(restartArguments(window)),
    quit: () => app.quit(),
  });
  /**
   * Makes the tray icon on the window while the setting wants one, and takes it away once not; its
   * menu is built again when the update entry changes.
   */
  function applyTray(window: BrowserWindow, update: UpdateState): void {
    const held = tray;
    tray = syncTray(tray, trayOn(), () => createTray(icons.tray, window));
    if (tray === null) return;
    const label = trayUpdateLabel(update);
    if (tray === held && label === trayMenuLabel) return;
    trayMenuLabel = label;
    tray.setContextMenu(
      Menu.buildFromTemplate(trayMenu(trayActions(window), update)),
    );
  }
  /** The new image starts as this one stands: hidden in the tray when it is, else shown. */
  const restartArguments = (window: BrowserWindow) =>
    trayOn() && !window.isVisible() ? ["--hidden"] : [];
  const state = createAppState({
    home,
    config,
    configPath: paths.userConfigPath,
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
        home,
        rawDir: paths.rawDir,
        snapshotPath: paths.snapshotPath,
        now,
      }),
    launch: (action) => launch(action, { run, spawnDetached }),
    readText: (path) => readFile(path, "utf8"),
    writeStarter: async () => {
      await writeStarterConfig(paths.userConfigPath, home);
      // Without a config directory at start there was nothing to watch.
      await configWatch.start();
    },
    editConfig: (edit) =>
      editConfigFile(
        {
          home,
          path: paths.userConfigPath,
          readText: readTextIfExists,
          writeText: writeTextAtomic,
        },
        edit,
      ),
    autostart,
    image,
    running: app.getVersion(),
    fetchRelease: createFetchJson(releaseTimeoutMs),
    now,
    updater: createElectronUpdater({
      image,
      relaunch: (execPath, args) => app.relaunch({ execPath, args }),
      warn: (message) => console.warn(`The update failed: ${message}`),
    }),
    // The scheduler is made below; nothing asks for a scan before then.
    requestScan: () => scheduler.request(),
    // Every config read is published, so the tray icon follows the setting from here.
    publish: (next: PerchState) => {
      if (mainWindow === undefined || mainWindow.isDestroyed()) return;
      applyTray(mainWindow, next.update);
      mainWindow.webContents.send(channels.onState, next);
    },
  });
  const scheduler = createScanScheduler({
    scan: () => state.scan(),
    hasConfig: () => !config.current().missing,
    recheck: () => state.recheck(),
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
  // Last write wins: an edit by hand is read and shown, and the next save from the app replaces it.
  const configWatch = createConfigWatch({
    path: paths.userConfigPath,
    quietMs: configQuietMs,
    onChange: rescanOnConfigChange({
      recheck: () => state.recheck(),
      requestScan: () => scheduler.request(),
    }),
    onError: (message) => console.warn(message),
  });
  const ready = state.start();

  // A second launch quits at once; the running instance does what its command line asks.
  app.on("second-instance", (_event, commandLine) => {
    handOver(parseArguments(commandLine), trayOn(), {
      present: (request) => {
        if (mainWindow !== undefined) present(mainWindow, request);
      },
      rescan: () => void scheduler.request(),
    });
  });

  // Closing the window hides it while it lives in the tray, else quits.
  let quitting = false;
  app.on("before-quit", () => {
    quitting = true;
    scheduler.stop();
    configWatch.stop();
  });

  void app.whenReady().then(async () => {
    registerIpc({
      state: async () => {
        await ready;
        return state.state();
      },
      rescan: () => scheduler.request(),
      keyFiles: (birdId) => state.keyFiles(birdId),
      launch: (action) => state.launch(action),
      openConfig: () => state.openConfig(),
      writeStarterConfig: () => state.writeStarterConfig(),
      entryForm: async (birdId) => state.entryForm(birdId),
      saveEntry: (birdId, values) => state.saveEntry(birdId, values),
      removeEntry: (birdId) => state.removeEntry(birdId),
      settingsForm: async () => state.settingsForm(),
      saveSettings: (values) => state.saveSettings(values),
      storeToken,
      testSource: (values) => testSource(values, testDeps),
      checkForUpdate: () => state.checkForUpdate(),
      installUpdate: () => state.installUpdate(),
      // Pressed in the window, so the window is shown and the new image starts with it shown.
      restartIntoUpdate: async () => state.restartIntoUpdate([]),
    });
    // The tray setting is config's, so the window waits for the first read.
    await ready;
    const window = createWindow(
      icons.window,
      !startsHidden(launchArguments, trayOn()),
    );
    mainWindow = window;
    window.on("close", (event) =>
      onClose(event, window, { quitting, tray: trayOn() }, () => app.quit()),
    );
    window.on("focus", () => void ready.then(() => scheduler.focused()));

    applyTray(window, state.state().update);
    // An existing entry follows the image now running, so updating is running the new one once.
    void autostart
      .repoint(trayOn())
      .catch((error) =>
        console.warn(
          `The login entry was not repointed: ${errorMessage(error)}`,
        ),
      );
    scheduler.start();
    await configWatch.start();
  });
}

start();
