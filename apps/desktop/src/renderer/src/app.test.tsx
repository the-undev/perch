import type { Config } from "@perch/core/config.ts";
import { defaultConfig } from "@perch/core/config-default.ts";
import {
  type EntryForm,
  type EntryValues,
  entryFormFor,
  withEntry,
} from "@perch/core/entry-form.ts";
import {
  mockAviary,
  mockConfig,
  mockImage,
  mockLogin,
  mockSnapshot,
  mockUpdates,
} from "@perch/core/mock.ts";
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KeyFileSheet, PerchState } from "../../shared/ipc.ts";
import { fakeApi } from "./fake-api.ts";
import { createAppRouter } from "./router.tsx";

// jsdom has no scrolling; the router restores scroll position on every navigation, and a chip's
// landing scrolls its ledger row into view.
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

/** The chip whose ledger row is marked by a landing; undefined when none is. */
function markedRow(container: HTMLElement): string | null | undefined {
  return container
    .querySelector('[data-part="landing"]')
    ?.parentElement?.getAttribute("data-chip");
}

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
  update: mockUpdates.noCheck,
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
      update: mockUpdates.noCheck,
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
      screen.getByText(/one wire, the default thresholds and no sources yet/),
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
      settingsFormFor(defaultConfig(), mockHome, mockLogin, mockImage),
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
    expect(screen.getByText("No sources yet")).toBeDefined();
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
        update: mockUpdates.noCheck,
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
      update: mockUpdates.noCheck,
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

  it("folds open papers on Escape from the verb's focus without leaving the page, and rides home on the next", async () => {
    const { router } = renderApp(
      idle(mockAviary),
      "/bird/dev/perch",
      undefined,
      (birdId) => {
        const item = mockSnapshot.items.find((entry) => entry.id === birdId);
        return item === undefined
          ? null
          : entryFormFor(mockConfig, item, mockHome);
      },
    );
    const verb = await screen.findByRole("button", { name: "The papers" });
    verb.focus();
    fireEvent.click(verb);
    await screen.findByRole("form", { name: "Adoption papers for Perch" });

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    await waitFor(() =>
      expect(
        screen.queryByRole("form", { name: "Adoption papers for Perch" }),
      ).toBeNull(),
    );
    expect(pathOf(router)).toBe("/bird/dev/perch");
    expect(document.activeElement).toBe(verb);

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    await waitFor(() => expect(pathOf(router)).toBe("/"));
  });

  it("rides to a bird's page from a chip in its bubble, landing on the chip's row", async () => {
    const { router, container } = renderApp(idle(mockAviary));

    fireEvent.click(await birdButton("undev/prism"));
    fireEvent.click(screen.getByRole("button", { name: "ci failure" }));

    await waitFor(() => expect(pathOf(router)).toBe("/bird/undev/prism"));
    expect(router.state.location.search).toEqual({ chip: "ci" });
    expect(
      await screen.findByRole("article", { name: "Prism in full" }),
    ).toBeDefined();
    expect(markedRow(container)).toBe("ci");
  });

  it("lands on the row the URL's chip names", async () => {
    const { container } = renderApp(
      idle(mockAviary),
      "/bird/dev/perch?chip=pull-requests",
    );

    expect(
      await screen.findByRole("article", { name: "Perch in full" }),
    ).toBeDefined();
    expect(markedRow(container)).toBe("pull-requests");
  });

  it("reads a chip the URL names that is no chip as none, keeping the papers", async () => {
    const { router, container } = renderApp(
      idle(mockAviary),
      "/bird/dev/perch?chip=wings&papers=true",
    );

    expect(
      await screen.findByRole("article", { name: "Perch in full" }),
    ).toBeDefined();
    expect(router.state.matches.at(-1)?.search).toEqual({ papers: true });
    expect(markedRow(container)).toBeUndefined();
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
        kind: "command",
        verb: "Open in VS Code",
        icon: "code",
        command: ["code", "{path}"],
        path: "/home/owner/dev/perch",
      },
    ]);
    expect(fake.rescans).toBe(1);
  });

  it("puts a no-clone slip's address on the clipboard in the window, which stays on the bird", async () => {
    const copied: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          copied.push(text);
        },
      },
    });
    const { router } = renderApp(
      idle(mockAviary),
      "/bird/forgejo:finch/field-notes",
    );

    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));

    expect(await screen.findByRole("button", { name: "Copied" })).toBeDefined();
    expect(copied).toEqual(["ssh://git@forgejo:2222/finch/field-notes.git"]);
    expect(pathOf(router)).toBe("/bird/forgejo:finch/field-notes");
    Reflect.deleteProperty(navigator, "clipboard");
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

  describe("the pan between birds", () => {
    // The setup's animations never finish; these tests end the ground's pan on cue.
    const stillAnimate = Element.prototype.animate;
    const panEnds: (() => void)[] = [];
    beforeEach(() => {
      panEnds.length = 0;
      Element.prototype.animate = function animate(this: Element) {
        const finished = new Promise<void>((resolve) => {
          if (this.getAttribute("data-part") === "pan-track") {
            panEnds.push(resolve);
          }
        });
        return { finished, cancel: () => {} } as unknown as Animation;
      };
    });
    afterEach(() => {
      Element.prototype.animate = stillAnimate;
    });

    async function settlePan() {
      await act(async () => {
        panEnds.at(-1)?.();
      });
    }

    const pages = (container: HTMLElement) =>
      [...container.querySelectorAll("[data-page]")].map((page) =>
        page.getAttribute("data-page"),
      );

    function entryForms(birdId: string): EntryForm | null {
      const item = mockSnapshot.items.find((entry) => entry.id === birdId);
      return item === undefined
        ? null
        : entryFormFor(mockConfig, item, mockHome);
    }

    it("pans the ground to a wire-mate pressed in the strip, the page left keeping its key files, leaving one page once it settles", async () => {
      const { router, container } = renderApp(
        idle(mockAviary),
        "/bird/undev/skiff",
        (birdId) =>
          mockBird(birdId).detail.keyFiles.map((file) => ({
            file,
            markdown: `# Read from ${birdId}`,
          })),
      );
      await screen.findByRole("heading", { name: "Read from undev/skiff" });

      fireEvent.click(screen.getByRole("button", { name: "Open Spool" }));

      await waitFor(() => expect(pathOf(router)).toBe("/bird/undev/spool"));
      expect(pages(container)).toEqual(["undev/skiff", "undev/spool"]);
      expect(screen.getByRole("article").ariaLabel).toBe("Spool in full");
      expect(panEnds).toHaveLength(1);
      expect(
        container.querySelector('[data-page="undev/skiff"] h1')?.textContent,
      ).toBe("Read from undev/skiff");

      await settlePan();

      expect(pages(container)).toEqual(["undev/spool"]);
      expect(container.querySelectorAll("article")).toHaveLength(1);
    });

    it("lands the chip a navigation between birds carries as the new page opens, while the pan runs", async () => {
      const { router, container } = renderApp(
        idle(mockAviary),
        "/bird/undev/skiff",
      );
      await screen.findByRole("article", { name: "Skiff in full" });

      await act(() =>
        router.navigate({
          to: "/bird/$",
          params: { _splat: "undev/prism" },
          search: { chip: "ci" },
        }),
      );

      expect(
        await screen.findByRole("article", { name: "Prism in full" }),
      ).toBeDefined();
      expect(pages(container)).toEqual(["undev/prism", "undev/skiff"]);
      expect(markedRow(container)).toBe("ci");
    });

    it("closes papers open on the old bird on the new: they slide away with the page left", async () => {
      const { router, container } = renderApp(
        idle(mockAviary),
        "/bird/dev/perch?papers=true",
        undefined,
        entryForms,
      );
      await screen.findByRole("form", { name: "Adoption papers for Perch" });

      fireEvent.click(screen.getByRole("button", { name: "Open Spool" }));

      await waitFor(() => expect(pathOf(router)).toBe("/bird/undev/spool"));
      expect(router.state.location.search).toEqual({});
      expect(screen.queryByRole("form")).toBeNull();
      expect(
        container.querySelector('[data-page="dev/perch"] form'),
      ).not.toBeNull();

      await settlePan();

      expect(container.querySelector("form")).toBeNull();
      expect(
        await screen.findByRole("button", { name: "The papers" }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: "The papers" }).ariaExpanded,
      ).toBe("false");
    });
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
          return idle(deriveAviary(mockSnapshot, config, mockHome));
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

    it("opens from the Sources in a bird's notice about a remote no card can read", async () => {
      const { router } = renderApp(
        idle(mockAviary),
        "/bird/undev/skiff",
        undefined,
        undefined,
        mockSettingsForm(),
      );

      fireEvent.click(await screen.findByRole("button", { name: "Sources" }));

      await waitFor(() => expect(pathOf(router)).toBe("/settings"));
    });

    it("opens on Sources from a no-clone slip with the local cards unfolded", async () => {
      const { router } = renderApp(
        idle(mockAviary),
        "/bird/forgejo:finch/field-notes",
        undefined,
        undefined,
        mockSettingsForm(),
      );

      fireEvent.click(
        await screen.findByRole("button", { name: "Open Sources" }),
      );

      await waitFor(() => expect(pathOf(router)).toBe("/settings"));
      expect(router.state.location.search).toEqual({ unfold: "local" });
      const local = within(
        await screen.findByRole("region", { name: "Local folders" }),
      );
      expect(
        (local.getByRole("textbox", { name: "folder 1" }) as HTMLInputElement)
          .value,
      ).toBe("~/dev");
    });

    it("reads an unfold the URL names that is no card kind as none", async () => {
      renderApp(
        idle(mockAviary),
        "/settings?unfold=nowhere",
        undefined,
        undefined,
        mockSettingsForm(),
      );

      const local = within(
        await screen.findByRole("region", { name: "Local folders" }),
      );
      expect(local.queryByRole("textbox", { name: "folder 1" })).toBeNull();
    });

    it("opens the Updates page when the tray asks, from wherever the window is", async () => {
      const { fake, router } = renderApp(
        idle(mockAviary),
        "/",
        undefined,
        undefined,
        mockSettingsForm(),
      );
      await birdButton("undev/skiff");

      act(() => fake.openUpdates());

      await waitFor(() => expect(pathOf(router)).toBe("/settings"));
      expect(router.state.location.search).toEqual({ page: "updates" });
      expect(
        await screen.findByRole("region", { name: "Updates" }),
      ).toBeDefined();
    });

    it("keeps the rail's page in the URL, and reads a page it does not know as Sources", async () => {
      const { router } = renderApp(
        idle(mockAviary),
        "/settings?page=nowhere",
        undefined,
        undefined,
        mockSettingsForm(),
      );

      expect(
        await screen.findByRole("region", { name: "Sources" }),
      ).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Updates" }));

      await waitFor(() =>
        expect(router.state.location.search).toEqual({ page: "updates" }),
      );
    });

    it("asks the main process to check, install and restart from the status row", async () => {
      const { fake } = renderApp(
        idle(mockAviary),
        "/settings?page=updates",
        undefined,
        undefined,
        mockSettingsForm(),
      );
      const updates = () =>
        within(screen.getByRole("region", { name: "Updates" }));

      fireEvent.click(await screen.findByRole("button", { name: "Check now" }));
      expect(fake.updateChecks).toBe(1);

      act(() =>
        fake.push({ ...idle(mockAviary), update: mockUpdates.foundInstall }),
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Install 0.3.0" }),
      );
      expect(fake.updateInstalls).toBe(1);

      act(() => fake.push({ ...idle(mockAviary), update: mockUpdates.ready }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Restart now" }),
      );
      expect(fake.updateRestarts).toBe(1);
      expect(updates().getByRole("status").textContent).toBe(
        "0.3.0 is downloaded. It runs from the next start.",
      );
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
      fireEvent.click(screen.getByRole("button", { name: "Add GitHub" }));
      const added = within(screen.getByRole("region", { name: "GitHub" }));
      fireEvent.change(added.getByRole("textbox", { name: "Account" }), {
        target: { value: "someone" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(fake.settingsSaves).toEqual([
        {
          ...form.values,
          sources: {
            ...form.values.sources,
            github: [
              ...form.values.sources.github,
              {
                account: "someone",
                key: "github-someone",
                hosts: ["github.com"],
                trackedForks: [],
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
      fireEvent.click(github.getByRole("button", { name: "GitHub · finch" }));

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

    it("carries the scan line, scanning when it is pressed and saying so until the scan ends", async () => {
      const { fake } = renderApp(
        idle(mockAviary),
        "/settings",
        undefined,
        undefined,
        mockSettingsForm(),
      );

      fireEvent.click(await screen.findByTitle("Scan now"));
      expect(fake.rescans).toBe(1);
      act(() => fake.push({ ...idle(mockAviary), scanning: true }));

      expect((await screen.findByRole("status")).textContent).toBe("scanning");
      act(() => fake.push(idle(mockAviary)));

      await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
      expect(screen.getByRole("form", { name: "Settings" })).toBeDefined();
    });

    it("asks the main process to open the config file from the header's path", async () => {
      const { fake } = renderApp(
        idle(mockAviary),
        "/settings",
        undefined,
        undefined,
        mockSettingsForm(),
      );

      fireEvent.click(
        await screen.findByRole("button", {
          name: "~/.config/perch/config.toml",
        }),
      );

      expect(fake.configOpens).toBe(1);
      expect(fake.launches).toEqual([]);
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
          mockLogin,
          mockImage,
        ),
      );
      act(() => fake.push(idle(mockAviary)));

      await waitFor(async () => expect(await interval()).toBe("20"));
    });

    it("saves the Window page's switches and shows the entry the main process wrote", async () => {
      const form = mockSettingsForm();
      const { fake } = renderApp(
        idle(mockAviary),
        "/settings",
        undefined,
        undefined,
        form,
      );
      fireEvent.click(await screen.findByRole("button", { name: "Window" }));
      const windowPage = within(
        await screen.findByRole("region", { name: "Window" }),
      );

      fireEvent.click(
        windowPage.getByRole("switch", { name: "Start at login" }),
      );
      fireEvent.click(
        windowPage.getByRole("switch", { name: "Stay in the tray" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(fake.settingsSaves).toEqual([
        { ...form.values, window: { tray: false, login: true } },
      ]);
      fake.setSettings(
        settingsFormFor(
          { ...mockConfig, window: { tray: false } },
          mockHome,
          {
            ...mockLogin,
            on: true,
            target: `${mockHome}/Applications/perch-0.2.0-x86_64.AppImage`,
          },
          mockImage,
        ),
      );
      act(() => fake.push(idle(mockAviary)));

      expect(
        await windowPage.findByText(
          "~/.config/autostart/perch.desktop → ~/Applications/perch-0.2.0-x86_64.AppImage",
        ),
      ).toBeDefined();
      expect(
        windowPage.getByText(
          "perch starts when you log in, with the window open.",
        ),
      ).toBeDefined();
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
