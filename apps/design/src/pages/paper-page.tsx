import { KeyFilePaper } from "@perch/ui/paper.tsx";
import { perchFiles, sheetsFor } from "../key-files.ts";
import { mockBird } from "../specimens.ts";
import { Code, Ground, Section, Specimen, Usage } from "../usage.tsx";

const everyElement = `# Every element

A paragraph with \`inline code\`, a [link](https://example.test), **strong** and *emphasis*.

## Lists

- An item
- An item with a nested list
  - nested
- [x] a finished task
- [ ] an open task

1. First
2. Second

### A table

| Fact | Value |
| --- | --- |
| Node, pnpm | 26, 11 |
| Desktop | KDE Plasma 6 |

> A quotation from a decision doc.

\`\`\`bash
pnpm design
\`\`\`

---

The end.
`;

export function PaperPage() {
  const perch = mockBird("dev/perch");
  const hothouse = mockBird("obsidian/Hothouse");
  return (
    <>
      <Section
        title="Key files as paper"
        rule="A configurable list of key files rendered as paper, the bubble's material, with folder tabs. The sheet fills its column; the writing on it keeps a reading width. A sheet keeps its full height: the pane holding it scrolls, the folder tabs held at the pane's top."
        min={760}
      >
        <Specimen
          label="Three files from config"
          rule="Perch's key_files: the README, the spec and the roadmap. This repository's own files stand in for them."
        >
          <Ground>
            <KeyFilePaper
              sheets={sheetsFor(perch.detail.keyFiles, perchFiles)}
            />
          </Ground>
        </Specimen>
        <Specimen
          label="A long document scrolls its pane"
          rule="Perch's spec, many screens long, in a pane of fixed height as the bird's page gives it: the pane scrolls with a thin quiet scrollbar, and the folder tabs stay at its top."
        >
          <div className="pane-scroll h-[28rem] overflow-y-auto rounded-xl border border-edge bg-ground px-5 pb-4">
            <KeyFilePaper
              sheets={sheetsFor(
                [
                  { path: "docs/spec.md", absolutePath: "/spec.md" },
                  { path: "README.md", absolutePath: "/readme.md" },
                ],
                perchFiles,
              )}
            />
          </div>
        </Specimen>
        <Specimen
          label="Every markdown element"
          rule="Headings, lists, task lists, tables, quotations, code and rules, through react-markdown with GFM."
        >
          <Ground>
            <KeyFilePaper
              sheets={[
                {
                  file: { path: "ELEMENTS.md", absolutePath: "/elements.md" },
                  markdown: everyElement,
                },
              ]}
            />
          </Ground>
        </Specimen>
        <Specimen
          label="A file that could not be read"
          rule="The Hothouse Vault's defaults: the README and the roadmaps the scan found. None are read here, so each says so."
        >
          <Ground>
            <KeyFilePaper sheets={sheetsFor(hothouse.detail.keyFiles, {})} />
          </Ground>
        </Specimen>
      </Section>
      <Usage
        component="<KeyFilePaper>"
        props={[
          {
            name: "sheets",
            type: "KeyFileSheet[]",
            what: "Each of bird.detail.keyFiles with the markdown read from it, or null when it could not be read.",
          },
        ]}
      >
        <p>
          The view model holds paths only. The app reads{" "}
          <Code>absolutePath</Code> at render time and passes the text in. The
          first tab opens; the tab state is the component&apos;s own. The open
          sheet keeps its full height and has no scroll of its own: place it in
          a pane that scrolls, <Code>overflow-y-auto</Code> with{" "}
          <Code>pane-scroll</Code>, as the bird&apos;s page does. The tabs stick
          to the pane&apos;s top, and the sheet takes focus so the keys scroll
          the pane. <Code>MarkdownPaper</Code> renders one sheet&apos;s markdown
          alone.
        </p>
      </Usage>
    </>
  );
}
