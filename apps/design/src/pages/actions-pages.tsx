// Launch actions, links out and the detail page's heading.

import type { Bird, LaunchAction } from "@perch/core/viewmodel.ts";
import { LaunchActions, LinksOut } from "@perch/ui/actions.tsx";
import { DetailHeading } from "@perch/ui/detail-heading.tsx";
import { NoCloneClause } from "@perch/ui/no-clone-slip.tsx";
import { useState } from "react";
import { mockBird } from "../specimens.ts";
import { Code, Ground, Section, Specimen, Usage } from "../usage.tsx";

/** What a launch action would open, in words, so the page shows the callback working. */
function describe(action: LaunchAction): string {
  switch (action.kind) {
    case "zellij":
      return `zellij session ${action.session}, tab ${action.tab}, in ${action.cwd}`;
    case "command":
      return `${action.command.join(" ")} on ${action.path}`;
    case "obsidian":
      return `the ${action.obsidianVault} Obsidian vault: ${action.command.join(" ")}`;
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
        rule="Launch actions open the terminal, editor or files without perch mutating anything. Each is a verb with the icon it carries, its kind's or a custom command's pick; ↗ marks that it leaves the app."
        min={560}
      >
        <Specimen
          label="A repository"
          rule="Perch: the zellij tab, VS Code, the folder, nvim, and a custom command wearing the terminal."
        >
          <Ground>
            <div className="flex flex-wrap items-center gap-1">
              <LaunchActions
                actions={mockBird("dev/perch").detail.actions}
                onLaunch={launch}
              />
            </div>
          </Ground>
        </Specimen>
        <Specimen
          label="An Obsidian bird"
          rule="The Hothouse Obsidian vault: Open in Obsidian, first in the mock's config, a kind offered on Obsidian birds only."
        >
          <Ground>
            <div className="flex flex-wrap items-center gap-1">
              <LaunchActions
                actions={mockBird("obsidian/Hothouse").detail.actions}
                onLaunch={launch}
              />
            </div>
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
          The verbs come from the view model in config order, each carrying its
          commands; the main process fills in the placeholders and runs them.
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
            <div className="flex flex-wrap items-center gap-1">
              <LinksOut links={mockBird("dev/perch").detail.links} />
            </div>
          </Ground>
        </Specimen>
        <Specimen
          label="Forge only"
          rule="obsidian-tidy: the forge is all there is."
        >
          <Ground>
            <div className="flex flex-wrap items-center gap-1">
              <LinksOut
                links={mockBird("github:finch/obsidian-tidy").detail.links}
              />
            </div>
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

/** The bird's verbs and links as the page sets them beside the meta; nothing launches here. */
function HeadingActions({ bird }: { bird: Bird }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {bird.detail.noClone?.onMetaLine && <NoCloneClause />}
      <LaunchActions actions={bird.detail.actions} onLaunch={() => {}} />
      <LinksOut links={bird.detail.links} />
    </div>
  );
}

export function HeadingPage() {
  return (
    <>
      <Section
        title="The heading of the detail page"
        rule="The one place on the page that carries the bird's name and state word: the roost's bubble beside it drops its header, so neither is said twice. The name large, the state word in the mood's colour, what the bird is doing, and beneath them a meta line in mono saying where the bird lives: its clone with home as ~, the forges that hold it, and its wire. The page's launch actions, links out and papers' verb share the meta's row where they fit and drop beneath it where not, so the heading keeps to two or three rows."
        min={640}
      >
        <Specimen
          label="content, editing, two forges"
          rule="Perch: the song becomes the words editing ♪; cloned here and held on GitHub and Forgejo."
        >
          <Ground>
            <DetailHeading
              bird={mockBird("dev/perch")}
              actions={<HeadingActions bird={mockBird("dev/perch")} />}
            />
          </Ground>
        </Specimen>
        <Specimen
          label="restless, in flight"
          rule="Skiff: in flight on a branch; settled says nothing."
        >
          <Ground>
            <DetailHeading
              bird={mockBird("undev/skiff")}
              actions={<HeadingActions bird={mockBird("undev/skiff")} />}
            />
          </Ground>
        </Specimen>
        <Specimen label="distressed" rule="Prism: the red state word.">
          <Ground>
            <DetailHeading
              bird={mockBird("undev/prism")}
              actions={<HeadingActions bird={mockBird("undev/prism")} />}
            />
          </Ground>
        </Specimen>
        <Specimen
          label="on the fence, no forge"
          rule="hello: the fence's word, quiet; one disk only, so the meta line names no forge."
        >
          <Ground>
            <DetailHeading
              bird={mockBird("dev/odin/hello")}
              actions={<HeadingActions bird={mockBird("dev/odin/hello")} />}
            />
          </Ground>
        </Specimen>
        <Specimen
          label="adopted, no clone"
          rule="Pergola Notes: adopted while only on Forgejo. Where the launch actions would sit, the meta line says no local clone in the faint voice, the cause in three words that the slip in the paper pane spells out. It shows exactly when the slip does and config holds at least one launch action; a config with none stays silent."
        >
          <Ground>
            <DetailHeading
              bird={mockBird("forgejo:finch/field-notes")}
              actions={
                <HeadingActions
                  bird={mockBird("forgejo:finch/field-notes")}
                />
              }
            />
          </Ground>
        </Specimen>
        <Specimen
          label="on the fence, no clone"
          rule="obsidian-tidy: on a forge, never cloned here, so the meta line starts with the forge, the heading has no activity, and no local clone stands where the launch actions would."
        >
          <Ground>
            <DetailHeading
              bird={mockBird("github:finch/obsidian-tidy")}
              actions={
                <HeadingActions bird={mockBird("github:finch/obsidian-tidy")} />
              }
            />
          </Ground>
        </Specimen>
      </Section>
      <Usage
        component="<DetailHeading>"
        props={[
          { name: "bird", type: "Bird", what: "The bird whose page this is." },
          {
            name: "actions",
            type: "ReactNode",
            what: "The page's verbs and links as one group, set after the meta line on its row; null for none.",
          },
        ]}
      >
        <p>
          The meta line is <Code>whereabouts(bird)</Code>: the view model&apos;s{" "}
          <Code>detail.clonePath</Code> and <Code>detail.forges</Code>, then{" "}
          <Code>bird.wire</Code> as &quot;on Projects&quot; or &quot;on the
          fence&quot;. The speech is the roost&apos;s, on the Roost page.
        </p>
      </Usage>
    </>
  );
}
