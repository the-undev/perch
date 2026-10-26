import type { Config } from "@perch/core/config.ts";
import { defaultConfig } from "@perch/core/config-default.ts";
import {
  type EntryForm,
  type EntryValues,
  entryFormFor,
  withEntry,
} from "@perch/core/entry-form.ts";
import { mockAviary, mockConfig, mockSnapshot } from "@perch/core/mock.ts";
import {
  type SettingsForm,
  settingsFormFor,
} from "@perch/core/settings-form.ts";
import { type Aviary, deriveAviary } from "@perch/core/viewmodel.ts";
import { mockBird, mockHome, mockSettingsForm } from "@perch/ui/mock-birds.ts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeyFileSheet, PerchState } from "../../shared/ipc.ts";
import { fakeApi } from "./fake-api.ts";
import { createAppRouter } from "./router.tsx";

// jsdom has no scrolling; the router restores scroll position on every navigation.
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const idle = (aviary: Aviary | null): PerchState => ({
  noConfig: false,
  aviary,
  sourceCards: null,
  scanning: false,
  problems: [],
});

function renderApp(
  initial: PerchState,
  path = "/",
  sheetsFor?: (birdId: string) => KeyFileSheet[],
  formFor?: (birdId: string) => EntryForm | null,
  settings: SettingsForm | null = null,
) {
  const fake = fakeApi(initial, sheetsFor, formFor, settings);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createAppRouter(
    { api: fake.api, queryClient },
    createMemoryHistory({ initialEntries: [path] }),
  );
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { fake, router, container };
}

function birdButton(id: string): Promise<HTMLElement> {
  const bird = mockBird(id);
  return screen.findByRole("button", {
    name: `${bird.name}, ${bird.bubble.stateWord}`,
  });
}

const pathOf = (router: ReturnType<typeof renderApp>["router"]) =>
  router.state.location.pathname;

