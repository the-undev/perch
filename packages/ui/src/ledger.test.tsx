import { mockSnapshot } from "@perch/core/mock.ts";
import type { LedgerFact, SheetLine } from "@perch/core/viewmodel.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BranchLines, CommitHistory, FlagLines, Ledger } from "./ledger.tsx";
import { mockBird } from "./mock-birds.ts";

afterEach(cleanup);

const now = new Date(mockSnapshot.scannedAt);

/** A bug line pressed where no sheet listens. */
const ignoreReveal = () => {};

/** Each row's label, value and tone, as drawn. */
function rows(container: HTMLElement): string[][] {
  return [...container.querySelectorAll("[data-tone]")].map((value) => [
    value.previousElementSibling?.textContent ?? "",
    value.textContent ?? "",
    value.getAttribute("data-tone") ?? "",
  ]);
}

/** Each history commit's dot: its tone and the forges holding it in words, as drawn. */
function dots(container: HTMLElement): string[][] {
  return [...container.querySelectorAll('[data-part="history-commit"]')].map(
    (row) => {
      const dot = row.querySelector('[role="img"]');
      return [
        dot?.getAttribute("data-held-on-tone") ?? "",
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
        onReveal={ignoreReveal}
        quiet={null}
        facts={mockBird("undev/prism").page.ledger}
        now={now}
        landing={null}
      />,
    );

    expect(rows(container).slice(0, 4)).toEqual([
      ["uncommitted changes", "4", "amber"],
      ["unpushed commits", "none", "green"],
      ["bugs in docs/roadmap.md", "none", "green"],
      ["open work items", "78", "none"],
    ]);
  });

  it("tones a red count red and a failing state red", () => {
    const gramophone = rows(
      render(
        <Ledger
          onReveal={ignoreReveal}
          quiet={null}
          facts={mockBird("undev/gramophone").page.ledger}
          now={now}
          landing={null}
        />,
      ).container,
    );
    cleanup();
    const prism = rows(
      render(
        <Ledger
          onReveal={ignoreReveal}
          quiet={null}
          facts={mockBird("undev/prism").page.ledger}
          now={now}
          landing={null}
        />,
      ).container,
    );

    expect(gramophone[0]).toEqual(["uncommitted changes", "14", "red"]);
    expect(prism).toContainEqual(["CI", "failure", "red"]);
  });

  it("links a state to its page and gives times as durations to the moment passed", () => {
    const facts: LedgerFact[] = [
      {
        kind: "state",
        label: "CI",
        text: "success on main",
        tone: "green",
        url: "https://example.test/run",
        chip: null,
        readings: [],
      },
      { kind: "time", label: "last commit", at: "2026-10-21T03:00:00.000Z" },
    ];
    const { container } = render(
      <Ledger
        onReveal={ignoreReveal}
        quiet={null}
        facts={facts}
        now={now}
        landing={null}
      />,
    );

    expect(
      screen
        .getByRole("link", { name: "success on main" })
        .getAttribute("href"),
    ).toBe("https://example.test/run");
    expect(rows(container)[1]).toEqual(["last commit", "30 hours ago", "none"]);
  });

  it("opens with the quiet sentence when given one, and without it when null", () => {
    const spool = mockBird("undev/spool").page;
    const quiet = render(
      <Ledger
        onReveal={ignoreReveal}
        quiet={spool.quiet}
        facts={spool.ledger}
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
      <Ledger
        onReveal={ignoreReveal}
        quiet={null}
        facts={spool.ledger}
        now={now}
        landing={null}
      />,
    );
    expect(container.querySelector('[data-part="quiet"]')).toBeNull();
  });
});

