import {
  type EntryForm,
  emptyEntryValues,
  entryFormFor,
  withEntry,
} from "@perch/core/entry-form.ts";
import { mockConfig, mockSnapshot } from "@perch/core/mock.ts";
import type { Aviary, Bird } from "@perch/core/viewmodel.ts";
import { deriveAviary } from "@perch/core/viewmodel.ts";
import {
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

interface PageOptions {
  sheets?: KeyFileSheet[];
  form?: EntryForm | null;
  problems?: string[];
  openPapers?: boolean;
}

function page(bird: Bird, options: PageOptions = {}) {
  const onLaunch = vi.fn();
  const onSave = vi.fn();
  const onRemove = vi.fn();
  const view = (next: Bird, given: PageOptions) => (
    <DetailView
      bird={next}
      now={now}
      onLaunch={onLaunch}
      sheets={given.sheets ?? []}
      entry={{ form: given.form ?? null, onSave, onRemove }}
      problems={given.problems ?? []}
      openPapers={given.openPapers ?? false}
    />
  );
  const { container, rerender } = render(view(bird, options));
  return {
    container,
    onLaunch,
    onSave,
    onRemove,
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
    expect(within(bubble).queryByRole("button")).toBeNull();
    expect(container.querySelector('[data-part="meta"]')?.textContent).toMatch(
      /^~\/undev\/prism · /,
    );
  });

  it("puts the heading and the roost in the top band and the record across the page below", () => {
    const { container } = page(mockBird("dev/perch"));
    const roost = screen.getByRole("region", { name: "Perch on its perch" });
    const heading = container.querySelector('[data-part="heading"]');
    const record = container.querySelector('[data-part="record"]');
    if (heading === null) throw new Error("the page has no heading");
    if (record === null) throw new Error("the page has no record");
    const following = (from: Element, to: Element) =>
      from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING;

    expect(heading.querySelector("h2")?.textContent).toBe("Perch");
    expect(following(heading, roost)).toBeTruthy();
    expect(following(roost, record)).toBeTruthy();
    expect(roost.parentElement?.className).toContain("mx-auto");
    expect(roost.parentElement?.className).toContain(
      "@min-[860px]:col-start-2",
    );
    expect(roost.parentElement?.className).toContain(
      "@min-[860px]:row-start-1",
    );
    expect(heading.className).toContain("@min-[860px]:col-start-1");
    expect(heading.className).toContain("@min-[860px]:row-start-1");
    expect(record.className).toContain("col-span-full");
    expect(record.className).toContain("@min-[860px]:row-start-2");
    expect(record.parentElement?.className).toContain(
      "@min-[860px]:grid-cols-[minmax(0,1fr)_330px]",
    );
    expect(record.parentElement?.className).toContain(
      "@min-[1240px]:grid-cols-[minmax(0,1fr)_620px]",
    );
    expect(roost.parentElement?.className).toContain("w-82.5");
    expect(roost.parentElement?.className).toContain("@min-[1240px]:w-155");
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
    page(mockBird("dev/perch"));
    expect(headings()).toEqual(
      expect.arrayContaining(["Branches", "Open pull requests"]),
    );
    cleanup();

    page(mockBird("undev/prism"));
    expect(headings()).toContain("Sources not read");
    cleanup();

    page(mockBird("undev/spool"));
    expect(headings()).not.toContain("Open pull requests");
    expect(headings()).not.toContain("Sources not read");
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
