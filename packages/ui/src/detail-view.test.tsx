import type { EntryForm } from "@perch/core/entry-form.ts";
import { mockSnapshot } from "@perch/core/mock.ts";
import type { Bird } from "@perch/core/viewmodel.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailView } from "./detail-view.tsx";
import { mockBird, mockEntryForm } from "./mock-birds.ts";
import type { KeyFileSheet } from "./paper.tsx";

afterEach(cleanup);

const now = new Date(mockSnapshot.scannedAt);

function page(
  bird: Bird,
  sheets: KeyFileSheet[] = [],
  form: EntryForm | null = null,
) {
  const onLaunch = vi.fn();
  const onSave = vi.fn();
  const onRemove = vi.fn();
  const { container } = render(
    <DetailView
      bird={bird}
      now={now}
      onLaunch={onLaunch}
      sheets={sheets}
      entry={{ form, onSave, onRemove }}
    />,
  );
  return { container, onLaunch, onSave, onRemove };
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
    page(
      perch,
      perch.detail.keyFiles.map((file) => ({
        file,
        markdown: `# ${file.path}\n`,
      })),
    );

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "README.md",
      "docs/spec.md",
      "docs/roadmap.md",
    ]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "README.md",
    );
  });

  it("offers a fence bird adoption, and writes the entry on confirming", () => {
    const hello = mockBird("dev/odin/hello");
    const { onSave } = page(hello, [], mockEntryForm(hello.id));

    expect(screen.queryByRole("button", { name: "Edit entry" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));
    fireEvent.click(screen.getByRole("radio", { name: "Machine & Home" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Adopt" }).at(-1) as HTMLElement,
    );

    expect(onSave).toHaveBeenCalledWith("dev/odin/hello", {
      wire: "Machine & Home",
      name: null,
      importance: null,
      expect: [],
      keyFiles: null,
      roadmaps: null,
      thresholds: {},
      zellijSession: null,
    });
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("offers an adopted bird its entry to edit, and to unadopt", () => {
    const perch = mockBird("dev/perch");
    const form = mockEntryForm(perch.id);
    const { onSave, onRemove } = page(perch, [], form);

    expect(screen.queryByRole("button", { name: "Adopt" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit entry" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("dev/perch", form.values);

    fireEvent.click(screen.getByRole("button", { name: "Edit entry" }));
    fireEvent.click(screen.getByRole("button", { name: "Unadopt" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Return to the fence" }),
    );
    expect(onRemove).toHaveBeenCalledWith("dev/perch");
  });

  it("offers neither until the entry is read, or while it disagrees with the bird", () => {
    page(mockBird("dev/perch"));
    expect(screen.queryByRole("button", { name: "Edit entry" })).toBeNull();
    cleanup();

    page(mockBird("dev/perch"), [], mockEntryForm("dev/odin/hello"));
    expect(screen.queryByRole("button", { name: "Adopt" })).toBeNull();
  });
});
