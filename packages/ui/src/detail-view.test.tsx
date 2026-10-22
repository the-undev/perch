import { mockSnapshot } from "@perch/core/mock.ts";
import type { Bird } from "@perch/core/viewmodel.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailView } from "./detail-view.tsx";
import { mockBird } from "./mock-birds.ts";
import type { KeyFileSheet } from "./paper.tsx";

afterEach(cleanup);

const now = new Date(mockSnapshot.scannedAt);

function page(bird: Bird, sheets: KeyFileSheet[] = []) {
  const onLaunch = vi.fn();
  const { container } = render(
    <DetailView bird={bird} now={now} onLaunch={onLaunch} sheets={sheets} />,
  );
  return { container, onLaunch };
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
});
