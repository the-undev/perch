import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KeyFilePaper, type KeyFileSheet } from "./paper.tsx";

afterEach(cleanup);

const file = (path: string) => ({
  path,
  absolutePath: `/home/owner/dev/perch/${path}`,
});

const sheets: KeyFileSheet[] = [
  {
    file: file("README.md"),
    markdown:
      "# perch\n\nBirds on wires.\n\n## Running\n\n- `pnpm dev`\n- `pnpm check`\n\n1. first\n2. second\n",
  },
  { file: file("docs/roadmap.md"), markdown: "# Roadmap\n\nParked work.\n" },
  { file: file("docs/missing.md"), markdown: null },
];

describe("the key-file paper", () => {
  it("renders the first file's markdown headings and lists", () => {
    render(<KeyFilePaper sheets={sheets} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("perch");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Running",
    );
    const lists = screen.getAllByRole("list");
    expect(lists.map((list) => list.tagName)).toEqual(["UL", "OL"]);
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["pnpm dev", "pnpm check", "first", "second"]);
  });

  it("renders a relative image as its alt text and leaves remote images as images", () => {
    const markdown =
      "![build status](https://ci.example.com/badge.svg) ![diagram](docs/flow.png) ![](./bare.png)\n";
    const { container } = render(
      <KeyFilePaper sheets={[{ file: file("README.md"), markdown }]} />,
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute("src")).toBe(
      "https://ci.example.com/badge.svg",
    );
    expect(images[0]?.getAttribute("alt")).toBe("build status");
    expect(container.querySelector("p")?.textContent).toContain("diagram");
    expect(container.querySelector('img[src*="flow.png"]')).toBeNull();
  });

  it("puts each file behind a folder tab and opens the one pressed", () => {
    render(<KeyFilePaper sheets={sheets} />);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "README.md",
      "docs/roadmap.md",
      "docs/missing.md",
    ]);
    fireEvent.click(screen.getByRole("tab", { name: "docs/roadmap.md" }));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Roadmap",
    );
    expect(
      screen
        .getByRole("tab", { name: "docs/roadmap.md" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("says when a file could not be read", () => {
    render(<KeyFilePaper sheets={sheets} />);
    fireEvent.click(screen.getByRole("tab", { name: "docs/missing.md" }));

    expect(screen.getByRole("tabpanel").textContent).toBe(
      "docs/missing.md could not be read.",
    );
  });

  it("keeps a long document's full height with no scroll of its own, the tabs held at the pane's top", () => {
    const long = Array.from(
      { length: 200 },
      (_, i) => `## Section ${i}\n\nA paragraph.\n`,
    ).join("\n");
    render(
      <KeyFilePaper
        sheets={[{ file: file("docs/spec.md"), markdown: long }]}
      />,
    );
    const sheet = screen.getByRole("tabpanel");
    const classes = sheet.className.split(" ");
    const tabs = screen.getByRole("tablist").className.split(" ");

    expect(classes.filter((name) => /overflow|max-h/.test(name))).toEqual([]);
    expect(sheet.getAttribute("tabindex")).toBe("0");
    expect(sheet.style.height).toBe("");
    expect(sheet.querySelectorAll("h2")).toHaveLength(200);
    expect(tabs).toEqual(expect.arrayContaining(["sticky", "top-0"]));
  });

  it("draws nothing for a bird without key files", () => {
    const { container } = render(<KeyFilePaper sheets={[]} />);

    expect(container.innerHTML).toBe("");
  });
});
