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
    expect(prism).toContainEqual(["CI", "failure", "red"]);
  });

  it("links a state to its page and gives times as durations to the moment passed", () => {
    const entries: LedgerEntry[] = [
      {
        kind: "state",
        label: "CI",
        text: "success on main",
        tone: "green",
        url: "https://example.test/run",
        chip: null,
        workings: [],
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

describe("the ledger's workings", () => {
  /** Each working line under the row holding the given chip, with its tone. */
  function workings(container: HTMLElement, chip: string): string[][] {
    return [
      ...container.querySelectorAll(
        `[data-chip="${chip}"] [data-part="working"]`,
      ),
    ].map((line) => [
      line.textContent ?? "",
      line
        .querySelector("[data-working-tone]")
        ?.getAttribute("data-working-tone") ?? "",
    ]);
  }

  it("names each forge's newest run under the CI row, toned and linked to the run", () => {
    const { container } = render(
      <Ledger entries={mockBird("dev/perch").detail.ledger} now={now} />,
    );

    expect(rows(container)).toContainEqual(["CI", "pending", "none"]);
    expect(workings(container, "ci")).toEqual([
      ["github · success on main, run “check” · thirteen hours ago", "green"],
      [
        "forgejo · pending on main, run “check / check (push)” · thirteen hours ago",
        "none",
      ],
    ]);
    expect(
      screen
        .getByRole("link", {
          name: "pending on main, run “check / check (push)”",
        })
        .getAttribute("href"),
    ).toBe("http://forge.example.lan:3000/finch/perch/actions/runs/14");
  });

  it("says in amber a forge was not read, beside the forge that was", () => {
    const { container } = render(
      <Ledger entries={mockBird("undev/prism").detail.ledger} now={now} />,
    );

    expect(workings(container, "ci")).toEqual([
      ["github · not read", "amber"],
      [
        "forgejo · failure on main, run “check / check (push)” · four days ago",
        "red",
      ],
    ]);
    expect(workings(container, "pull-requests")).toEqual([
      ["github · not read", "amber"],
      ["forgejo · 2 open", "none"],
    ]);
  });

  it("spells out open items per roadmap file and unsafe work by its oldest", () => {
    const { container } = render(
      <Ledger
        entries={mockBird("obsidian/Hothouse").detail.ledger}
        now={now}
      />,
    );

    expect(workings(container, "open-items")).toEqual([
      ["Tech/Tech Plans.md · 120 open", "none"],
      ["Garden/Garden Plans.md · 74 open", "none"],
    ]);
    expect(workings(container, "uncommitted")).toEqual([
      ["git · oldest change · 30 hours ago", "amber"],
    ]);
  });

  it("marks with a dot each row holding one of the bubble's chips, and only those", () => {
    const perch = mockBird("dev/perch");
    const { container } = render(
      <Ledger entries={perch.detail.ledger} now={now} />,
    );
    const marked = [...container.querySelectorAll("[data-chip]")];

    expect(marked.map((row) => row.getAttribute("data-chip")).sort()).toEqual(
      perch.bubble.chips.map((chip) => chip.kind).sort(),
    );
    expect(
      container.querySelectorAll('[data-part="handle-mark"]'),
    ).toHaveLength(perch.bubble.chips.length);
    expect(
      marked.every((row) => row.querySelector('[data-part="handle-mark"]')),
    ).toBe(true);
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
