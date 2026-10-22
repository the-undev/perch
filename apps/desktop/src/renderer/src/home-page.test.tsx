import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi } from "./fake-api.ts";
import { createAppRouter } from "./router.tsx";

// jsdom has no scrolling; the router restores scroll position on every navigation.
window.scrollTo = () => {};

afterEach(cleanup);

describe("the placeholder page", () => {
  it("renders at the index route with the version the main process reports", async () => {
    const { api } = fakeApi({ aviary: null, scanning: false, problems: [] });
    const queryClient = new QueryClient();
    const router = createAppRouter(
      { api, queryClient },
      createMemoryHistory({ initialEntries: ["/"] }),
    );

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "perch" })).toBeDefined();
    expect(await screen.findByText("Version 9.8.7")).toBeDefined();
    expect(screen.getByRole("button", { name: "Ask again" })).toBeDefined();
  });
});
