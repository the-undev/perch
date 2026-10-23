import { mockAviary } from "@perch/core/mock.ts";
import type { Aviary } from "@perch/core/viewmodel.ts";
import { mockBird } from "@perch/ui/mock-birds.ts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
) {
  const fake = fakeApi(initial, sheetsFor);
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
});