describe("the ledger's readings", () => {
  /** Each reading line under the row holding the given chip, with its tone. */
  function readings(container: HTMLElement, chip: string): string[][] {
    return [
      ...container.querySelectorAll(
        `[data-chip="${chip}"] [data-part="reading"]`,
      ),
    ].map((line) => [
      line.textContent ?? "",
      line
        .querySelector("[data-reading-tone]")
        ?.getAttribute("data-reading-tone") ?? "",
    ]);
  }

  it("names each forge's newest run under the CI row, toned and linked to the run", () => {
    const { container } = render(
      <Ledger
        onReveal={ignoreReveal}
        quiet={null}
        facts={mockBird("dev/perch").page.ledger}
        now={now}
        landing={null}
      />,
    );

    expect(rows(container)).toContainEqual(["CI", "pending", "none"]);
    expect(readings(container, "ci")).toEqual([
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
        onReveal={ignoreReveal}
        quiet={null}
        facts={mockBird("undev/prism").page.ledger}
        now={now}
        landing={null}
      />,
    );

    expect(readings(container, "ci")).toEqual([
      ["github · success on main, run “check” · five days ago", "green"],
      [
        "forgejo · failure on main, run “check / check (push)” · four days ago",
        "red",
      ],
    ]);
    expect(readings(container, "pull-requests")).toEqual([
      ["github · couldn't read pull requests", "amber"],
      ["forgejo · 2 open", "none"],
    ]);
  });

  it("spells out open work items per roadmap file and unsafe work by its oldest", () => {
    const { container } = render(
      <Ledger
        onReveal={ignoreReveal}
        quiet={null}
        facts={mockBird("obsidian/Hothouse").page.ledger}
        now={now}
        landing={null}
      />,
    );

    expect(readings(container, "open-work-items")).toEqual([
      ["Tech/Tech Plans.md · 121 open", "none"],
      ["Garden/Garden Plans.md · 75 open", "none"],
    ]);
    expect(readings(container, "bugs")).toEqual([
      ["Tech/Tech Plans.md · bug 1", "none"],
    ]);
    expect(readings(container, "critical-bugs")).toEqual([
      ["Garden/Garden Plans.md · critical bug 1", "none"],
      ["Garden/Garden Plans.md · restless at 1", "amber"],
    ]);
    expect(readings(container, "uncommitted")).toEqual([
      ["git · oldest change · 30 hours ago", "amber"],
    ]);
  });

  it("marks with a dot each row holding one of the bubble's chips, and only those", () => {
    const perch = mockBird("dev/perch");
    const { container } = render(
      <Ledger
        onReveal={ignoreReveal}
        quiet={null}
        facts={perch.page.ledger}
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
  it("marks the row holding the pressed chip's reading, only that row, and afresh on each press, its reading lines lit with the mark", () => {
    const facts = mockBird("dev/perch").page.ledger;
    const { container, rerender } = render(
      <Ledger
        onReveal={ignoreReveal}
        quiet={null}
        facts={facts}
        now={now}
        landing={{ chip: "ci", press: 1 }}
      />,
    );
    const first = container.querySelector('[data-part="landing"]');
    /** The rows whose reading lines are lit, by the chip each holds. */
    const lit = () =>
      [
        ...container.querySelectorAll(
          '[data-part="readings"].animate-land-ink',
        ),
      ].map((list) => list.parentElement?.getAttribute("data-chip"));
    const firstInk = container.querySelector(
      '[data-chip="ci"] [data-part="readings"]',
    );

    expect(container.querySelectorAll('[data-part="landing"]')).toHaveLength(1);
    expect(first?.parentElement?.getAttribute("data-chip")).toBe("ci");
    expect(first?.getAttribute("class")).toContain("animate-land");
    expect(lit()).toEqual(["ci"]);
    expect(
      container.querySelectorAll('[data-part="readings"]').length,
    ).toBeGreaterThan(1);

    rerender(
      <Ledger
        onReveal={ignoreReveal}
        quiet={null}
        facts={facts}
        now={now}
        landing={{ chip: "ci", press: 2 }}
      />,
    );
    const again = container.querySelector('[data-part="landing"]');
    expect(again).not.toBeNull();
    expect(again).not.toBe(first);
    const againInk = container.querySelector(
      '[data-chip="ci"] [data-part="readings"]',
    );
    expect(againInk?.classList.contains("animate-land-ink")).toBe(true);
    expect(againInk).not.toBe(firstInk);

    rerender(
      <Ledger
        onReveal={ignoreReveal}
        quiet={null}
        facts={facts}
        now={now}
        landing={{ chip: "open-work-items", press: 3 }}
      />,
    );
    expect(
      container
        .querySelector('[data-part="landing"]')
        ?.parentElement?.getAttribute("data-chip"),
    ).toBe("open-work-items");
    expect(lit()).toEqual(["open-work-items"]);

    rerender(
      <Ledger
        onReveal={ignoreReveal}
        quiet={null}
        facts={facts}
        now={now}
        landing={null}
      />,
    );
    expect(container.querySelector('[data-part="landing"]')).toBeNull();
    expect(lit()).toEqual([]);
  });
});

describe("the ledger's sections", () => {
  it("marks the checked-out branch and the default one", () => {
    render(
      <BranchLines
        branches={mockBird("dev/perch").page.branches}
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
      <CommitHistory
        history={mockBird("undev/harbour").page.history}
        now={now}
      />,
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
      <CommitHistory history={mockBird(".dotfiles").page.history} now={now} />,
    );

    expect(container.querySelector('[data-part="divergence"]')).toBeNull();
    expect(dots(container)[0]).toEqual([
      "amber",
      "not pushed to a remote",
      "not pushed to a remote",
    ]);
    expect(
      container.querySelectorAll('[data-part="history-commit"] [role="img"]'),
    ).toHaveLength(dots(container).length);
    expect(screen.queryByText("here")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Open Alacritty at 140 by 40" }),
    ).toBeNull();
  });

  it("notes each forge that couldn't be read in amber", () => {
    const { container } = render(
      <CommitHistory
        history={mockBird("dev/hearth-config").page.history}
        now={now}
      />,
    );

    const notes = [
      ...container.querySelectorAll('[data-part="history-note"]'),
    ].map((note) => [note.textContent, note.className.includes("text-amber")]);
    expect(notes).toEqual([
      ["couldn't read github", true],
      ["couldn't read forgejo", true],
    ]);
  });

  it("links each commit to the first forge holding it, judging a forge whose pull requests couldn't be read by its commits", () => {
    const { container } = render(
      <CommitHistory
        history={mockBird("undev/prism").page.history}
        now={now}
      />,
    );

    expect(container.querySelector('[data-part="history-note"]')).toBeNull();
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
      <CommitHistory
        history={mockBird("dev/hearth-config").page.history}
        now={now}
      />,
    );
    const { container: hello } = render(
      <CommitHistory
        history={mockBird("dev/odin/hello").page.history}
        now={now}
      />,
    );

    expect(dots(container)).toEqual([
      ["amber", "no remote could be read", "no remote could be read"],
    ]);
    expect(dots(hello)).toEqual([["none", "no remote", "no remote"]]);
  });

  it("tones a flag by its level", () => {
    const { container } = render(
      <FlagLines flags={mockBird("dev/odin/hello").page.flags} />,
    );

    expect(rows(container)).toEqual([
      [
        "found under /home/owner/dev with no papers in config",
        "not set up",
        "red",
      ],
    ]);
  });

  describe("bug titles", () => {
    const bugFacts = (text: string): LedgerFact[] => [
      {
        kind: "count",
        label: "bugs in docs/roadmap.md",
        count: 1,
        text: "1",
        tone: "amber",
        chip: null,
        readings: [
          {
            source: "docs/roadmap.md · bug 1",
            text,
            tone: null,
            url: null,
            at: null,
            reveal: { path: "docs/roadmap.md", line: 7 },
          },
        ],
      },
    ];

    function renderTitle(
      text: string,
      onReveal: (line: SheetLine) => void = ignoreReveal,
    ) {
      const { container } = render(
        <Ledger
          onReveal={onReveal}
          quiet={null}
          facts={bugFacts(text)}
          now={now}
          landing={null}
        />,
      );
      return container.querySelector('[data-part="reveal"]') as HTMLElement;
    }

    it("renders a code span as code without its backticks", () => {
      const button = renderTitle("Fails with `-m=nokernelcrypto`");

      expect(button.querySelector("code")?.textContent).toBe(
        "-m=nokernelcrypto",
      );
      expect(button.textContent).toBe("Fails with -m=nokernelcrypto");
    });

    it("renders a link as its text, with no anchor in the button", () => {
      const button = renderTitle("See [the report](https://example.com/r)");

      expect(button.textContent).toBe("See the report");
      expect(button.querySelector("a")).toBeNull();
    });

    it("renders emphasis and strong", () => {
      const button = renderTitle("An *odd* and **loud** bug");

      expect(button.querySelector("em")?.textContent).toBe("odd");
      expect(button.querySelector("strong")?.textContent).toBe("loud");
      expect(button.querySelector("p")).toBeNull();
    });

    it("still reveals its line when pressed", () => {
      const revealed: unknown[] = [];
      const button = renderTitle("A `bug`", (line) => revealed.push(line));

      fireEvent.click(button);

      expect(revealed).toEqual([{ path: "docs/roadmap.md", line: 7 }]);
    });
  });
});
