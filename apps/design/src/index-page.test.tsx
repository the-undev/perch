import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { pages } from "./registry.ts";
import { createDesignRouter } from "./router.tsx";

// jsdom has no scrolling; the router restores scroll position on every navigation.
window.scrollTo = () => {};

afterEach(cleanup);

describe("the design site", () => {
  it("renders a card for every page at the index route, and the next phase's groups", async () => {
    const router = createDesignRouter(
      createMemoryHistory({ initialEntries: ["/"] }),
    );
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { name: "Perch Design" }),
    ).toBeDefined();
    for (const page of pages) {
      expect(
        screen
          .getByRole("link", { name: new RegExp(`^${page.title}`) })
          .getAttribute("href"),
      ).toBe(`/${page.slug}`);
    }
    expect(
      screen.getByRole("heading", { name: "Scenes next phase" }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "The aviary" })).toBeDefined();
  });

  it.each(pages)(
    "renders the $title page with its usage note",
    async (page) => {
      const router = createDesignRouter(
        createMemoryHistory({ initialEntries: [`/${page.slug}`] }),
      );
      render(<RouterProvider router={router} />);

      expect(
        await screen.findByRole("heading", { level: 1, name: page.title }),
      ).toBeDefined();
      expect(screen.getByRole("heading", { name: /^Usage:/ })).toBeDefined();
    },
  );
});