describe("the window", () => {
  it("says the first scan is running, then perches the aviary the scan pushes", async () => {
    const { fake } = renderApp({
      noConfig: false,
      aviary: null,
      sourceCards: null,
      scanning: true,
      problems: [],
    });

    expect((await screen.findByRole("status")).textContent).toBe(
      "First scan running",
    );
    act(() => fake.push(idle(mockAviary)));

    expect(await birdButton("undev/skiff")).toBeDefined();
  });

  it("welcomes the owner without a config, naming its path, and hands both buttons to the main process", async () => {
    const { fake, router } = renderApp({ ...idle(null), noConfig: true });

    expect(await screen.findByRole("main", { name: "perch" })).toBeDefined();
    expect(screen.getByText("~/.config/perch/config.toml")).toBeDefined();
    expect(
      screen.getByText(/one wire, the standard windows and no sources yet/),
    ).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();

    fake.starterWritten = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Create the config file" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await act(async () => {});

    expect(fake.starterWrites).toBe(1);
    expect(fake.rescans).toBe(1);
    expect(pathOf(router)).toBe("/");
  });

  it("lands on the settings page's sources once the config file is created", async () => {
    const { fake, router } = renderApp(
      { ...idle(null), noConfig: true },
      "/",
      undefined,
      undefined,
      settingsFormFor(defaultConfig(), mockHome),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Create the config file" }),
    );
    await waitFor(() => expect(pathOf(router)).toBe("/settings"));
    expect(fake.starterWrites).toBe(1);
    act(() => fake.push({ ...idle(null), scanning: true }));

    expect(
      await screen.findByRole("region", { name: "Sources" }),
    ).toBeDefined();
    expect(screen.getByText("Nowhere to look yet")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Add Local folders" }),
    ).toBeDefined();
  });

  it("says why the config file was not created, then leaves for the first scan once a config is found", async () => {
    const { fake } = renderApp({ ...idle(null), noConfig: true });
    await screen.findByRole("main", { name: "perch" });

    act(() =>
      fake.push({
        ...idle(null),
        noConfig: true,
        problems: [
          "The config file was not created: /home/owner/.config/perch/config.toml already exists",
        ],
      }),
    );
    expect(
      await screen.findByText(
        "The config file was not created: /home/owner/.config/perch/config.toml already exists",
      ),
    ).toBeDefined();

    act(() => fake.push({ ...idle(null), scanning: true }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "First scan running",
    );
  });

  it("takes a later scan in place, without remounting the scene", async () => {
    const { fake, container } = renderApp(idle(mockAviary));
    await birdButton("undev/skiff");
    const camera = container.querySelector("[data-phase]");

    act(() =>
      fake.push({
        noConfig: false,
        aviary: { ...mockAviary, scannedAt: "2026-10-21T08:00:00.000Z" },
        sourceCards: null,
        scanning: true,
        problems: [],
      }),
    );

    expect((await screen.findByRole("status")).textContent).toBe("scanning");
    expect(container.querySelector("[data-phase]")).toBe(camera);
  });

  it("puts the main process's problems in the sky beside the scan's warnings", async () => {
    renderApp({
      noConfig: false,
      aviary: mockAviary,
      sourceCards: null,
      scanning: false,
      problems: [
        "config: wires must be a table; the config read before stands",
      ],
    });

    expect(
      await screen.findByText(
        "config: wires must be a table; the config read before stands",
      ),
    ).toBeDefined();
  });

  it("moves the URL to a bird opened from its bubble", async () => {
    const { router } = renderApp(idle(mockAviary));

    fireEvent.click(await birdButton("undev/skiff"));
    fireEvent.click(
      screen.getByRole("button", { name: "Tell me the full story" }),
    );

    await waitFor(() => expect(pathOf(router)).toBe("/bird/undev/skiff"));
    expect(
      screen.getByRole("article", { name: "Skiff in full" }),
    ).toBeDefined();
  });

  it("rides to a fence bird's page with its papers unfolded from its bubble's adopt key", async () => {
    const { router } = renderApp(idle(mockAviary), "/", undefined, (birdId) => {
      const item = mockSnapshot.items.find((entry) => entry.id === birdId);
      return item === undefined
        ? null
        : entryFormFor(mockConfig, item, mockHome);
    });

    fireEvent.click(await birdButton("dev/odin/hello"));
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));

    await waitFor(() => expect(pathOf(router)).toBe("/bird/dev/odin/hello"));
    expect(router.state.location.search).toEqual({ papers: true });
    expect(
      await screen.findByRole("form", { name: "Adoption papers for hello" }),
    ).toBeDefined();
  });

  it("unfolds the papers where the URL asks", async () => {
    renderApp(
      idle(mockAviary),
      "/bird/dev/perch?papers=true",
      undefined,
      (birdId) => {
        const item = mockSnapshot.items.find((entry) => entry.id === birdId);
        return item === undefined
          ? null
          : entryFormFor(mockConfig, item, mockHome);
      },
    );

    expect(
      await screen.findByRole("form", { name: "Adoption papers for Perch" }),
    ).toBeDefined();
  });

  it("points the camera where the URL says, and rides home on Escape", async () => {
    const { router } = renderApp(idle(mockAviary), "/bird/dev/perch");

    expect(
      await screen.findByRole("article", { name: "Perch in full" }),
    ).toBeDefined();
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(pathOf(router)).toBe("/"));
  });

  it("follows the router to a bird it is sent to", async () => {
    const { router } = renderApp(idle(mockAviary));
    await birdButton("undev/skiff");

    await act(() =>
      router.navigate({ to: "/bird/$", params: { _splat: "undev/spool" } }),
    );

    expect(
      await screen.findByRole("article", { name: "Spool in full" }),
    ).toBeDefined();
  });

  it("reads the open bird's key files into its detail", async () => {
    const { fake } = renderApp(idle(mockAviary), "/bird/dev/perch", (birdId) =>
      mockBird(birdId).detail.keyFiles.map((file) => ({
        file,
        markdown: file.path === "README.md" ? "# Hello from the readme" : null,
      })),
    );

    expect(
      await screen.findByRole("heading", { name: "Hello from the readme" }),
    ).toBeDefined();
    expect(fake.keyFileReads).toEqual(["dev/perch"]);
  });

  it("hands launch actions and rescans to the main process", async () => {
    const { fake } = renderApp(idle(mockAviary), "/bird/dev/perch");

    fireEvent.click(
      await screen.findByRole("button", { name: /^Open in VS Code/ }),
    );
    fireEvent.click(screen.getByTitle("Scan now"));

    expect(fake.launches).toEqual([
      {
        kind: "vscode",
        verb: "Open in VS Code",
        path: "/home/owner/dev/perch",
      },
    ]);
    expect(fake.rescans).toBe(1);
  });

  it("follows the clock while the window stays open", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date(2026, 9, 22, 20, 59, 30));
    const { container } = renderApp(idle(mockAviary));
    await birdButton("undev/skiff");

    expect(
      container.querySelector("[data-phase]")?.getAttribute("data-phase"),
    ).toBe("dusk");
    act(() => vi.advanceTimersByTime(60_000));

    expect(
      container.querySelector("[data-phase]")?.getAttribute("data-phase"),
    ).toBe("night");
  });

  describe("config entries", () => {
    /** The config the fake main process holds, which a save changes as the real one would. */
    function configHolder() {
      let config: Config = mockConfig;
      const item = (birdId: string) => {
        const found = mockSnapshot.items.find((entry) => entry.id === birdId);
        if (found === undefined) throw new Error(`no item ${birdId}`);
        return found;
      };
      return {
        formFor: (birdId: string) =>
          entryFormFor(config, item(birdId), mockHome),
        save: (birdId: string, values: EntryValues) => {
          config = withEntry(config, item(birdId), values);
          return idle(deriveAviary(mockSnapshot, config));
        },
      };
    }

    it("adopts a fence bird from its detail page onto the wire picked", async () => {
      const holder = configHolder();
      const { fake } = renderApp(
        idle(mockAviary),
        "/bird/dev/odin/hello",
        undefined,
        holder.formFor,
      );

      fireEvent.click(await screen.findByRole("button", { name: "Adopt" }));
      fireEvent.click(screen.getByRole("radio", { name: "Machine & Home" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Goes by" }), {
        target: { value: "Hello" },
      });
      fireEvent.click(
        within(
          screen.getByRole("form", { name: "Adoption papers for hello" }),
        ).getByRole("button", { name: "Adopt onto Machine & Home" }),
      );

      expect(fake.entrySaves).toEqual([
        {
          birdId: "dev/odin/hello",
          values: {
            wire: "Machine & Home",
            name: "Hello",
            expect: [],
            keyFiles: null,
            roadmaps: null,
            thresholds: {},
            zellijSession: null,
          },
        },
      ]);
      act(() =>
        fake.push(
          holder.save(
            "dev/odin/hello",
            fake.entrySaves[0]?.values as EntryValues,
          ),
        ),
      );

      expect(
        await screen.findByRole("button", { name: "The papers" }),
      ).toBeDefined();
      await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
      expect(screen.getByTitle("Machine & Home, as a tab row")).toBeDefined();
      expect(
        screen.getByRole("article", { name: "Hello in full" }),
      ).toBeDefined();
    });

    it("amends an adopted bird's papers, shows a refusal on them, and returns it to the fence", async () => {
      const holder = configHolder();
      const { fake } = renderApp(
        idle(mockAviary),
        "/bird/dev/perch",
        undefined,
        holder.formFor,
      );

      fireEvent.click(
        await screen.findByRole("button", { name: "The papers" }),
      );
      fireEvent.click(screen.getByRole("checkbox", { name: /^ci/ }));
      fireEvent.click(
        screen.getByRole("button", { name: /^More particulars/ }),
      );
      fireEvent.change(
        screen.getByRole("spinbutton", {
          name: "Stalled flight, amber after days",
        }),
        { target: { value: "3" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Amend the papers" }));

      expect(fake.entrySaves).toEqual([
        {
          birdId: "dev/perch",
          values: expect.objectContaining({
            name: "Perch",
            expect: [],
            thresholds: { stalled_amber_days: 3 },
          }),
        },
      ]);
      act(() =>
        fake.push({
          ...idle(mockAviary),
          problems: ["The config was not changed: the disk is read-only"],
        }),
      );
      expect((await screen.findByRole("alert")).textContent).toBe(
        "The config was not changed: the disk is read-only",
      );

      fireEvent.click(
        screen.getByRole("button", { name: "Return to the fence" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Return it to the fence" }),
      );
      expect(fake.entryRemovals).toEqual(["dev/perch"]);
    });
  });

  describe("settings", () => {
    it("opens from the camera header at its own route, and rides home on Escape", async () => {
      const { router } = renderApp(
        idle(mockAviary),
        "/bird/dev/perch",
        undefined,
        undefined,
        mockSettingsForm(),
      );

      fireEvent.click(await screen.findByRole("button", { name: "settings" }));

      await waitFor(() => expect(pathOf(router)).toBe("/settings"));
      expect(
        await screen.findByRole("form", { name: "Settings" }),
      ).toBeDefined();
      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => expect(pathOf(router)).toBe("/"));
      expect(await birdButton("undev/skiff")).toBeDefined();
    });

    it("saves an edit through the main process, and shows a refusal among the problems", async () => {
      const form = mockSettingsForm();
      const { fake } = renderApp(
        idle(mockAviary),
        "/settings",
        undefined,
        undefined,
        form,
      );

      fireEvent.click(
        await screen.findByRole("button", { name: "Joining up" }),
      );
      fireEvent.change(
        await screen.findByRole("textbox", { name: "Add an ignored presence" }),
        { target: { value: "github:a/old" } },
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Add the ignored presence" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(fake.settingsSaves).toEqual([
        { ...form.values, ignore: [...form.values.ignore, "github:a/old"] },
      ]);
      act(() =>
        fake.push({
          ...idle(mockAviary),
          problems: ["The config was not changed: Wires: each wire once"],
        }),
      );
      expect(
        await screen.findByText(
          "The config was not changed: Wires: each wire once",
        ),
      ).toBeDefined();
    });

    it("opens on the sources, each card with its pushed scan record, and saves a source added", async () => {
      const form = mockSettingsForm();
      const { fake } = renderApp(
        { ...idle(mockAviary), sourceCards: mockSnapshot.sourceCards },
        "/settings",
        undefined,
        undefined,
        form,
      );

      const kuma = await screen.findByRole("region", {
        name: "Uptime Kuma · Silo",
      });
      expect(within(kuma).getByText("never scanned yet")).toBeDefined();
      expect(
        within(
          screen.getByRole("region", { name: "GitHub · finch" }),
        ).getByText(/^read 5 repositories · /),
      ).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
      fireEvent.click(screen.getByRole("button", { name: "Add Uptime Kuma" }));
      const added = within(screen.getByRole("region", { name: "Uptime Kuma" }));
      fireEvent.change(added.getByRole("textbox", { name: "Name" }), {
        target: { value: "Server" },
      });
      fireEvent.change(added.getByRole("textbox", { name: "Status page" }), {
        target: { value: "server" },
      });
      fireEvent.change(added.getByRole("textbox", { name: "Base URL" }), {
        target: { value: "http://kuma.example.lan:3001" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(fake.settingsSaves).toEqual([
        {
          ...form.values,
          sources: {
            ...form.values.sources,
            kuma: [
              ...form.values.sources.kuma,
              {
                name: "Server",
                baseUrl: "http://kuma.example.lan:3001",
                statusPage: "server",
              },
            ],
          },
        },
      ]);
    });

    it("stores a forge card's token and tests its connection through the main process", async () => {
      const { fake } = renderApp(
        { ...idle(mockAviary), sourceCards: mockSnapshot.sourceCards },
        "/settings",
        undefined,
        undefined,
        mockSettingsForm(),
      );
      fake.sourceTested = { ok: true, count: 5 };
      const github = within(
        await screen.findByRole("region", { name: "GitHub · finch" }),
      );
      fireEvent.click(
        github.getByRole("button", { name: "GitHub · finch" }),
      );

      fireEvent.change(github.getByLabelText("Token"), {
        target: { value: "github_pat_11ABC" },
      });
      fireEvent.click(
        github.getByRole("button", { name: "Store in the keyring" }),
      );
      expect(
        await github.findByText("stored in the keyring under github-finch"),
      ).toBeDefined();
      fireEvent.click(github.getByRole("button", { name: "Test" }));

      expect(
        await github.findByText("finch: 5 repositories readable"),
      ).toBeDefined();
      expect(fake.tokenStores).toEqual([
        { key: "github-finch", token: "github_pat_11ABC" },
      ]);
      expect(fake.sourceTests).toEqual([
        { kind: "github", account: "finch", key: "github-finch" },
      ]);
    });

    it("shows the file's new values when it changes on disk", async () => {
      const { fake } = renderApp(
        idle(mockAviary),
        "/settings",
        undefined,
        undefined,
        mockSettingsForm(),
      );
      const interval = async () =>
        (
          (await screen.findByRole("spinbutton", {
            name: "Scan interval in minutes",
          })) as HTMLInputElement
        ).value;
      fireEvent.click(await screen.findByRole("button", { name: "Scanning" }));
      expect(await interval()).toBe("15");

      fake.setSettings(
        settingsFormFor(
          { ...mockConfig, scan: { ...mockConfig.scan, intervalMinutes: 20 } },
          mockHome,
        ),
      );
      act(() => fake.push(idle(mockAviary)));

      await waitFor(async () => expect(await interval()).toBe("20"));
    });

    it("gives open papers the wires the file now has", async () => {
      let config: Config = mockConfig;
      const formFor = (birdId: string) => {
        const item = mockSnapshot.items.find((entry) => entry.id === birdId);
        return item === undefined ? null : entryFormFor(config, item, mockHome);
      };
      const { fake } = renderApp(
        idle(mockAviary),
        "/bird/dev/perch",
        undefined,
        formFor,
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "The papers" }),
      );
      expect(screen.queryByRole("radio", { name: "Someday" })).toBeNull();

      config = {
        ...mockConfig,
        wires: {
          ...mockConfig.wires,
          names: [...mockConfig.wires.names, "Someday"],
        },
      };
      act(() => fake.push(idle(mockAviary)));

      expect(
        await screen.findByRole("radio", { name: "Someday" }),
      ).toBeDefined();
    });
  });
});
