// Launch actions, links out and the detail page's heading.

import type { LaunchAction } from "@perch/core/viewmodel.ts";
import { LaunchActions, LinksOut } from "@perch/ui/actions.tsx";
import { DetailIntro } from "@perch/ui/detail-intro.tsx";
import { useState } from "react";
import { mockBird } from "../specimens.ts";
import { Code, Ground, Section, Specimen, Usage } from "../usage.tsx";

/** What a launch action would open, in words, so the page shows the callback working. */
function describe(action: LaunchAction): string {
  switch (action.kind) {
    case "zellij-tab":
      return `zellij session ${action.session}, tab ${action.tab}, in ${action.cwd}`;
    case "vscode":
      return `VS Code on ${action.path}`;
    case "folder":
      return `the file manager on ${action.path}`;
    case "obsidian":
      return `the ${action.vault} vault in Obsidian`;
  }
}

export function ActionsPage() {
  const [pressed, setPressed] = useState("nothing yet");
  const launch = (action: LaunchAction) => setPressed(describe(action));
  return (
    <>
      <p className="mt-6 text-[13px] text-ink-faint">
        Would open: <span className="text-ink-muted">{pressed}</span>
      </p>
      <Section
        title="Launch actions · verbs"
        rule="Launch actions open the terminal, editor or files without perch mutating anything. Each is a verb with its icon; ↗ marks that it leaves the app."
        min={560}
      >
        <Specimen
          label="A repository"
          rule="Perch: the zellij tab, VS Code, the folder."
        >
          <Ground>
            <LaunchActions
              actions={mockBird("dev/perch").detail.actions}
              onLaunch={launch}
            />
          </Ground>
        </Specimen>
        <Specimen
          label="A vault"
          rule="The Hothouse Vault: Open in Obsidian comes first."
        >
          <Ground>
            <LaunchActions
              actions={mockBird("obsidian/Hothouse").detail.actions}
              onLaunch={launch}
            />
          </Ground>
        </Specimen>
      </Section>
      <Usage
        component="<LaunchActions>"
        props={[
          {
            name: "actions",
            type: "LaunchAction[]",
            what: "bird.detail.actions; empty for a bird with no clone.",
          },
          {
            name: "onLaunch",
            type: "(action: LaunchAction) => void",
            what: "The app hands the action to the main process, which opens it.",
          },
        ]}
      >
        <p>
          The verbs come from the view model. The commands that open them are
          not in config yet; see the roadmap&apos;s launcher commands item.
        </p>
      </Usage>
    </>
  );
}

export function LinksPage() {
  return (
    <>
      <Section
        title="Links out"
        rule="The bird's repositories on its forges, named as the actual thing: the full name and the forge."
        min={560}
      >
        <Specimen label="Two forges" rule="Perch lives on GitHub and Forgejo.">
          <Ground>
            <LinksOut links={mockBird("dev/perch").detail.links} />
          </Ground>
        </Specimen>
        <Specimen
          label="Forge only"
          rule="obsidian-tidy: the forge is all there is."
        >
          <Ground>
            <LinksOut
              links={mockBird("github:finch/obsidian-tidy").detail.links}
            />
          </Ground>
        </Specimen>
      </Section>
      <Usage
        component="<LinksOut>"
        props={[
          { name: "links", type: "LinkOut[]", what: "bird.detail.links." },
        ]}
      >
        <p>
          Plain anchors with <Code>target=&quot;_blank&quot;</Code>; in the app
          the main process sends them to the browser.
        </p>
      </Usage>
    </>
  );
}

export function IntroPage() {
  return (
    <>
      <Section
        title="The heading of the detail page"
        rule="The detail is a strict superset of tiers A and B: the bird's mood and speech continue onto the page. The name large, the mood word in its colour, what the bird is doing, and the speech in full."
        min={620}
      >
        <Specimen
          label="content, editing"
          rule="Perch: the song becomes the words editing ♪."
        >
          <Ground>
            <DetailIntro bird={mockBird("dev/perch")} night={false} />
          </Ground>
        </Specimen>
        <Specimen
          label="restless, in flight"
          rule="Skiff: in flight on a branch; settled says nothing."
        >
          <Ground>
            <DetailIntro bird={mockBird("undev/skiff")} night={false} />
          </Ground>
        </Specimen>
        <Specimen
          label="distressed"
          rule="Prism: the worst cause speaks first."
        >
          <Ground>
            <DetailIntro bird={mockBird("undev/prism")} night={false} />
          </Ground>
        </Specimen>
        <Specimen label="not adopted" rule="hello: the fence's word, quiet.">
          <Ground>
            <DetailIntro bird={mockBird("dev/odin/hello")} night={false} />
          </Ground>
        </Specimen>
        <Specimen
          label="woken at night"
          rule="Spool: opening a sleeping bird wakes it."
        >
          <Ground>
            <DetailIntro bird={mockBird("undev/spool")} night={true} />
          </Ground>
        </Specimen>
      </Section>
      <Usage
        component="<DetailIntro>"
        props={[
          { name: "bird", type: "Bird", what: "The bird whose page this is." },
          {
            name: "night",
            type: "boolean",
            what: "At night a bird that sleeps speaks its woken speech.",
          },
        ]}
      >
        <p>
          Where the bird lives (its path, forges and wire) is not in the view
          model yet; the page&apos;s meta line waits on it, see the roadmap.
        </p>
      </Usage>
    </>
  );
}
