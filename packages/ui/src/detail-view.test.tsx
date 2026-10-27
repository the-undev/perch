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

afterEach(cleanup);

/** The elements scrolled into view and how, since jsdom does no scrolling. */
const scrolled: { element: Element; options: unknown }[] = [];
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
  Reflect.deleteProperty(Element.prototype, "getAnimations");
});

/** Has every element report one running animation, as the page's arrival swap does in a browser. */
function swapPlaying() {
  Element.prototype.getAnimations = () => [{} as Animation];
}

/** An animation ending on an element and bubbling up, as React hears it under jsdom. */
function endAnimation(element: Element, animationName: string) {
  const event = new Event("webkitAnimationEnd", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: animationName });
  act(() => {
    element.dispatchEvent(event);
  });
}

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
}

function page(bird: Bird, options: PageOptions = {}) {
  const onLaunch = vi.fn();
  const onSave = vi.fn();
  const onRemove = vi.fn();
  const onSettings = vi.fn();
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
    />
  );
  const { container, rerender } = render(view(bird, options));
  return {
    container,
    onLaunch,
    onSave,
    onRemove,
    onSettings,
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

    expect(screen.getAllByRole("heading", { name: "Prism" })).toHaveLength(
      1,
    );
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

    expect(scrolled).toEqual([
      { element: row("ci"), options: { block: "center", behavior: "instant" } },
    ]);
    expect(markedRow()).toBe("ci");
    expect(row("ci")?.textContent).toContain("forgejo · pending on main");

    fireEvent.click(within(bubble).getByRole("button", { name: pulls.label }));

    expect(pulls.kind).toBe("pull-requests");
    expect(scrolled.at(-1)?.element).toBe(row("pull-requests"));
    expect(container.querySelectorAll('[data-part="landing"]')).toHaveLength(1);
    expect(markedRow()).toBe("pull-requests");
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
        options: { block: "center", behavior: "instant" },
      },
    ]);
    expect(markedRow()).toBe("open-items");

    push(perch, { arrivalChip: "ci" });
    expect(scrolled.at(-1)?.element).toBe(row("ci"));
    expect(scrolled).toHaveLength(2);
    expect(markedRow()).toBe("ci");
  });

  it("lands on the arrival chip's row as soon as the page mounts", () => {
    const perch = mockBird("dev/perch");
    const { container } = page(perch, { arrivalChip: "pull-requests" });
    const row = container.querySelector(
      '[data-part="record"] [data-chip="pull-requests"]',
    );

    expect(scrolled).toEqual([
      { element: row, options: { block: "center", behavior: "instant" } },
    ]);
    expect(row?.querySelector('[data-part="landing"]')).not.toBeNull();
  });

  it("holds an arrival chip's landing until the page's own swap ends, ignoring animations ending inside it", () => {
    swapPlaying();
    const perch = mockBird("dev/perch");
    const { container } = page(perch, { arrivalChip: "ci" });
    const article = screen.getByRole("article", { name: "Perch in full" });
    const ciRow = container.querySelector(
      '[data-part="record"] [data-chip="ci"]',
    );
    const figure = container.querySelector('[data-part="figure"]');
    if (ciRow === null || figure === null) {
      throw new Error("perch has a CI row and a figure");
    }

    expect(scrolled).toEqual([]);
    expect(container.querySelector('[data-part="landing"]')).toBeNull();

    endAnimation(figure, "beak-wiggle");
    endAnimation(ciRow, "land");
    endAnimation(article, "bird-bob");
    expect(scrolled).toEqual([]);
    expect(container.querySelector('[data-part="landing"]')).toBeNull();

    endAnimation(article, "swap");
    expect(scrolled).toEqual([
      { element: ciRow, options: { block: "center", behavior: "instant" } },
    ]);
    expect(ciRow.querySelector('[data-part="landing"]')).not.toBeNull();
  });

  it("lands a roost press at once, while the page's swap still plays", () => {
    swapPlaying();
    const perch = mockBird("dev/perch");
    const { container } = page(perch);
    const [ci] = perch.bubble.chips;
    if (ci === undefined) throw new Error("perch carries a CI chip");

    fireEvent.click(
      within(screen.getByRole("region", { name: "Perch says" })).getByRole(
        "button",
        { name: ci.label },
      ),
    );

    expect(scrolled).toHaveLength(1);
    expect(
      container
        .querySelector('[data-part="landing"]')
        ?.parentElement?.getAttribute("data-chip"),
    ).toBe("ci");
  });

  it("fixes the heading and the roost in the band above the panes, the roost in its 480px column", () => {
    const { container } = page(mockBird("dev/perch"));
    const roost = screen.getByRole("region", { name: "Perch on its perch" });
    const part = (name: string) => {
      const element = container.querySelector(`[data-part="${name}"]`);
      if (element === null) throw new Error(`the page has no ${name}`);
      return element;
    };
    const band = part("band");
    const heading = part("heading");
    const panes = part("panes");
    const following = (from: Element, to: Element) =>
      from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING;

    expect(heading.querySelector("h2")?.textContent).toBe("Perch");
    expect(band.contains(heading)).toBe(true);
    expect(band.contains(roost)).toBe(true);
    expect(band.className.split(" ")).toContain("flex-none");
    expect(band.className).toContain(
      "@min-[860px]:grid-cols-[minmax(0,1fr)_480px]",
    );
    expect(following(heading, roost)).toBeTruthy();
    expect(following(band, panes)).toBeTruthy();
    expect(band.contains(panes)).toBe(false);
    expect(panes.contains(part("record"))).toBe(true);
    expect(panes.contains(part("paper"))).toBe(true);
    expect(panes.className.split(" ")).toEqual(
      expect.arrayContaining(["min-h-0", "flex-1"]),
    );
    expect(roost.parentElement?.className).toContain("mx-auto");
    expect(roost.parentElement?.className).toContain(
      "@min-[860px]:col-start-2",
    );
    expect(roost.parentElement?.className).toContain(
      "@min-[860px]:row-start-1",
    );
    expect(heading.className).toContain("@min-[860px]:col-start-1");
    expect(heading.className).toContain("@min-[860px]:row-start-1");
    expect(roost.parentElement?.className).toContain("w-120");
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
        (heading) => heading === "Where each commit on main has reached",
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
    expect(headings()).not.toContain("Where each commit on main has reached");
    cleanup();

    page(mockBird("undev/prism"));
    expect(headings()).toContain("What couldn't be read");
    cleanup();

    page(mockBird("undev/spool"));
    expect(headings()).not.toContain("Open pull requests");
    expect(headings()).not.toContain("What couldn't be read");
  });

  it("offers nothing to launch for a bird with no clone here", () => {
    page(mockBird("github:finch/obsidian-tidy"));

    expect(screen.queryByRole("button", { name: /^Open/ })).toBeNull();
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
      "docs/spec.md",
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

  it("unfolds the papers at the record pane's top and brings them into view, the verb staying in the band", () => {
    const hello = mockBird("dev/odin/hello");
    const { container } = page(hello, { form: mockEntryForm(hello.id) });
    const record = container.querySelector('[data-part="record"]');
    const adopt = screen.getByRole("button", { name: "Adopt" });

    fireEvent.click(adopt);
    const papers = screen.getByRole("form", {
      name: "Adoption papers for hello",
    });

    expect(record?.firstElementChild?.contains(papers)).toBe(true);
    expect(container.querySelector('[data-part="band"]')?.contains(adopt)).toBe(
      true,
    );
    expect(scrolled).toEqual([
      {
        element: record?.firstElementChild,
        options: { block: "start", behavior: "instant" },
      },
    ]);
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

  it("offers neither until the entry is read, or while it disagrees with the bird", () => {
    page(mockBird("dev/perch"));
    expect(screen.queryByRole("button", { name: "The papers" })).toBeNull();
    cleanup();

    page(mockBird("dev/perch"), { form: mockEntryForm("dev/odin/hello") });
    expect(screen.queryByRole("button", { name: "Adopt" })).toBeNull();
  });
});
