import {
  type EntryForm,
  emptyEntryValues,
  entryFormFor,
  withEntry,
} from "@perch/core/entry-form.ts";
import { mockConfig, mockSnapshot } from "@perch/core/mock.ts";
import type { Aviary, Bird, ChipKind } from "@perch/core/viewmodel.ts";
import { deriveAviary } from "@perch/core/viewmodel.ts";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailView } from "./detail-view.tsx";
import { mockBird, mockEntryForm, mockHome } from "./mock-birds.ts";
import type { KeyFileSheet } from "./paper.tsx";
import { roostColumnWidth, roostFrame } from "./roost.tsx";

afterEach(cleanup);

/** The elements scrolled into view and how, since jsdom does no scrolling. */
const scrolled: { element: Element; options: unknown }[] = [];
/** How a landing scrolls: the row to the middle of its nearest scrolling ancestor only. */
const landingOptions = {
  block: "center",
  behavior: "instant",
  container: "nearest",
};
/** Whether the scrolled row already held its landing mark when the scroll ran. */
const markedAtScroll: boolean[] = [];
Element.prototype.scrollIntoView = function (
  this: Element,
  options?: boolean | ScrollIntoViewOptions,
) {
  scrolled.push({ element: this, options });
  markedAtScroll.push(this.querySelector('[data-part="landing"]') !== null);
};
afterEach(() => {
  scrolled.length = 0;
  markedAtScroll.length = 0;
});

const now = new Date(mockSnapshot.scannedAt);

const helloItem = (() => {
  const item = mockSnapshot.items.find(
    (entry) => entry.id === "dev/odin/hello",
  );
  if (item === undefined) throw new Error("the mock snapshot has no hello");
  return item;
})();

function findBird(aviary: Aviary, id: string): Bird {
  const bird = [
    ...aviary.wires.flatMap((wire) => wire.birds),
    ...aviary.fence.birds,
  ].find((candidate) => candidate.id === id);
  if (bird === undefined) throw new Error(`the aviary has no ${id}`);
  return bird;
}

/** Skiff with its GitHub remote unread for want of a card that covers its owner. */
function unreadableSkiff(): Bird {
  const items = mockSnapshot.items.map((item) =>
    item.id === "undev/skiff"
      ? {
          ...item,
          presences: {
            ...item.presences,
            forges: item.presences.forges.map((presence) =>
              presence.forge === "github"
                ? { ...presence, fullName: "skiff-app/skiff", url: null }
                : presence,
            ),
          },
          sources: {
            ...item.sources,
            github: {
              error: "no GitHub card is configured for owner skiff-app",
              cause: "no-card" as const,
            },
          },
        }
      : item,
  );
  return findBird(
    deriveAviary({ ...mockSnapshot, items }, mockConfig, mockHome),
    "undev/skiff",
  );
}

interface PageOptions {
  sheets?: KeyFileSheet[];
  form?: EntryForm | null;
  problems?: string[];
  openPapers?: boolean;
  arrivalChip?: ChipKind | null;
  panning?: boolean;
}

function page(bird: Bird, options: PageOptions = {}) {
  const onLaunch = vi.fn();
  const onSave = vi.fn();
  const onRemove = vi.fn();
  const onSettings = vi.fn();
  const onLocalSources = vi.fn();
  const onCopy = vi.fn<(text: string) => Promise<void>>(async () => undefined);
  const view = (next: Bird, given: PageOptions) => (
    <DetailView
      bird={next}
      now={now}
      onLaunch={onLaunch}
      sheets={given.sheets ?? []}
      entry={{ form: given.form ?? null, onSave, onRemove }}
      problems={given.problems ?? []}
      openPapers={given.openPapers ?? false}
      arrivalChip={given.arrivalChip ?? null}
      onSettings={onSettings}
      onLocalSources={onLocalSources}
      onCopy={onCopy}
      panning={given.panning ?? false}
    />
  );
  const { container, rerender } = render(view(bird, options));
  return {
    container,
    onLaunch,
    onSave,
    onRemove,
    onSettings,
    onLocalSources,
    onCopy,
    /** The same page given a new bird and new options, as a push would. */
    push: (next: Bird, given: PageOptions) => rerender(view(next, given)),
  };
}

/** Each ledger row's label and value, as drawn. */
function ledgerRows(container: HTMLElement): string[][] {
  return [
    ...container.querySelectorAll('[data-part="ledger"] [data-tone]'),
  ].map((value) => [
    value.previousElementSibling?.textContent ?? "",
    value.textContent ?? "",
  ]);
}

/** The heights an element declares in pixels: its height attribute, its inline height and min-height, and Tailwind height classes. */
function declaredHeights(element: Element): number[] {
  const { style } = element as HTMLElement;
  const fromStyle = [style.height, style.minHeight]
    .filter((value) => value.endsWith("px"))
    .map((value) => Number.parseFloat(value));
  const fromClasses = (element.getAttribute("class")?.split(" ") ?? []).flatMap(
    (token) => {
      const steps = /(?:^|:)(?:min-)?(?:h|size)-(\d+(?:\.\d+)?)$/.exec(token);
      const pixels = /(?:^|:)(?:min-)?(?:h|size)-\[(\d+(?:\.\d+)?)px\]$/.exec(
        token,
      );
      return [
        ...(steps === null ? [] : [Number(steps[1]) * 4]),
        ...(pixels === null ? [] : [Number(pixels[1])]),
      ];
    },
  );
  const attribute = element.getAttribute("height");
  return [
    ...(attribute === null ? [] : [Number(attribute)]),
    ...fromStyle,
    ...fromClasses,
  ];
}

