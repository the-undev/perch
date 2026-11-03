import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Config,
  type LoadedConfig,
  parseConfig,
} from "@perch/core/config.ts";
import { defaultConfig } from "@perch/core/config-default.ts";
import { writeConfig } from "@perch/core/config-write.ts";
import { emptyEntryValues } from "@perch/core/entry-form.ts";
import { readTextIfExists } from "@perch/core/fs.ts";
import type { LaunchActionValues } from "@perch/core/launch-form.ts";
import { mockConfig, mockSnapshot } from "@perch/core/mock.ts";
import type { Snapshot } from "@perch/core/snapshot.ts";
import type { Aviary, LaunchAction } from "@perch/core/viewmodel.ts";
import { parse } from "smol-toml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PerchState } from "../shared/ipc.ts";
import { type AppStateDeps, createAppState } from "./app-state.ts";
import { editConfigFile, writeTextAtomic } from "./config-edit.ts";
import {
  type ConfigState,
  type ConfigStore,
  createConfigStore,
} from "./config-store.ts";

const loaded: LoadedConfig = { config: mockConfig, path: "/config.toml" };

/** A launch action the mock's Perch bird offers. */
const perchInCode: LaunchAction = {
  kind: "command",
  verb: "Open in VS Code",
  icon: "code",
  command: ["code", "{path}"],
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
    home: "/home/owner",
    config: config.store,
    configPath: "/home/owner/.config/perch/config.toml",
    readCached: async () => mockSnapshot,
    gather: vi.fn(async (_config: Config) => {}),
    aggregate: vi.fn(async (_loaded: LoadedConfig) => mockSnapshot),
    launch: vi.fn(async (_action: LaunchAction) => {}),
    readText: async (path) => {
      if (path.endsWith("README.md")) return "# Perch";
      throw new Error("ENOENT");
    },
    publish: (state) => published.push(state),
    writeStarter: vi.fn(async () => {}),
    editConfig: vi.fn(async () => {}),
    requestScan: vi.fn(async () => {}),
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

  it("carries the cached snapshot's source cards before any scan", async () => {
    const { app } = appState();

    await app.start();

    expect(app.state().sourceCards).toEqual(mockSnapshot.sourceCards);
  });

  it("publishes the fresh snapshot's source cards when a scan finishes", async () => {
    const fresh: Snapshot = {
      ...mockSnapshot,
      sourceCards: [
        {
          id: "kuma:Silo",
          kind: "kuma",
          label: "Silo",
          result: {
            state: "ok",
            at: "2026-10-22T12:00:00.000Z",
            count: 3,
            missingIncludes: [],
          },
        },
      ],
    };
    const { app, published } = appState({
      aggregate: vi.fn(async () => fresh),
    });
    await app.start();

    await app.scan();

    expect(published.at(-1)?.sourceCards).toEqual(fresh.sourceCards);
  });

  it("has no source cards from a snapshot cached before they existed", async () => {
    const { sourceCards: _cards, ...older } = mockSnapshot;
    const { app } = appState({
      readCached: async () => older as Snapshot,
    });

    await app.start();

    expect(app.state().sourceCards).toBeNull();
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
      sourceCards: null,
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
      sourceCards: null,
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

  it("launches only an action a bird offers, its commands and directory included", async () => {
    const { app, deps } = appState();
    await app.start();

    await app.launch(perchInCode);
    await app.launch({ ...perchInCode, path: "/etc" });
    await app.launch({ ...perchInCode, command: ["rm", "-rf", "{path}"] });

    expect(deps.launch).toHaveBeenCalledTimes(1);
    expect(deps.launch).toHaveBeenCalledWith(perchInCode);
  });

  it("launches nothing before a config is read", async () => {
    const { app, deps, config } = appState();
    await app.start();
    config.nextRead({ loaded: null, error: null, missing: true });
    await app.recheck();

    await app.launch(perchInCode);

    expect(deps.launch).not.toHaveBeenCalled();
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

  it("opens the config file by config's launch actions, through no bird, and says when that fails", async () => {
    const { app, deps, published } = appState();
    await app.start();
    vi.mocked(deps.launch).mockRejectedValueOnce(
      new Error("spawn code ENOENT"),
    );

    await app.openConfig();

    expect(deps.launch).toHaveBeenCalledWith({
      kind: "command",
      verb: "Open the config file",
      icon: "code",
      command: ["code", "{path}"],
      path: "/home/owner/.config/perch/config.toml",
    });
    expect(published.at(-1)?.problems).toEqual([
      "Open the config file failed: spawn code ENOENT",
    ]);
  });

  it("opens the config file's directory when no config has ever parsed", async () => {
    const { app, deps, config } = appState();
    config.nextRead({
      loaded: null,
      error: "config: wires must be a table",
      missing: false,
    });
    await app.start();

    await app.openConfig();

    expect(deps.launch).toHaveBeenCalledWith({
      kind: "command",
      verb: "Open the config file",
      icon: "folder",
      command: ["xdg-open", "{path}"],
      path: "/home/owner/.config/perch",
    });
  });

  it("writes the starter config, saying so", async () => {
    const { app, deps, published } = appState();
    await app.start();

    expect(await app.writeStarterConfig()).toBe(true);

    expect(deps.writeStarter).toHaveBeenCalledTimes(1);
    expect(published.at(-1)?.problems).toEqual([]);
    expect(deps.requestScan).toHaveBeenCalledTimes(1);
  });

  it("says why the config file was not created, until the next scan", async () => {
    const { app, published } = appState({
      writeStarter: vi.fn(async () => {
        throw new Error("/home/owner/.config/perch/config.toml already exists");
      }),
    });
    await app.start();

    expect(await app.writeStarterConfig()).toBe(false);
    expect(published.at(-1)?.problems).toEqual([
      "The config file was not created: /home/owner/.config/perch/config.toml already exists",
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

describe("editing config entries", () => {
  const home = "/home/owner";
  let dir: string;
  let configPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "perch-entries-"));
    configPath = join(dir, "config.toml");
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** The app state on a real config file in the temp directory, holding the given config. */
  async function onFile(config: Config) {
    await writeFile(configPath, writeConfig(config, home));
    const store = createConfigStore({
      home,
      path: configPath,
      readText: readTextIfExists,
    });
    const file = { home, path: configPath, readText: readTextIfExists };
    return appState({
      config: store,
      editConfig: (edit) =>
        editConfigFile({ ...file, writeText: writeTextAtomic }, edit),
    });
  }

  const written = async () => readFile(configPath, "utf8");
  const writtenConfig = async () => parseConfig(await written(), home);

  function wireOf(aviary: Aviary | null | undefined, birdId: string) {
    if (aviary === null || aviary === undefined) return undefined;
    if (aviary.fence.birds.some((bird) => bird.id === birdId)) return "fence";
    return aviary.wires.find((wire) =>
      wire.birds.some((bird) => bird.id === birdId),
    )?.name;
  }

  /** The mock config with Perch's entry keyed by its GitHub reference instead of its id. */
  function forgeKeyed(): Config {
    const { "dev/perch": perch, ...rest } = mockConfig.items;
    if (perch === undefined) throw new Error("the mock config has no Perch");
    return {
      ...mockConfig,
      items: { ...rest, "github:finch/perch": perch },
    };
  }

  it("adopts a fence bird: writes its entry and nothing else, perches it and rescans", async () => {
    const { app, deps, published } = await onFile(mockConfig);
    const before = await written();
    await app.start();

    await app.saveEntry("dev/odin/hello", {
      ...emptyEntryValues(),
      wire: "Machine & Home",
      name: "Hello",
    });

    const after = await written();
    const block =
      '[items."dev/odin/hello"]\nwire = "Machine & Home"\nname = "Hello"\n\n';
    expect(after).toContain(block);
    expect(after.replace(block, "")).toBe(before);
    expect(wireOf(published.at(-1)?.aviary, "dev/odin/hello")).toBe(
      "Machine & Home",
    );
    expect(deps.requestScan).toHaveBeenCalledTimes(1);
  });

  it("edits a forge-keyed entry under that key, without a second entry", async () => {
    const { app } = await onFile(forgeKeyed());
    await app.start();
    const form = app.entryForm("dev/perch");
    if (form?.values == null) throw new Error("Perch has no entry");

    await app.saveEntry("dev/perch", {
      ...form.values,
      wire: "Machine & Home",
      thresholds: { stalled_amber_days: 3 },
    });

    const config = await writtenConfig();
    expect(Object.keys(config.items)).toEqual(
      Object.keys(forgeKeyed().items).sort(),
    );
    expect(config.items["github:finch/perch"]).toMatchObject({
      name: "Perch",
      wire: "Machine & Home",
      thresholds: { stalled: { amberDays: 3 } },
    });
    expect(app.entryForm("dev/perch")?.key).toBe("github:finch/perch");
  });

  it("unadopts a bird: removes its entry and returns it to the fence", async () => {
    const { app, deps, published } = await onFile(mockConfig);
    await app.start();

    await app.removeEntry("undev/spool");

    expect((await writtenConfig()).items["undev/spool"]).toBeUndefined();
    expect(wireOf(published.at(-1)?.aviary, "undev/spool")).toBe("fence");
    expect(deps.requestScan).toHaveBeenCalledTimes(1);
  });

  it("says why nothing was written, without scanning, until the next scan", async () => {
    const { app, deps, published } = await onFile(mockConfig);
    await app.start();
    const before = await written();

    await app.saveEntry("dev/perch", {
      ...emptyEntryValues(),
      thresholds: { stalled_amber_days: 30 },
    });

    expect(await written()).toBe(before);
    expect(published.at(-1)?.problems).toEqual([
      'The config was not changed: config: items."dev/perch".stalled amber threshold must be below its red threshold',
    ]);
    expect(deps.requestScan).not.toHaveBeenCalled();

    await rm(configPath);
    await app.removeEntry("dev/perch");
    expect(published.at(-1)?.problems).toEqual([
      `The config was not changed: ${configPath} does not exist`,
    ]);

    await writeFile(configPath, before);
    await app.scan();
    expect(published.at(-1)?.problems).toEqual([]);
  });

  it("writes nothing for a bird the aviary does not hold", async () => {
    const { app, deps } = await onFile(mockConfig);
    await app.start();
    const before = await written();

    await app.saveEntry("dev/nobody", emptyEntryValues());
    await app.removeEntry("server");

    expect(await written()).toBe(before);
    expect(deps.requestScan).not.toHaveBeenCalled();
    expect(app.entryForm("dev/nobody")).toBeNull();
  });
});

describe("the settings", () => {
  const home = "/home/owner";
  let dir: string;
  let configPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "perch-settings-"));
    configPath = join(dir, "config.toml");
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** The starter config file the app writes. */
  const starter = () => writeConfig(defaultConfig(), home);

  /** The app state on a real config file in the temp directory holding the text. */
  async function onText(text: string) {
    await writeFile(configPath, text);
    const file = { home, path: configPath, readText: readTextIfExists };
    const app = appState({
      config: createConfigStore(file),
      editConfig: (edit) =>
        editConfigFile({ ...file, writeText: writeTextAtomic }, edit),
    });
    await app.app.start();
    return app;
  }

  const written = async () => readFile(configPath, "utf8");

  function formOf(app: ReturnType<typeof appState>["app"]) {
    const form = app.settingsForm();
    if (form === null) throw new Error("no settings form");
    return form;
  }

  it("saves the starter unchanged, the same bytes every time", async () => {
    const { app } = await onText(starter());

    await app.saveSettings(formOf(app).values);
    const first = await written();
    await app.saveSettings(formOf(app).values);

    expect(first).toBe(starter());
    expect(await written()).toBe(first);
  });

  it("adds a zellij action writing only what differs, a session root under ~, rereads the config and asks for a scan", async () => {
    const { app, deps, published } = await onText(starter());
    const { values } = formOf(app);
    const zellij: LaunchActionValues = {
      kind: "zellij",
      verb: "",
      zellij: "",
      terminal: '["kitty", "{cwd}", "{session}"]',
      session: "",
      sessions: [{ root: "~/work", session: "work" }],
    };

    await app.saveSettings({ ...values, launch: { actions: [zellij] } });

    expect(parse(await written()).launch).toEqual({
      actions: [
        {
          kind: "zellij",
          terminal: ["kitty", "{cwd}", "{session}"],
          sessions: { "~/work": "work" },
        },
      ],
    });
    expect(formOf(app).values.launch.actions).toEqual([zellij]);
    expect(published.at(-1)?.problems).toEqual([]);
    expect(deps.requestScan).toHaveBeenCalledTimes(1);
  });

  it("says why nothing was written, without scanning", async () => {
    const { app, deps, published } = await onText(
      writeConfig(mockConfig, home),
    );
    const before = await written();
    const { values } = formOf(app);

    await app.saveSettings({
      ...values,
      wires: { rows: [{ from: "Projects", name: "Projects" }], defaultRow: 1 },
    });

    expect(await written()).toBe(before);
    expect(published.at(-1)?.problems).toEqual([
      "The config was not changed: Wires: the default wire must be one of the wires",
    ]);
    expect(deps.requestScan).not.toHaveBeenCalled();
  });

  it("has no settings form without a config", async () => {
    const { app } = appState({
      config: configStore({ loaded: null, error: null, missing: true }).store,
    });

    await app.start();

    expect(app.settingsForm()).toBeNull();
  });
});
