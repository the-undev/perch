import type { Bird } from "@perch/core/viewmodel.ts";
import { NoCloneSlip } from "@perch/ui/no-clone-slip.tsx";
import { KeyFilePaper } from "@perch/ui/paper.tsx";
import { useState } from "react";
import { perchFiles, sheetsFor } from "../key-files.ts";
import {
  mockBird,
  pergolaNotesCached,
  pergolaNotesOnBothForges,
} from "../specimens.ts";
import { Code, Ground, Pressed, Section, Specimen, Usage } from "../usage.tsx";

/** A bird's slip, its presses reported beneath the page. */
function Slip({
  bird,
  onPress,
}: {
  bird: Bird;
  onPress: (call: string) => void;
}) {
  const slip = bird.detail.noClone;
  if (slip === null) throw new Error(`${bird.id} has a clone here`);
  return (
    <Ground>
      <NoCloneSlip
        slip={slip}
        onLocalSources={() => onPress("onLocalSources()")}
        onCopy={async (text) => onPress(`onCopy(${text})`)}
      />
    </Ground>
  );
}

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
  const [pressed, setPressed] = useState("nothing yet");
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
      <Section
        title="No clone on this machine"
        rule="A bird held by at least one forge with no clone here has no key files. Where they would be, a slip of the same paper says why: cut short with a toothed bottom edge, stamped in a dusty blue far from the judgement colours, then the fact, the two routes to a clone (a directory to search, or the clone's folder itself, both edits in Sources) naming the repository a clone's remote must point at, Open Sources, and the address to clone from with Copy. It caps at its reading width and sits where the folder tabs would start. Adopted or on the fence alike; a bird with a clone but no README keeps its empty pane."
        min={420}
      >
        <Specimen
          label="One forge, with the clone address"
          rule="Pergola Notes, adopted while only on Forgejo. The address is the SSH address Forgejo gave for the repository. Copy flips to Copied for a moment once the clipboard has it."
        >
          <Slip
            bird={mockBird("forgejo:finch/field-notes")}
            onPress={setPressed}
          />
        </Specimen>
        <Specimen
          label="On the fence"
          rule="obsidian-tidy, on GitHub and never adopted: the same slip. Adoption and the clone are separate facts."
        >
          <Slip
            bird={mockBird("github:finch/obsidian-tidy")}
            onPress={setPressed}
          />
        </Specimen>
        <Specimen
          label="The address unknown"
          rule="Pergola Notes from a snapshot cached before the scanner kept clone addresses: the slip shows without the address row until the next scan."
        >
          <Slip bird={pergolaNotesCached()} onPress={setPressed} />
        </Specimen>
        <Specimen
          label="Two forges"
          rule="Pergola Notes on GitHub as well: the fact names both, GitHub first, and the address is the first one a forge gave, in the order the presences were found."
        >
          <Slip bird={pergolaNotesOnBothForges()} onPress={setPressed} />
        </Specimen>
      </Section>
      <Pressed text={pressed} />
      <Usage
        component="<KeyFilePaper> · <NoCloneSlip>"
        props={[
          {
            name: "sheets",
            type: "KeyFileSheet[]",
            what: "KeyFilePaper: each of bird.detail.keyFiles with the markdown read from it, or null when it could not be read.",
          },
          {
            name: "slip",
            type: "NoClone",
            what: "NoCloneSlip: bird.detail.noClone, the forges by name, the repository reference, the clone address or null while unknown, and whether the meta line carries its clause.",
          },
          {
            name: "onLocalSources",
            type: "() => void",
            what: "NoCloneSlip: Open Sources was pressed; the app opens /settings?unfold=local, the Sources page with the local cards unfolded.",
          },
          {
            name: "onCopy",
            type: "(text: string) => Promise<void>",
            what: "NoCloneSlip: Copy was pressed; the app puts the address on the clipboard. The control says Copied once it settles, or Couldn't copy if it fails, then reads Copy again.",
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
        <p>
          The detail page draws <Code>NoCloneSlip</Code> in the paper pane when{" "}
          <Code>bird.detail.noClone</Code> is not null, above the key files,
          which such a bird never has. The window never navigates: cloning stays
          with the owner&apos;s own tools, and the next scan finds the clone
          under any searched folder. <Code>NoCloneClause</Code> is the meta
          line&apos;s &quot;no local clone&quot;, on the Detail heading page.
        </p>
      </Usage>
    </>
  );
}
