import { mockSnapshot } from "@perch/core/mock.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LaunchActions, LinksOut } from "./actions.tsx";
import { DetailHeading } from "./detail-heading.tsx";
import { PullRequestLines, SourceProblems } from "./ledger.tsx";
import { mockBird } from "./mock-birds.ts";

afterEach(cleanup);

const now = new Date(mockSnapshot.scannedAt);

describe("the detail page's pieces", () => {
  it("shows launch actions as verbs and hands back the one pressed", () => {
    const hothouse = mockBird("obsidian/Hothouse");
    const onLaunch = vi.fn();
    render(
      <LaunchActions actions={hothouse.detail.actions} onLaunch={onLaunch} />,
    );

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual([
      "Open in Obsidian↗",
      "Open the zellij tab↗",
      "Open in VS Code↗",
      "Open the folder↗",
    ]);
    fireEvent.click(screen.getByRole("button", { name: /zellij/ }));
    expect(onLaunch).toHaveBeenCalledWith(hothouse.detail.actions[1]);
  });

  it("links out to each forge page", () => {
    render(<LinksOut links={mockBird("dev/perch").detail.links} />);

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual([
      "https://github.com/finch/perch",
      "http://forge.example.lan:3000/finch/perch",
    ]);
  });

  it("heads the page with the name, the state word and the activity, and no speech", () => {
    const perch = mockBird("dev/perch");
    const { container } = render(<DetailHeading bird={perch} actions={null} />);

    expect(screen.getByRole("heading").textContent).toBe("Perch");
    expect(
      container.querySelector('[data-part="state-word"]')?.textContent,
    ).toBe("content");
    expect(container.textContent).toContain("editing ♪");
    expect(container.textContent).not.toContain(perch.bubble.speech);
  });

  it("says in the meta line where the bird lives: clone, forges and wire", () => {
    const meta = (id: string) => {
      const { container } = render(
        <DetailHeading bird={mockBird(id)} actions={null} />,
      );
      const text = container.querySelector('[data-part="meta"]')?.textContent;
      cleanup();
      return text;
    };

    expect(meta("dev/perch")).toBe(
      `~/dev/perch · github, forgejo · on ${mockBird("dev/perch").wire}`,
    );
    expect(meta("github:finch/obsidian-tidy")).toBe("github · on the fence");
    expect(meta("dev/odin/hello")).toBe("~/dev/odin/hello · on the fence");
  });

  it("sets the actions it is given on the meta line's row, after the meta", () => {
    const perch = mockBird("dev/perch");
    const { container } = render(
      <DetailHeading
        bird={perch}
        actions={<LinksOut links={perch.detail.links} />}
      />,
    );
    const row = container.querySelector('[data-part="meta-row"]');

    expect(row?.firstElementChild?.getAttribute("data-part")).toBe("meta");
    expect(row?.lastElementChild?.querySelectorAll("a")).toHaveLength(2);
    expect(row?.className.split(" ")).toEqual(
      expect.arrayContaining(["flex", "flex-wrap", "items-center"]),
    );
  });

  it("lists pull requests with their forge, author and draft state", () => {
    render(
      <PullRequestLines
        pullRequests={mockBird("dev/perch").detail.pullRequests}
        now={now}
      />,
    );

    expect(screen.getByText("#6 on GitHub, by finch, draft")).toBeDefined();
  });

  it("names a source that could not be read and its error", () => {
    const { container } = render(
      <SourceProblems problems={mockBird("undev/prism").detail.problems} />,
    );

    expect(container.textContent).toContain("GitHub");
    expect(container.textContent).toContain("HTTP 404");
    expect(
      container.querySelector("[data-tone]")?.getAttribute("data-tone"),
    ).toBe("amber");
  });
});
