import { mockSnapshot } from "@perch/core/mock.ts";
import type { LedgerEntry } from "@perch/core/viewmodel.ts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BranchLines, FlagLines, Ledger, NewestCommits } from "./ledger.tsx";
import { mockBird } from "./mock-birds.ts";

afterEach(cleanup);

const now = new Date(mockSnapshot.scannedAt);

/** Each row's label, value and tone, as drawn. */
function rows(container: HTMLElement): string[][] {
  return [...container.querySelectorAll("[data-tone]")].map((value) => [
    value.previousElementSibling?.textContent ?? "",
    value.textContent ?? "",
    value.getAttribute("data-tone") ?? "",
  ]);
}

describe("the ledger", () => {
  it("renders clean zeros as a green none and counts in their severity's tone", () => {
    const { container } = render(
      <Ledger entries={mockBird("undev/prism").detail.ledger} now={now} />,
    );

    expect(rows(container).slice(0, 4)).toEqual([
      ["uncommitted changes", "4", "amber"],
      ["unpushed commits", "none", "green"],
      ["open bugs", "none", "green"],
      ["open roadmap items", "78", "none"],
    ]);
  });

  it("tones a red count red and a failing state red", () => {
    const gramophone = rows(
      render(
        <Ledger
          entries={mockBird("undev/gramophone").detail.ledger}
          now={now}
        />,
      ).container,
    );
    cleanup();
    const prism = rows(
      render(
        <Ledger entries={mockBird("undev/prism").detail.ledger} now={now} />,
      ).container,
    );

    expect(gramophone[0]).toEqual(["uncommitted changes", "14", "red"]);
    expect(prism).toContainEqual([
      "CI on Forgejo",
      "failure on main",
      "red",
    ]);
  });

  it("links a state to its page and gives times as durations to the moment passed", () => {
    const entries: LedgerEntry[] = [
      {
        kind: "state",
        label: "CI on GitHub",
        text: "success on main",
        tone: "green",
        url: "https://example.test/run",
      },
      { kind: "time", label: "last commit", at: "2026-10-21T03:00:00.000Z" },
    ];
    const { container } = render(<Ledger entries={entries} now={now} />);

    expect(
      screen
        .getByRole("link", { name: "success on main" })
        .getAttribute("href"),
    ).toBe("https://example.test/run");
    expect(rows(container)[1]).toEqual(["last commit", "30 hours ago", "none"]);
  });
});

describe("the ledger's sections", () => {
  it("marks the checked-out branch and the default one", () => {
    render(
      <BranchLines
        branches={mockBird("dev/perch").detail.branches}
        now={now}
      />,
    );

    expect(
      screen.getByText("checked out").parentElement?.textContent,
    ).toContain("contracts");
    expect(screen.getByText("default").parentElement?.textContent).toContain(
      "main",
    );
  });

  it("heads the newest commits with the branch on its forge", () => {
    const [github] = mockBird("dev/perch").detail.newestCommits;
    if (github === undefined) throw new Error("perch has commits on GitHub");
    render(<NewestCommits commits={github} now={now} />);

    expect(screen.getByRole("heading").textContent).toBe(
      "main on GitHub, newest commits",
    );
    expect(screen.getByRole("link", { name: "af0893d" })).toBeDefined();
  });

  it("tones a flag by its level", () => {
    const { container } = render(
      <FlagLines flags={mockBird("dev/odin/hello").detail.flags} />,
    );

    expect(rows(container)).toEqual([
      [
        "found under /home/owner/dev with no entry in config items",
        "not set up",
        "red",
      ],
    ]);
  });
});