function headings(): string[] {
  return screen
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent ?? "");
}

describe("the detail view", () => {
  it("continues the bird's mood and speech, then its ledger in full words", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch);

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Perch");
    expect(container.textContent).toContain(perch.bubble.speech);
    expect(ledgerRows(container)).toEqual(
      perch.detail.ledger.map((entry) => [
        entry.label,
        entry.kind === "time" ? expect.stringMatching(/ ago$/) : entry.text,
      ]),
    );
  });

  it("roosts the bird on its page, facing left toward the record and idle", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch);
    const roost = screen.getByRole("region", { name: "Perch on its perch" });

    expect(roost.getAttribute("data-facing")).toBe("left");
    expect(
      roost
        .querySelector('[data-part="figure"]')
        ?.parentElement?.getAttribute("transform"),
    ).toMatch(/^scale\(-/);
    expect(
      roost.getElementsByClassName("motion-safe:animate-bird-bob"),
    ).toHaveLength(1);
    expect(container.querySelectorAll('[data-part="figure"]')).toHaveLength(1);
  });

  it("says the name and state word once, in the heading, and the speech once, in the roost's bubble", () => {
    const prism = mockBird("undev/prism");
    const { container } = page(prism);
    const bubble = screen.getByRole("region", { name: "Prism says" });

    expect(screen.getAllByRole("heading", { name: "Prism" })).toHaveLength(1);
    expect(
      [...container.querySelectorAll('[data-part="state-word"]')].map(
        (word) => word.textContent,
      ),
    ).toEqual(["distressed"]);
    expect(screen.getAllByText(prism.bubble.speech)).toHaveLength(1);
    expect(bubble.textContent).toContain(prism.bubble.speech);
    expect(
      within(bubble)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(prism.bubble.chips.map((chip) => chip.label));
    expect(container.querySelector('[data-part="meta"]')?.textContent).toMatch(
      /^~\/undev\/prism · /,
    );
  });

  it("lands a pressed chip on the ledger row holding its working: scrolled to the middle and marked", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch);
    const bubble = screen.getByRole("region", { name: "Perch says" });
    const [ci, , pulls] = perch.bubble.chips;
    if (ci === undefined || pulls === undefined) {
      throw new Error("perch carries a CI and a pull request chip");
    }
    const row = (chip: string) =>
      container.querySelector(`[data-part="record"] [data-chip="${chip}"]`);
    const markedRow = () =>
      container
        .querySelector('[data-part="landing"]')
        ?.parentElement?.getAttribute("data-chip");

    expect(container.querySelector('[data-part="landing"]')).toBeNull();
    fireEvent.click(within(bubble).getByRole("button", { name: ci.label }));

    expect(scrolled).toEqual([{ element: row("ci"), options: landingOptions }]);
    expect(markedRow()).toBe("ci");
    expect(row("ci")?.textContent).toContain("forgejo · pending on main");

    fireEvent.click(within(bubble).getByRole("button", { name: pulls.label }));

    expect(pulls.kind).toBe("pull-requests");
    expect(scrolled.at(-1)?.element).toBe(row("pull-requests"));
    expect(container.querySelectorAll('[data-part="landing"]')).toHaveLength(1);
    expect(markedRow()).toBe("pull-requests");
  });

  it("shows a pressed bug line on the paper: its file's tab open and its line scrolled to the middle and marked", () => {
    const hothouse = mockBird("obsidian/Hothouse");
    const { container } = page(hothouse, {
      sheets: hothouse.detail.keyFiles.map((file) => ({
        file,
        markdown: "- bug 1\n- task 2\n",
      })),
    });
    const record = container.querySelector('[data-part="record"]');
    const paper = container.querySelector('[data-part="paper"]');
    if (record === null || paper === null) {
      throw new Error("the page has a record and a paper pane");
    }

    fireEvent.click(
      within(record as HTMLElement).getByRole("button", { name: "bug 1" }),
    );

    expect(
      within(paper as HTMLElement).getByRole("tab", { selected: true })
        .textContent,
    ).toBe("Tech/Tech Plans.md");
    const revealed = paper.querySelector("[data-revealed]");
    expect(revealed?.textContent).toBe("bug 1");
    expect(scrolled).toEqual([{ element: revealed, options: landingOptions }]);
    expect(markedAtScroll).toEqual([true]);
  });

  it("scrolls only the row's own pane when landing on a chip", () => {
    const perch = mockBird("dev/perch");
    page(perch);
    const bubble = screen.getByRole("region", { name: "Perch says" });
    const [ci] = perch.bubble.chips;
    if (ci === undefined) throw new Error("perch carries a CI chip");

    fireEvent.click(within(bubble).getByRole("button", { name: ci.label }));

    expect(scrolled.map(({ options }) => options)).toEqual([
      { block: "center", behavior: "instant", container: "nearest" },
    ]);
  });

  it("lands the parked chip on the branches section, marked with a dot, and gives a bird without it no handle", () => {
    const skiff = mockBird("undev/skiff");
    const { container } = page(skiff);
    const bubble = screen.getByRole("region", { name: "Skiff says" });
    const section = container.querySelector(
      '[data-part="record"] [data-part="branches"]',
    );

    expect(section?.getAttribute("data-chip")).toBe("stalled");
    expect(section?.querySelector('[data-part="handle-mark"]')).not.toBeNull();
    fireEvent.click(
      within(bubble).getByRole("button", { name: "parked 21 days" }),
    );

    expect(scrolled.map(({ element }) => element)).toEqual([section]);
    expect(section?.querySelector('[data-part="landing"]')).not.toBeNull();

    cleanup();
    const perch = page(mockBird("dev/perch"));

    expect(
      perch.container
        .querySelector('[data-part="branches"]')
        ?.hasAttribute("data-chip"),
    ).toBe(false);
  });

  it("lands the can't-read chip on the record's notice, whose Sources opens the settings page", () => {
    const skiff = unreadableSkiff();
    const { container, onSettings } = page(skiff);
    const bubble = screen.getByRole("region", { name: "Skiff says" });
    const notice = container.querySelector('[data-part="notices"]');

    expect(notice?.textContent).toBe(
      "The clone pushes to skiff-app/skiff on github, which no GitHub card reads. Add a card for skiff-app under Sources.",
    );
    expect(
      container.querySelector('[data-part="heading"] [data-part="notices"]'),
    ).toBe(notice);
    fireEvent.click(
      within(bubble).getByRole("button", { name: "can't read github" }),
    );

    expect(scrolled.map(({ element }) => element)).toEqual([notice]);
    expect(notice?.querySelector('[data-part="landing"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sources" }));

    expect(onSettings).toHaveBeenCalledOnce();
  });

  it("gives a bird whose remotes all read no notice", () => {
    const { container } = page(mockBird("dev/perch"));

    expect(container.querySelector('[data-part="notices"]')).toBeNull();
  });

  describe("a bird with no clone here", () => {
    const pergolaNotes = () => mockBird("forgejo:finch/field-notes");
    const slipOf = (container: HTMLElement) =>
      container.querySelector(
        '[data-part="paper"] [data-part="no-clone-slip"]',
      );

    it("lays the slip where the key files would be: stamped, the fact, the route naming the repository, and Open Sources", () => {
      const { container, onLocalSources } = page(pergolaNotes());
      const slip = screen.getByRole("region", {
        name: "No clone on this machine",
      });

      expect(slipOf(container)).toBe(slip);
      expect(within(slip).getByRole("heading", { level: 3 }).textContent).toBe(
        "No clone on this machine",
      );
      expect(
        [...slip.querySelectorAll("p")].map((line) => line.textContent),
      ).toEqual([
        "This repository is on Forgejo. No local clone was found.",
        "Add a directory to search, or the clone's folder itself, in Sources. A clone whose remote points at finch/field-notes joins this bird on the next scan.",
      ]);
      fireEvent.click(
        within(slip).getByRole("button", { name: "Open Sources" }),
      );

      expect(onLocalSources).toHaveBeenCalledOnce();
    });

    it("copies the clone address through the caller and says so in place, then reads Copy again", async () => {
      vi.useFakeTimers();
      try {
        const { onCopy } = page(pergolaNotes());
        const slip = screen.getByRole("region", {
          name: "No clone on this machine",
        });
        const address = "ssh://git@forgejo:2222/finch/field-notes.git";

        expect(within(slip).getByText(address)).toBeDefined();
        await act(async () => {
          fireEvent.click(within(slip).getByRole("button", { name: "Copy" }));
        });

        expect(onCopy).toHaveBeenCalledWith(address);
        expect(
          within(slip).getByRole("button", { name: "Copied" }),
        ).toBeDefined();
        act(() => vi.advanceTimersByTime(1600));

        expect(
          within(slip).getByRole("button", { name: "Copy" }),
        ).toBeDefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("says it couldn't copy when the clipboard refuses", async () => {
      const { onCopy } = page(pergolaNotes());
      onCopy.mockRejectedValueOnce(new Error("not allowed"));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy" }));
      });

      expect(
        screen.getByRole("button", { name: "Couldn't copy" }),
      ).toBeDefined();
    });

    it("leaves the address row out while the address is unknown", () => {
      const bird = pergolaNotes();
      const noClone = bird.detail.noClone;
      if (noClone === null) throw new Error("pergola notes has its slip");
      const { container } = page({
        ...bird,
        detail: { ...bird.detail, noClone: { ...noClone, cloneAddress: null } },
      });

      expect(slipOf(container)).not.toBeNull();
      expect(container.querySelector('[data-part="clone-address"]')).toBeNull();
      expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    });

    it("lays the same slip for a fence bird", () => {
      const { container } = page(mockBird("github:finch/obsidian-tidy"));

      expect(slipOf(container)?.textContent).toContain(
        "This repository is on GitHub. No local clone was found.",
      );
    });

    it("says no local clone on the meta line where the actions would be, only while config holds an action", () => {
      const bird = pergolaNotes();
      const noClone = bird.detail.noClone;
      if (noClone === null) throw new Error("pergola notes has its slip");
      const clause = (container: HTMLElement) =>
        container.querySelector('[data-part="actions"] [data-part="no-clone"]');

      const { container } = page(bird);
      expect(clause(container)?.textContent).toBe("no local clone");

      cleanup();
      const silent = page({
        ...bird,
        detail: { ...bird.detail, noClone: { ...noClone, onMetaLine: false } },
      });
      expect(clause(silent.container)).toBeNull();
      expect(slipOf(silent.container)).not.toBeNull();
    });

    it("draws neither the slip nor the clause for a bird with a clone, even with no key files read", () => {
      const { container } = page(mockBird("dev/odin/hello"));

      expect(slipOf(container)).toBeNull();
      expect(container.querySelector('[data-part="no-clone"]')).toBeNull();
    });
  });

  it("lands the chip's row in the same paint as the press", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch);
    const bubble = screen.getByRole("region", { name: "Perch says" });
    const [ci] = perch.bubble.chips;
    if (ci === undefined) throw new Error("perch carries a CI chip");

    fireEvent.click(within(bubble).getByRole("button", { name: ci.label }));

    expect(markedAtScroll).toEqual([true]);
    expect(
      container.querySelector('[data-part="record"] [data-part="landing"]'),
    ).not.toBeNull();
  });

  it("lands on the arrival chip's row as the page opens, again when another arrives, and not at all without one", () => {
    const perch = mockBird("dev/perch");
    const { container, push } = page(perch);
    const row = (chip: string) =>
      container.querySelector(`[data-part="record"] [data-chip="${chip}"]`);
    const markedRow = () =>
      container
        .querySelector('[data-part="landing"]')
        ?.parentElement?.getAttribute("data-chip");

    expect(scrolled).toEqual([]);
    expect(markedRow()).toBeUndefined();

    push(perch, { arrivalChip: "open-items" });
    expect(scrolled).toEqual([
      {
        element: row("open-items"),
        options: landingOptions,
      },
    ]);
    expect(markedRow()).toBe("open-items");

    push(perch, { arrivalChip: "ci" });
    expect(scrolled.at(-1)?.element).toBe(row("ci"));
    expect(scrolled).toHaveLength(2);
    expect(markedRow()).toBe("ci");
  });

  it("marks the arrival chip's row in the page's first commit and scrolls to it once as it mounts", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch, { arrivalChip: "pull-requests" });
    const row = container.querySelector(
      '[data-part="record"] [data-chip="pull-requests"]',
    );

    expect(scrolled).toEqual([{ element: row, options: landingOptions }]);
    expect(markedAtScroll).toEqual([true]);
    expect(row?.querySelector('[data-part="landing"]')).not.toBeNull();
  });

  it("lands an arrival chip with no flushSync warning from React", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const perch = mockBird("dev/perch");
      const { push } = page(perch, { arrivalChip: "ci" });
      push(perch, { arrivalChip: "open-items" });

      expect(scrolled).toHaveLength(2);
      expect(
        errors.mock.calls.filter((call) =>
          String(call[0]).includes("flushSync"),
        ),
      ).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  });

  it("skips its swap when mounted during a pan, landing an arrival chip as it mounts", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch, { arrivalChip: "ci", panning: true });
    const article = screen.getByRole("article", { name: "Perch in full" });
    const ciRow = container.querySelector(
      '[data-part="record"] [data-chip="ci"]',
    );

    expect(article.className).not.toContain("animate-swap");
    expect(scrolled.map(({ element }) => element)).toEqual([ciRow]);
    expect(ciRow?.querySelector('[data-part="landing"]')).not.toBeNull();
  });

  it("lands a roost press at once while the ground pans", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch, { panning: true });
    const [ci] = perch.bubble.chips;
    if (ci === undefined) throw new Error("perch carries a CI chip");

    fireEvent.click(
      within(screen.getByRole("region", { name: "Perch says" })).getByRole(
        "button",
        { name: ci.label },
      ),
    );

    expect(scrolled).toHaveLength(1);
    expect(markedAtScroll).toEqual([true]);
    expect(
      container
        .querySelector('[data-part="landing"]')
        ?.parentElement?.getAttribute("data-chip"),
    ).toBe("ci");
  });

  it("lays the band out as one row above the panes, the bubble between the heading and the bird at its reading cap, its chips on one row", () => {
    const prism = mockBird("undev/prism");
    const { container } = page(prism);
    const roost = screen.getByRole("region", { name: "Prism on its perch" });
    const bubble = screen.getByRole("region", { name: "Prism says" });
    const bird = within(roost).getByRole("img");
    const part = (name: string) => {
      const element = container.querySelector(`[data-part="${name}"]`);
      if (element === null) throw new Error(`the page has no ${name}`);
      return element;
    };
    const classes = (element: Element | null | undefined) =>
      element?.getAttribute("class")?.split(" ") ?? [];
    const band = part("band");
    const heading = part("heading");
    const panes = part("panes");
    const cell = part("roost-cell");
    const speech = part("roost-speech");
    const following = (from: Element, to: Element) =>
      from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING;
    const chips = [...bubble.querySelectorAll("[data-kind]")];

    expect(heading.querySelector("h2")?.textContent).toBe("Prism");
    expect(band.contains(heading)).toBe(true);
    expect(band.contains(roost)).toBe(true);
    expect(classes(band)).toContain("row-start-1");
    expect(classes(panes)).toContain("row-start-2");
    expect(following(band, panes)).toBeTruthy();
    expect(band.contains(panes)).toBe(false);
    expect(panes.contains(part("record"))).toBe(true);
    expect(panes.contains(part("paper"))).toBe(true);
    expect(classes(panes)).toContain("min-h-0");
    expect(classes(panes.parentElement)).toEqual(
      expect.arrayContaining([
        "@container",
        "min-h-0",
        "flex-1",
        "grid-rows-[auto_minmax(0,1fr)]",
      ]),
    );
    // One row from 860px: the heading, then the bubble, then the bird, in the band's own flow.
    expect(classes(band)).toEqual(
      expect.arrayContaining(["flex", "@min-[860px]:flex-row"]),
    );
    expect([...band.children]).toEqual([heading, cell]);
    expect(cell.contains(roost)).toBe(true);
    expect(following(heading, bubble)).toBeTruthy();
    expect(following(bubble, bird)).toBeTruthy();
    expect(speech.contains(bubble)).toBe(true);
    expect(speech.nextElementSibling).toBe(bird);
    // The heading takes what the roost leaves; the roost is only as wide as the bubble and bird.
    expect(classes(heading)).toContain("@min-[860px]:flex-[1_1_22rem]");
    expect(classes(cell)).toEqual(
      expect.arrayContaining([
        "@min-[860px]:w-auto",
        "@min-[860px]:min-w-0",
        "@min-[860px]:flex-[0_1_auto]",
      ]),
    );
    expect(band.className).not.toMatch(/480px|grid-cols/);
    // The bubble grows to its words at a reading cap, and its chips share one wrapping row.
    expect(classes(speech)).toEqual(
      expect.arrayContaining([
        "@min-[460px]:w-max",
        "@min-[460px]:max-w-[56ch]",
      ]),
    );
    expect(chips.map((chip) => chip.textContent)).toEqual(
      prism.bubble.chips.map((chip) => chip.label),
    );
    expect(new Set(chips.map((chip) => chip.parentElement)).size).toBe(1);
    expect(classes(chips[0]?.parentElement)).toEqual(
      expect.arrayContaining(["flex", "flex-wrap"]),
    );
  });

  it("packs every verb of the band into one wrapping row", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch, { form: mockEntryForm(perch.id) });
    const actions = container.querySelector('[data-part="actions"]');
    const verbs = [...(actions?.querySelectorAll("button, a") ?? [])];

    expect(perch.detail.actions.length).toBeGreaterThanOrEqual(2);
    expect(perch.detail.links.length).toBeGreaterThanOrEqual(2);
    expect(verbs).toHaveLength(
      perch.detail.actions.length + perch.detail.links.length + 1,
    );
    expect(verbs.map((verb) => verb.textContent).at(-1)).toBe("The papers");
    for (const verb of verbs) {
      expect(verb.parentElement).toBe(actions);
    }
  });

  it("keeps the heading to tight rows: name, then the meta with the actions, links and verb beside it", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch, { form: mockEntryForm(perch.id) });
    const heading = container.querySelector('[data-part="heading"]');
    const metaRow = heading?.querySelector('[data-part="meta-row"]');
    const actions = metaRow?.querySelector('[data-part="actions"]');

    expect(metaRow?.firstElementChild?.getAttribute("data-part")).toBe("meta");
    expect(metaRow?.children).toHaveLength(2);
    expect(metaRow?.className.split(" ")).toEqual(
      expect.arrayContaining(["flex", "flex-wrap"]),
    );
    expect(
      actions?.contains(
        screen.getByRole("button", { name: /Open the folder/ }),
      ),
    ).toBe(true);
    expect(
      actions?.contains(
        screen.getByRole("link", { name: /finch\/perch on GitHub/ }),
      ),
    ).toBe(true);
    expect(
      actions?.contains(screen.getByRole("button", { name: "The papers" })),
    ).toBe(true);
    expect(heading?.querySelector('[data-part="notices"]')).toBeNull();
    expect(heading?.querySelector('[data-part="problems"]')).toBeNull();
  });

  it("holds the band to the bird's height: nothing in it declares a greater one", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch, {
      form: mockEntryForm(perch.id),
      problems: ["Could not open zellij: no such session"],
    });
    const band = container.querySelector('[data-part="band"]') as Element;
    const bird = within(band as HTMLElement).getByRole("img");
    const layout = band.querySelector(
      '[data-part="roost-layout"]',
    ) as HTMLElement;
    const bleed = Number.parseFloat(
      layout.style.getPropertyValue("--row-bleed"),
    );
    const { perchY } = roostFrame(perch);

    // The drawing is the band's tallest thing: its pole and shadow bleed below, leaving the bird on its crossbar.
    expect(bird.getAttribute("class")).toContain(
      "@min-[460px]:-mb-(--row-bleed)",
    );
    expect(Number(bird.getAttribute("height")) - bleed).toBe(perchY);
    for (const element of [band, ...band.querySelectorAll("*")]) {
      if (element === bird) continue;
      for (const height of declaredHeights(element)) {
        expect(height).toBeLessThanOrEqual(perchY);
      }
    }
  });

  it("stacks a narrow page's band as before: the heading, then the roost centred in its column beneath", () => {
    const { container } = page(mockBird("dev/perch"));
    const band = container.querySelector('[data-part="band"]');
    const cell = container.querySelector('[data-part="roost-cell"]');
    const roostLayout = container.querySelector('[data-part="roost-layout"]');
    const classes = (element: Element | null | undefined) =>
      element?.getAttribute("class")?.split(" ") ?? [];

    expect(classes(band)).toEqual(
      expect.arrayContaining(["flex", "flex-col", "gap-y-3"]),
    );
    expect(band?.firstElementChild?.getAttribute("data-part")).toBe("heading");
    expect(band?.lastElementChild).toBe(cell);
    expect(classes(cell)).toEqual(
      expect.arrayContaining(["mx-auto", "w-120", "max-w-full"]),
    );
    expect(roostColumnWidth).toBe(480);
    // Under 460px the roost stacks: the bubble above the bird, its tail hanging to the beak.
    expect(classes(roostLayout)).toContain("flex-col");
    expect(
      container
        .querySelector('[data-part="tail-hanging"]')
        ?.getAttribute("class"),
    ).toContain("@min-[460px]:hidden");
  });

  it("holds the key files in the paper pane beside the record, with no height cap of their own", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch, {
      sheets: perch.detail.keyFiles.map((file) => ({
        file,
        markdown: `# ${file.path}\n`,
      })),
    });
    const paper = container.querySelector('[data-part="paper"]');
    const record = container.querySelector('[data-part="record"]');
    const sheet = screen.getByRole("tabpanel");

    expect(paper?.contains(screen.getByRole("tablist"))).toBe(true);
    expect(paper?.contains(sheet)).toBe(true);
    expect(record?.querySelector('[role="tablist"]')).toBeNull();
    expect(paper?.className.split(" ")).toContain(
      "@min-[960px]:overflow-y-auto",
    );
    for (
      let link: Element | null = sheet;
      link !== paper && link !== null;
      link = link.parentElement
    ) {
      expect(link.className).not.toMatch(/max-h|overflow/);
    }
  });

  it("keeps one pane in a narrow page, the key files at the record's end", () => {
    const { container } = page(mockBird("dev/perch"));
    const panes = container.querySelector('[data-part="panes"]');
    const record = container.querySelector('[data-part="record"]');
    const paper = container.querySelector('[data-part="paper"]');
    const classes = (element: Element | null) =>
      element?.className.split(" ") ?? [];

    expect(classes(panes)).toEqual(
      expect.arrayContaining([
        "overflow-y-auto",
        "pane-scroll",
        "@min-[960px]:overflow-hidden",
        "@min-[960px]:grid-cols-[minmax(350px,450px)_minmax(0,1fr)]",
      ]),
    );
    for (const pane of [record, paper]) {
      expect(classes(pane)).not.toContain("overflow-y-auto");
      expect(classes(pane)).toContain("@min-[960px]:overflow-y-auto");
    }
    expect(
      [...(panes?.children ?? [])].map((child) =>
        child.getAttribute("data-part"),
      ),
    ).toEqual(["record", "paper"]);
  });

  it("keeps a main-process problem in the fixed band, whatever the record's scroll", () => {
    const { container } = page(mockBird("dev/odin/hello"), {
      problems: ["Could not open zellij: no such session"],
    });
    const problems = container.querySelector('[data-part="problems"]');

    expect(
      container.querySelector('[data-part="band"]')?.contains(problems),
    ).toBe(true);
    expect(
      container.querySelector('[data-part="record"]')?.contains(problems),
    ).toBe(false);
  });

  it("keeps the launch actions and links in the heading cell, not the record", () => {
    const { container } = page(mockBird("dev/perch"));
    const heading = container.querySelector('[data-part="heading"]');
    const record = container.querySelector('[data-part="record"]');
    const open = screen.getByRole("button", { name: /Open the folder/ });

    expect(heading?.contains(open)).toBe(true);
    expect(record?.contains(open)).toBe(false);
    expect(heading?.querySelector("a")).not.toBeNull();
    expect(record?.querySelector("button")).toBeNull();
  });

  it("offers the launch actions as verbs, hands back the one pressed, and links out", () => {
    const perch = mockBird("dev/perch");
    const { onLaunch } = page(perch);

    fireEvent.click(screen.getByRole("button", { name: /Open the folder/ }));

    expect(onLaunch).toHaveBeenCalledWith(perch.detail.actions[2]);
    expect(
      screen.getByRole("link", { name: /finch\/perch on GitHub/ }),
    ).toBeDefined();
  });

  it("shows the sections that exist and leaves out the empty ones", () => {
    const perch = mockBird("dev/perch");
    page(perch);
    expect(headings()).toEqual(
      expect.arrayContaining(["Branches", "Open pull requests"]),
    );
    expect(
      headings().filter(
        (heading) => heading === "Commits on main, and where each has reached",
      ),
    ).toHaveLength(1);
    cleanup();

    page({
      ...perch,
      detail: {
        ...perch.detail,
        river: { ...perch.detail.river, commits: [] },
      },
    });
    expect(headings()).not.toContain(
      "Commits on main, and where each has reached",
    );
    cleanup();

    page(mockBird("undev/prism"));
    expect(headings()).toContain("What couldn't be read");
    cleanup();

    page(mockBird("undev/spool"));
    expect(headings()).not.toContain("Open pull requests");
    expect(headings()).not.toContain("What couldn't be read");
  });

  it("offers nothing to launch for a bird with no clone here", () => {
    const { container } = page(mockBird("github:finch/obsidian-tidy"));
    const actions = container.querySelector('[data-part="actions"]');
    if (!(actions instanceof HTMLElement)) throw new Error("no action row");

    expect(within(actions).queryByRole("button", { name: /^Open/ })).toBeNull();
    expect(
      screen.getByRole("link", { name: /obsidian-tidy on GitHub/ }),
    ).toBeDefined();
  });

  it("puts the key files the caller read on paper", () => {
    const perch = mockBird("dev/perch");
    page(perch, {
      sheets: perch.detail.keyFiles.map((file) => ({
        file,
        markdown: `# ${file.path}\n`,
      })),
    });

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "README.md",
      "docs/forge-access.md",
      "docs/roadmap.md",
    ]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "README.md",
    );
  });

  it("offers a fence bird adoption, and signs the papers onto the wire chosen", () => {
    const hello = mockBird("dev/odin/hello");
    const { onSave } = page(hello, { form: mockEntryForm(hello.id) });

    expect(screen.queryByRole("button", { name: "The papers" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    fireEvent.click(screen.getByRole("radio", { name: "Machine & Home" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Adopt onto Machine & Home" }),
    );

    expect(onSave).toHaveBeenCalledWith("dev/odin/hello", {
      ...emptyEntryValues(),
      wire: "Machine & Home",
    });
  });

  it("folds signed papers once the entry read back shows the write", () => {
    const hello = mockBird("dev/odin/hello");
    const { push } = page(hello, { form: mockEntryForm(hello.id) });
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    fireEvent.click(screen.getByRole("radio", { name: "Machine & Home" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Adopt onto Machine & Home" }),
    );
    expect(
      screen.getByRole("form", { name: "Adoption papers for hello" }),
    ).toBeDefined();

    const config = withEntry(mockConfig, helloItem, {
      ...emptyEntryValues(),
      wire: "Machine & Home",
    });
    const adopted = findBird(
      deriveAviary(mockSnapshot, config, mockHome),
      hello.id,
    );
    push(adopted, { form: entryFormFor(config, helloItem, mockHome) });

    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.getByRole("button", { name: "The papers" })).toBeDefined();
  });

  it("keeps refused papers open, with the reason above the signature", () => {
    const hello = mockBird("dev/odin/hello");
    const form = mockEntryForm(hello.id);
    const { push } = page(hello, { form });
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Adopt onto Projects" }),
    );

    push(hello, {
      form: mockEntryForm(hello.id),
      problems: ["The config was not changed: the disk is read-only"],
    });

    expect(
      screen.getByRole("form", { name: "Adoption papers for hello" }),
    ).toBeDefined();
    expect(screen.getByRole("alert").textContent).toBe(
      "The config was not changed: the disk is read-only",
    );
  });

  it("shows a main-process problem under the intro without the papers open", () => {
    const hello = mockBird("dev/odin/hello");
    page(hello, { problems: ["Could not open zellij: no such session"] });

    expect(screen.getByRole("alert").textContent).toBe(
      "Could not open zellij: no such session",
    );
  });

  it("shows no problem strip when there are none", () => {
    const hello = mockBird("dev/odin/hello");
    const { container } = page(hello, { form: mockEntryForm(hello.id) });

    expect(container.querySelector('[data-part="problems"]')).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("leaves the problems to the open papers, and brings the strip back when they close", () => {
    const hello = mockBird("dev/odin/hello");
    const problems = ["The config was not changed: the disk is read-only"];
    const { container } = page(hello, {
      form: mockEntryForm(hello.id),
      problems,
    });
    expect(container.querySelector('[data-part="problems"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    expect(container.querySelector('[data-part="problems"]')).toBeNull();
    expect(screen.getAllByText(problems[0] ?? "")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    expect(container.querySelector('[data-part="problems"]')).not.toBeNull();
  });

  it("offers an adopted bird its papers to amend, and to return it to the fence", () => {
    const perch = mockBird("dev/perch");
    const form = mockEntryForm(perch.id);
    const { onSave, onRemove } = page(perch, { form });

    expect(screen.queryByRole("button", { name: "Adopt" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "The papers" }));
    fireEvent.click(screen.getByRole("button", { name: "Amend the papers" }));
    expect(onSave).toHaveBeenCalledWith("dev/perch", form.values);
    expect(screen.queryByRole("form")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "The papers" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Return to the fence" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Return it to the fence" }),
    );
    expect(onRemove).toHaveBeenCalledWith("dev/perch");
  });

  it("unfolds the papers as the page opens when asked, and again each time it is asked", () => {
    const hello = mockBird("dev/odin/hello");
    const form = mockEntryForm(hello.id);
    const { push } = page(hello, { form, openPapers: true });

    expect(
      screen.getByRole("form", { name: "Adoption papers for hello" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("form")).toBeNull();

    push(hello, { form, openPapers: false });
    push(hello, { form, openPapers: true });
    expect(
      screen.getByRole("form", { name: "Adoption papers for hello" }),
    ).toBeDefined();
  });

  it("raises the papers as a sheet over both panes, which are dimmed and inert, scrolling nothing", () => {
    const hello = mockBird("dev/odin/hello");
    const { container } = page(hello, { form: mockEntryForm(hello.id) });
    const panes = container.querySelector('[data-part="panes"]');
    expect(container.querySelector('[data-part="rising-sheet"]')).toBeNull();
    expect(panes?.hasAttribute("inert")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    const sheet = container.querySelector('[data-part="rising-sheet"]');
    expect(sheet).not.toBeNull();
    expect(sheet?.parentElement).toBe(panes?.parentElement);
    expect(
      within(sheet as HTMLElement).getByRole("form", {
        name: "Adoption papers for hello",
      }),
    ).toBeDefined();
    expect(panes?.hasAttribute("inert")).toBe(true);
    expect(panes?.classList.contains("opacity-25")).toBe(true);
    expect(panes?.contains(sheet)).toBe(false);
    for (const pane of ["record", "paper"]) {
      expect(
        container.querySelector(`[data-part="${pane}"]`)?.closest("[inert]"),
      ).toBe(panes);
    }
    expect(scrolled).toEqual([]);
  });

  it("restores the panes as the papers close, leaving the sheet inert while it slides away", () => {
    const hello = mockBird("dev/odin/hello");
    const { container } = page(hello, { form: mockEntryForm(hello.id) });
    const panes = container.querySelector('[data-part="panes"]');
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(panes?.hasAttribute("inert")).toBe(false);
    expect(panes?.classList.contains("opacity-25")).toBe(false);
    const leaving = container.querySelector('[data-part="rising-sheet"]');
    expect(leaving?.hasAttribute("inert")).toBe(true);
    expect(leaving?.getAttribute("aria-hidden")).toBe("true");
  });

  it("folds the papers on a press on the dimmed background without writing, and not on a press inside the card", () => {
    const hello = mockBird("dev/odin/hello");
    const { container, onSave, onRemove } = page(hello, {
      form: mockEntryForm(hello.id),
    });
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));

    fireEvent.click(
      screen.getByRole("form", { name: "Adoption papers for hello" }),
    );
    expect(
      screen.getByRole("form", { name: "Adoption papers for hello" }),
    ).toBeDefined();

    const background = container.querySelector(
      '[data-part="rising-sheet-background"]',
    );
    expect(background).not.toBeNull();
    if (background !== null) fireEvent.click(background);
    expect(screen.queryByRole("form")).toBeNull();
    expect(
      container.querySelector('[data-part="panes"]')?.hasAttribute("inert"),
    ).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("folds the papers on a press over the band's region, the catcher spanning both of the page's rows", () => {
    const hello = mockBird("dev/odin/hello");
    const { container, onSave, onRemove } = page(hello, {
      form: mockEntryForm(hello.id),
    });
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    const article = screen.getByRole("article", { name: "hello in full" });
    const band = container.querySelector('[data-part="band"]');
    const layer = container.querySelector('[data-part="rising-sheet"]');
    const catcher = container.querySelector(
      '[data-part="rising-sheet-background"]',
    );
    const classes = (element: Element | null) =>
      element?.className.split(" ") ?? [];

    expect(classes(article)).toContain("grid-rows-[auto_minmax(0,1fr)]");
    expect(band?.parentElement).toBe(article);
    expect(classes(band)).toContain("row-start-1");
    expect(layer?.parentElement).toBe(article);
    expect(classes(layer)).toEqual(
      expect.arrayContaining(["row-span-full", "grid-rows-subgrid"]),
    );
    expect(classes(catcher)).toContain("row-span-full");
    expect(
      classes(container.querySelector('[data-part="rising-sheet-surface"]')),
    ).toContain("row-[-2/-1]");

    if (catcher !== null) fireEvent.click(catcher);
    expect(screen.queryByRole("form")).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("keeps the band, the heading, the verb and the roost undimmed outside the panes, resting under the catcher", () => {
    const hello = mockBird("dev/odin/hello");
    const { container } = page(hello, { form: mockEntryForm(hello.id) });
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));

    const panes = container.querySelector('[data-part="panes"]');
    const band = container.querySelector('[data-part="band"]');
    const heading = container.querySelector('[data-part="heading"]');
    const roost = container.querySelector('[data-part="roost"]');
    const layer = container.querySelector('[data-part="rising-sheet"]');
    const verb = screen.getByRole("button", { name: "Adopt" });
    if (band === null || heading === null || roost === null || layer === null) {
      throw new Error("the page has a band, heading, roost and sheet");
    }
    for (const element of [band, heading, verb, roost]) {
      expect(element.closest("[inert]")).toBeNull();
      expect(element.closest(".opacity-25")).toBeNull();
      expect(panes?.contains(element)).toBe(false);
      expect(layer.contains(element)).toBe(false);
    }
    expect(heading.contains(verb)).toBe(true);
    expect(band.parentElement).toBe(layer.parentElement);
    expect(layer.className.split(" ")).toEqual(
      expect.arrayContaining(["z-10", "row-span-full"]),
    );
  });

  it("offers neither until the entry is read, or while it disagrees with the bird", () => {
    page(mockBird("dev/perch"));
    expect(screen.queryByRole("button", { name: "The papers" })).toBeNull();
    cleanup();

    page(mockBird("dev/perch"), { form: mockEntryForm("dev/odin/hello") });
    expect(screen.queryByRole("button", { name: "Adopt" })).toBeNull();
  });
});
