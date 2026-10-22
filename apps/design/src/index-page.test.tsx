import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { groups, pages } from "./registry.ts";
import { createDesignRouter } from "./router.tsx";

// jsdom has no scrolling; the router restores scroll position on every navigation.
window.scrollTo = () => {};

afterEach(cleanup);

describe("the design site", () => {
  it("renders a card for every page at the index route, under its group", async () => {
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
    for (const group of groups) {
      expect(
        screen.getByRole("heading", { level: 2, name: group.title }),
      ).toBeDefined();
    }
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
