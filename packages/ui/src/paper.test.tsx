import type { LineMarks } from "@perch/core/viewmodel.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KeyFilePaper, type KeyFileSheet, type Reveal } from "./paper.tsx";

afterEach(cleanup);

/** The elements scrolled into view, since jsdom does no scrolling. */
const scrolled: Element[] = [];
Element.prototype.scrollIntoView = function (this: Element) {
  scrolled.push(this);
};
afterEach(() => {
  scrolled.length = 0;
});

const file = (path: string, marks: LineMarks = {}) => ({
  path,
  absolutePath: `/home/owner/dev/perch/${path}`,
  marks,
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
    render(<KeyFilePaper reveal={null} sheets={sheets} />);

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
      <KeyFilePaper
        reveal={null}
        sheets={[{ file: file("README.md"), markdown }]}
      />,
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
    render(<KeyFilePaper reveal={null} sheets={sheets} />);

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
    render(<KeyFilePaper reveal={null} sheets={sheets} />);
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
        reveal={null}
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

  it("marks a roadmap's bug lines as found, a critical bug and a done bug each its own way, and leaves other lines bare", () => {
    const markdown = [
      "# Roadmap", // 1
      "", // 2
      "## Critical", // 3
      "", // 4
      "- [ ] Data loss when two devices save at once", // 5
      "  - seen on Android only so far", // 6
      "", // 7
      "## Bugs", // 8
      "", // 9
      "- [x] A CSV with a byte order mark fails to parse", // 10
      "- [ ] Dates read as US format", // 11
      "", // 12
      "## Forge issues source", // 13
      "", // 14
      "- Queue edits while offline", // 15
    ].join("\n");
    const { container } = render(
      <KeyFilePaper
        reveal={null}
        sheets={[
          {
            file: file("docs/roadmap.md", {
              5: { kind: "critical-bug", done: false },
              10: { kind: "bug", done: true },
              11: { kind: "bug", done: false },
              13: { kind: "bug", done: false },
            }),
            markdown,
          },
        ]}
      />,
    );
    const marked = (element: Element) => [
      element.textContent?.split("\n")[0]?.trim(),
      element.getAttribute("data-mark"),
      element.hasAttribute("data-mark-done"),
    ];

    expect([...container.querySelectorAll("li, h1, h2")].map(marked)).toEqual([
      ["Roadmap", null, false],
      ["Critical", null, false],
      ["Data loss when two devices save at once", "critical-bug", false],
      ["seen on Android only so far", null, false],
      ["Bugs", null, false],
      ["A CSV with a byte order mark fails to parse", "bug", true],
      ["Dates read as US format", "bug", false],
      ["Forge issues source", "bug", false],
      ["Queue edits while offline", null, false],
    ]);
  });

  it("opens a reveal's file and scrolls the element on its line into view, marked afresh for each press", () => {
    const roadmap: KeyFileSheet = {
      file: file("docs/roadmap.md", {
        3: { kind: "bug", done: false },
        4: { kind: "bug", done: false },
      }),
      markdown: [
        "# Roadmap", // 1
        "", // 2
        "- [ ] Dates read as US format", // 3
        "- [ ] Times drift by an hour", // 4
      ].join("\n"),
    };
    const readme = sheets[0];
    if (readme === undefined) throw new Error("the sheets start with a readme");
    const reveal = (press: number): Reveal => ({
      at: { path: "docs/roadmap.md", line: 4 },
      press,
    });
    const { container, rerender } = render(
      <KeyFilePaper sheets={[readme, roadmap]} reveal={null} />,
    );
    const marks = () =>
      [...container.querySelectorAll('[data-part="landing"]')].map((mark) =>
        mark.parentElement?.textContent?.trim(),
      );

    rerender(<KeyFilePaper sheets={[readme, roadmap]} reveal={reveal(1)} />);

    expect(
      screen
        .getByRole("tab", { name: "docs/roadmap.md" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(scrolled.map((element) => element.textContent?.trim())).toEqual([
      "Times drift by an hour",
    ]);
    expect(scrolled[0]?.hasAttribute("data-revealed")).toBe(true);
    expect(marks()).toEqual(["Times drift by an hour"]);

    fireEvent.click(screen.getByRole("tab", { name: "README.md" }));
    fireEvent.click(screen.getByRole("tab", { name: "docs/roadmap.md" }));

    expect(marks()).toEqual([]);

    rerender(<KeyFilePaper sheets={[readme, roadmap]} reveal={reveal(2)} />);

    expect(scrolled).toHaveLength(2);
    expect(marks()).toEqual(["Times drift by an hour"]);
  });

  it("draws nothing for a bird without key files", () => {
    const { container } = render(<KeyFilePaper reveal={null} sheets={[]} />);

    expect(container.innerHTML).toBe("");
  });
});
