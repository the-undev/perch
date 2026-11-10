import { mockSnapshot } from "@perch/core/mock.ts";
import type { LedgerEntry } from "@perch/core/viewmodel.ts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BranchLines, CommitRiver, FlagLines, Ledger } from "./ledger.tsx";
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

/** Each river commit's dot: its tone and its spoken spread, as drawn. */
function dots(container: HTMLElement): string[][] {
  return [...container.querySelectorAll('[data-part="river-commit"]')].map(
    (row) => {
      const dot = row.querySelector('[role="img"]');
      return [
        dot?.getAttribute("data-spread-tone") ?? "",
        dot?.getAttribute("aria-label") ?? "",
        dot?.getAttribute("title") ?? "",
      ];
    },
  );
}

describe("the ledger", () => {
  it("renders clean zeros as a green none and counts in their severity's tone", () => {
    const { container } = render(
      <Ledger
        quiet={null}
        entries={mockBird("undev/prism").detail.ledger}
        now={now}
        landing={null}
      />,
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
          quiet={null}
          entries={mockBird("undev/gramophone").detail.ledger}
          now={now}
          landing={null}
        />,
      ).container,
    );
    cleanup();
    const prism = rows(
      render(
        <Ledger
          quiet={null}
          entries={mockBird("undev/prism").detail.ledger}
          now={now}
          landing={null}
        />,
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
    const { container } = render(
      <Ledger quiet={null} entries={entries} now={now} landing={null} />,
    );

    expect(
      screen
        .getByRole("link", { name: "success on main" })
        .getAttribute("href"),
    ).toBe("https://example.test/run");
    expect(rows(container)[1]).toEqual(["last commit", "30 hours ago", "none"]);
  });

  it("opens with the quiet sentence when given one, and without it when null", () => {
    const spool = mockBird("undev/spool").detail;
    const quiet = render(
      <Ledger
        quiet={spool.quiet}
        entries={spool.ledger}
        now={now}
        landing={null}
      />,
    ).container.querySelector('[data-part="ledger"]');

    expect(quiet?.firstElementChild?.getAttribute("data-part")).toBe("quiet");
    expect(quiet?.firstElementChild?.textContent).toBe(
      "The working tree is clean and everything is pushed.",
    );
    cleanup();
    const { container } = render(
      <Ledger quiet={null} entries={spool.ledger} now={now} landing={null} />,
    );
    expect(container.querySelector('[data-part="quiet"]')).toBeNull();
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
      <Ledger
        quiet={null}
        entries={mockBird("dev/perch").detail.ledger}
        now={now}
        landing={null}
      />,
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

  it("says in amber which part of a forge couldn't be read, beside the forge that was", () => {
    const { container } = render(
      <Ledger
        quiet={null}
        entries={mockBird("undev/prism").detail.ledger}
        now={now}
        landing={null}
      />,
    );

    expect(workings(container, "ci")).toEqual([
      ["github · success on main, run “check” · five days ago", "green"],
      [
        "forgejo · failure on main, run “check / check (push)” · four days ago",
        "red",
      ],
    ]);
    expect(workings(container, "pull-requests")).toEqual([
      ["github · couldn't read pull requests", "amber"],
      ["forgejo · 2 open", "none"],
    ]);
  });

  it("spells out open items per roadmap file and unsafe work by its oldest", () => {
    const { container } = render(
      <Ledger
        quiet={null}
        entries={mockBird("obsidian/Hothouse").detail.ledger}
        now={now}
        landing={null}
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
      <Ledger
        quiet={null}
        entries={perch.detail.ledger}
        now={now}
        landing={null}
      />,
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

describe("a chip's landing", () => {
  it("marks the row holding the pressed chip's working, only that row, and afresh on each press, its working lines lit with the mark", () => {
    const entries = mockBird("dev/perch").detail.ledger;
    const { container, rerender } = render(
      <Ledger
        quiet={null}
        entries={entries}
        now={now}
        landing={{ chip: "ci", press: 1 }}
      />,
    );
    const first = container.querySelector('[data-part="landing"]');
    /** The rows whose working lines are lit, by the chip each holds. */
    const lit = () =>
      [
        ...container.querySelectorAll(
          '[data-part="workings"].animate-land-ink',
        ),
      ].map((list) => list.parentElement?.getAttribute("data-chip"));
    const firstInk = container.querySelector(
      '[data-chip="ci"] [data-part="workings"]',
    );

    expect(container.querySelectorAll('[data-part="landing"]')).toHaveLength(1);
    expect(first?.parentElement?.getAttribute("data-chip")).toBe("ci");
    expect(first?.getAttribute("class")).toContain("animate-land");
    expect(lit()).toEqual(["ci"]);
    expect(
      container.querySelectorAll('[data-part="workings"]').length,
    ).toBeGreaterThan(1);

    rerender(
      <Ledger
        quiet={null}
        entries={entries}
        now={now}
        landing={{ chip: "ci", press: 2 }}
      />,
    );
    const again = container.querySelector('[data-part="landing"]');
    expect(again).not.toBeNull();
    expect(again).not.toBe(first);
    const againInk = container.querySelector(
      '[data-chip="ci"] [data-part="workings"]',
    );
    expect(againInk?.classList.contains("animate-land-ink")).toBe(true);
    expect(againInk).not.toBe(firstInk);

    rerender(
      <Ledger
        quiet={null}
        entries={entries}
        now={now}
        landing={{ chip: "open-items", press: 3 }}
      />,
    );
    expect(
      container
        .querySelector('[data-part="landing"]')
        ?.parentElement?.getAttribute("data-chip"),
    ).toBe("open-items");
    expect(lit()).toEqual(["open-items"]);

    rerender(
      <Ledger quiet={null} entries={entries} now={now} landing={null} />,
    );
    expect(container.querySelector('[data-part="landing"]')).toBeNull();
    expect(lit()).toEqual([]);
  });
});

describe("the ledger's sections", () => {
  it("marks the checked-out branch and the default one", () => {
    render(
      <BranchLines
        branches={mockBird("dev/perch").detail.branches}
        now={now}
        chip={null}
        landing={null}
      />,
    );

    expect(
      screen.getByText("checked out").parentElement?.textContent,
    ).toContain("contracts");
    expect(screen.getByText("default").parentElement?.textContent).toContain(
      "main",
    );
  });

  it("draws one dot per commit, spoken and titled, and the divergence in amber", () => {
    const { container } = render(
      <CommitRiver river={mockBird("undev/harbour").detail.river} now={now} />,
    );

    expect(screen.getByRole("heading").textContent).toBe(
      "Commits on main, and where each has reached",
    );
    expect(dots(container)).toEqual([
      ["amber", "only on github", "only on github"],
      ["green", "on github and forgejo", "on github and forgejo"],
    ]);
    const divergence = container.querySelector('[data-part="divergence"]');
    expect(divergence?.textContent).toBe("forgejo is 1 commit behind github.");
    expect(divergence?.className).toContain("text-amber");
  });

  it("dots unpushed commits amber, unlinked, with no sentence and no column per place", () => {
    const { container } = render(
      <CommitRiver river={mockBird(".dotfiles").detail.river} now={now} />,
    );

    expect(container.querySelector('[data-part="divergence"]')).toBeNull();
    expect(dots(container)[0]).toEqual([
      "amber",
      "not pushed to a remote",
      "not pushed to a remote",
    ]);
    expect(
      container.querySelectorAll('[data-part="river-commit"] [role="img"]'),
    ).toHaveLength(dots(container).length);
    expect(screen.queryByText("here")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Open Alacritty at 140 by 40" }),
    ).toBeNull();
  });

  it("notes each forge that couldn't be read in amber", () => {
    const { container } = render(
      <CommitRiver
        river={mockBird("dev/hearth-config").detail.river}
        now={now}
      />,
    );

    const notes = [
      ...container.querySelectorAll('[data-part="river-note"]'),
    ].map((note) => [note.textContent, note.className.includes("text-amber")]);
    expect(notes).toEqual([
      ["couldn't read github", true],
      ["couldn't read forgejo", true],
    ]);
  });

  it("links each commit to the first forge holding it, judging a forge whose pull requests couldn't be read by its commits", () => {
    const { container } = render(
      <CommitRiver river={mockBird("undev/prism").detail.river} now={now} />,
    );

    expect(container.querySelector('[data-part="river-note"]')).toBeNull();
    expect(dots(container)).toEqual([
      ["green", "on github and forgejo", "on github and forgejo"],
    ]);
    expect(
      screen
        .getByRole("link", { name: /Merge composition-and-dispatch/ })
        .getAttribute("href"),
    ).toBe(
      "https://github.com/the-undev/prism/commit/76cb6256a466e8a0c2e4a6c8e0a2c4e6a8c0e2a4",
    );
  });

  it("dots every commit amber when no remote could be read, keeping the quiet dot for a bird with none", () => {
    const { container } = render(
      <CommitRiver
        river={mockBird("dev/hearth-config").detail.river}
        now={now}
      />,
    );
    const { container: hello } = render(
      <CommitRiver river={mockBird("dev/odin/hello").detail.river} now={now} />,
    );

    expect(dots(container)).toEqual([
      ["amber", "no remote could be read", "no remote could be read"],
    ]);
    expect(dots(hello)).toEqual([["none", "no remote", "no remote"]]);
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
