import type { Config } from "@perch/core/config.ts";
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
    const { fake } = renderApp({ ...idle(null), noConfig: true });

    expect(await screen.findByRole("main", { name: "perch" })).toBeDefined();
    expect(screen.getByText("~/.config/perch/config.toml")).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Write a starter config" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));

    expect(fake.starterWrites).toBe(1);
    expect(fake.rescans).toBe(1);
  });

  it("says why the starter config was not written, then leaves for the first scan once a config is found", async () => {
    const { fake } = renderApp({ ...idle(null), noConfig: true });
    await screen.findByRole("main", { name: "perch" });

    act(() =>
      fake.push({
        ...idle(null),
        noConfig: true,
        problems: [
          "The starter config was not written: /home/owner/.config/perch/config.toml already exists",
        ],
      }),
    );
    expect(
      await screen.findByText(
        "The starter config was not written: /home/owner/.config/perch/config.toml already exists",
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
        formFor: (birdId: string) => entryFormFor(config, item(birdId)),
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
      fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
        target: { value: "Hello" },
      });
      fireEvent.click(
        within(screen.getByRole("form", { name: "Adopt hello" })).getByRole(
          "button",
          { name: "Adopt" },
        ),
      );

      expect(fake.entrySaves).toEqual([
        {
          birdId: "dev/odin/hello",
          values: {
            wire: "Machine & Home",
            name: "Hello",
            importance: null,
            expect: [],
            keyFiles: null,
            roadmaps: null,
            thresholds: {},
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
        await screen.findByRole("button", { name: "Edit entry" }),
      ).toBeDefined();
      expect(screen.getByTitle("Machine & Home, as a tab row")).toBeDefined();
      expect(
        screen.getByRole("article", { name: "Hello in full" }),
      ).toBeDefined();
    });

    it("edits an adopted bird's entry, and unadopts it", async () => {
      const holder = configHolder();
      const { fake } = renderApp(
        idle(mockAviary),
        "/bird/dev/perch",
        undefined,
        holder.formFor,
      );

      fireEvent.click(
        await screen.findByRole("button", { name: "Edit entry" }),
      );
      fireEvent.click(screen.getByRole("checkbox", { name: "Tickets" }));
      fireEvent.change(
        screen.getByRole("spinbutton", {
          name: "Stalled flight, amber after days",
        }),
        { target: { value: "3" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(fake.entrySaves).toEqual([
        {
          birdId: "dev/perch",
          values: expect.objectContaining({
            name: "Perch",
            expect: ["ci", "tickets"],
            thresholds: { stalled_amber_days: 3 },
          }),
        },
      ]);

      fireEvent.click(screen.getByRole("button", { name: "Edit entry" }));
      fireEvent.click(screen.getByRole("button", { name: "Unadopt" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Return to the fence" }),
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

    it("gives an open entry form the wires the file now has", async () => {
      let config: Config = mockConfig;
      const formFor = (birdId: string) => {
        const item = mockSnapshot.items.find((entry) => entry.id === birdId);
        return item === undefined ? null : entryFormFor(config, item);
      };
      const { fake } = renderApp(
        idle(mockAviary),
        "/bird/dev/perch",
        undefined,
        formFor,
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Edit entry" }),
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
