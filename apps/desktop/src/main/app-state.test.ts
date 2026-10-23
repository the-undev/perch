import type { Config, LoadedConfig } from "@perch/core/config.ts";
import { mockConfig, mockSnapshot } from "@perch/core/mock.ts";
import type { Snapshot } from "@perch/core/snapshot.ts";
import type { LaunchAction } from "@perch/core/viewmodel.ts";
import { describe, expect, it, vi } from "vitest";
import type { PerchState } from "../shared/ipc.ts";
import { type AppStateDeps, createAppState } from "./app-state.ts";
import type { ConfigState, ConfigStore } from "./config-store.ts";

const loaded: LoadedConfig = { config: mockConfig, path: "/config.toml" };

/** A launch action the mock's Perch bird offers. */
const perchInCode: LaunchAction = {
  kind: "vscode",
  verb: "Open in VS Code",
  path: "/home/owner/dev/perch",
};

/** A config store whose next read is whatever the test sets. */
function configStore(first: ConfigState) {
  let state = first;
  let next = first;
  const store: ConfigStore = {
    reload: async () => {
      state = next;
      return state;
    },
    current: () => state,
  };
  return {
    store,
    nextRead: (value: ConfigState) => {
      next = value;
    },
  };
}

function appState(overrides: Partial<AppStateDeps> = {}) {
  const config = configStore({ loaded, error: null, missing: false });
  const published: PerchState[] = [];
  const deps: AppStateDeps = {
    config: config.store,
    readCached: async () => mockSnapshot,
    gather: vi.fn(async (_config: Config) => {}),
    aggregate: vi.fn(async (_loaded: LoadedConfig) => mockSnapshot),
    launch: vi.fn(async (_action: LaunchAction, _config: Config) => {}),
    readText: async (path) => {
      if (path.endsWith("README.md")) return "# Perch";
      throw new Error("ENOENT");
    },
    publish: (state) => published.push(state),
    ...overrides,
  };
  return { app: createAppState(deps), deps, config, published };
}

describe("the app state", () => {
  it("shows the cached snapshot's aviary before any scan", async () => {
    const { app } = appState();

    await app.start();

    expect(app.state().aviary?.scannedAt).toBe(mockSnapshot.scannedAt);
    expect(app.state().problems).toEqual([]);
  });

  it("shows no aviary until a snapshot exists", async () => {
    const { app } = appState({ readCached: async () => null });

    await app.start();

    expect(app.state().aviary).toBeNull();
  });

  it("publishes the fresh aviary when a scan finishes", async () => {
    const fresh: Snapshot = {
      ...mockSnapshot,
      scannedAt: "2026-10-22T12:00:00.000Z",
    };
    const { app, deps, published } = appState({
      aggregate: vi.fn(async () => fresh),
    });
    await app.start();

    await app.scan();

    expect(deps.gather).toHaveBeenCalledWith(mockConfig);
    expect(deps.aggregate).toHaveBeenCalledWith(loaded);
    expect(published.at(-1)?.aviary?.scannedAt).toBe(fresh.scannedAt);
  });

  it("scans with the config read before when an edit does not parse, and says so", async () => {
    const { app, deps, config, published } = appState();
    await app.start();
    config.nextRead({
      loaded,
      error: "config: wires must be a table",
      missing: false,
    });

    await app.scan();

    expect(deps.gather).toHaveBeenCalledWith(mockConfig);
    expect(published.at(-1)?.problems).toEqual([
      "config: wires must be a table; the config read before stands",
    ]);
  });

  it("neither scans nor crashes when no config has ever parsed, and says why", async () => {
    const { app, deps, config, published } = appState();
    config.nextRead({
      loaded: null,
      error: "config: wires must be a table",
      missing: false,
    });

    await app.scan();

    expect(deps.gather).not.toHaveBeenCalled();
    expect(published.at(-1)).toEqual({
      noConfig: false,
      aviary: null,
      scanning: false,
      problems: ["config: wires must be a table"],
    });
  });

  it("says there is no config, with no aviary, when the file is missing", async () => {
    const { app, deps, config, published } = appState();
    config.nextRead({ loaded: null, error: null, missing: true });
    await app.start();

    await app.scan();

    expect(deps.gather).not.toHaveBeenCalled();
    expect(published.at(-1)).toEqual({
      noConfig: true,
      aviary: null,
      scanning: false,
      problems: [],
    });
  });

  it("rechecks the config without scanning, and publishes what it found", async () => {
    const { app, deps, config, published } = appState();
    config.nextRead({ loaded: null, error: null, missing: true });
    await app.start();
    config.nextRead({ loaded, error: null, missing: false });

    await app.recheck();

    expect(deps.gather).not.toHaveBeenCalled();
    expect(published.at(-1)?.noConfig).toBe(false);
  });

  it("keeps the previous aviary when a scan fails, and says so until one succeeds", async () => {
    let failing = true;
    const { app, published } = appState({
      aggregate: vi.fn(async () => {
        if (failing) throw new Error("no raw files to aggregate");
        return mockSnapshot;
      }),
    });
    await app.start();

    await app.scan();
    expect(published.at(-1)?.aviary?.scannedAt).toBe(mockSnapshot.scannedAt);
    expect(published.at(-1)?.problems).toEqual([
      "The scan failed: no raw files to aggregate",
    ]);

    failing = false;
    await app.scan();
    expect(published.at(-1)?.problems).toEqual([]);
  });

  it("publishes whether a scan is running", async () => {
    const { app, published } = appState();
    await app.start();

    app.setScanning(true);

    expect(published.at(-1)?.scanning).toBe(true);
  });

  it("launches only an action a bird offers, with the config's commands", async () => {
    const { app, deps } = appState();
    await app.start();

    await app.launch(perchInCode);
    await app.launch({ ...perchInCode, path: "/etc" });

    expect(deps.launch).toHaveBeenCalledTimes(1);
    expect(deps.launch).toHaveBeenCalledWith(perchInCode, mockConfig);
  });

  it("says when a launch fails, until the next scan", async () => {
    const { app, published } = appState({
      launch: vi.fn(async () => {
        throw new Error("spawn code ENOENT");
      }),
    });
    await app.start();

    await app.launch(perchInCode);
    expect(published.at(-1)?.problems).toEqual([
      "Open in VS Code failed: spawn code ENOENT",
    ]);

    await app.scan();
    expect(published.at(-1)?.problems).toEqual([]);
  });

  it("reads a bird's key files, an unreadable one as null", async () => {
    const { app } = appState();
    await app.start();

    const sheets = await app.keyFiles("dev/perch");

    expect(
      sheets.map((sheet) => [sheet.file.absolutePath, sheet.markdown]),
    ).toEqual([
      ["/home/owner/dev/perch/README.md", "# Perch"],
      ["/home/owner/dev/perch/docs/spec.md", null],
      ["/home/owner/dev/perch/docs/roadmap.md", null],
    ]);
    expect(await app.keyFiles("dev/nobody")).toEqual([]);
  });
});
