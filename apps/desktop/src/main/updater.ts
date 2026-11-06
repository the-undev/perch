// electron-updater behind the three calls the update flow makes, so the app state is tested with a
// fake. The feed is the-undev/perch's GitHub releases, read through the latest-linux.yml each
// release carries. Nothing downloads by itself: the app state asks.

import electronUpdater, { type ProgressInfo } from "electron-updater";

/** The self-update the app state drives. */
export interface Updater {
  /**
   * Downloads the newest release the feed names, telling its progress in bytes, and resolves with
   * its version once it is whole and verified; rejects, keeping nothing, on any failure.
   */
  download(
    onProgress: (transferred: number, total: number) => void,
  ): Promise<{ version: string }>;
  /** Whether quitting replaces the image with a finished download. */
  installOnQuit(on: boolean): void;
  /** Replaces the image with the download, then quits and starts the new image with the arguments; throws when the image was not replaced. */
  restart(args: string[]): void;
}

export interface ElectronUpdaterDeps {
  /** The running AppImage; null when run from source, when nothing is ever downloaded. */
  image: string | null;
  /** Starts a program once the app has quit. */
  relaunch: (execPath: string, args: string[]) => void;
  /** Told what electron-updater logs as an error, which it also reports through its calls. */
  warn: (message: string) => void;
}

export function createElectronUpdater(deps: ElectronUpdaterDeps): Updater {
  const updater = new electronUpdater.AppImageUpdater({
    provider: "github",
    owner: "the-undev",
    repo: "perch",
  });
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = true;
  updater.allowPrerelease = false;
  // An image named with its version is replaced by one named with the new version.
  let destination = deps.image;
  updater.on("appimage-filename-updated", (path: string) => {
    destination = path;
  });
  // electron-updater emits every failure as an error event too; one without a listener would throw.
  updater.on("error", (error: Error) => deps.warn(error.message));

  return {
    async download(onProgress) {
      const listener = (progress: ProgressInfo) =>
        onProgress(progress.transferred, progress.total);
      updater.on("download-progress", listener);
      try {
        const result = await updater.checkForUpdates();
        if (result === null || !result.isUpdateAvailable) {
          throw new Error("the update feed names no newer release");
        }
        await updater.downloadUpdate();
        return { version: result.updateInfo.version };
      } finally {
        updater.off("download-progress", listener);
      }
    },
    installOnQuit(on) {
      updater.autoInstallOnAppQuit = on;
    },
    restart(args) {
      let failure: Error | null = null;
      const onError = (error: Error) => {
        failure = error;
      };
      updater.on("error", onError);
      // Silent and without running it: the new image is started below, with the window's arguments.
      updater.quitAndInstall(true, false);
      updater.off("error", onError);
      if (failure !== null) throw failure;
      if (destination === null) throw new Error("there is no image to start");
      deps.relaunch(destination, args);
    },
  };
}
