import { DetailView } from "@perch/ui/detail-view.tsx";
import { useState } from "react";
import { birdSheets } from "../key-files.ts";
import { mockBird, mockEntryForm, scanMoment } from "../specimens.ts";
import { Choice, Code, Pressed, Section, Stage, Usage } from "../usage.tsx";

const birds = [
  {
    id: "dev/perch",
    label: "Perch",
    rule: "Content and being edited: branches, the commit river over here and both forges, a draft pull request, and three key files from config, which this repository's own files stand in for. Press a chip in its bubble to land on the ledger row holding its working.",
  },
  {
    id: "undev/prism",
    label: "Prism",
    rule: "Distressed: CI failing on Forgejo in red, four uncommitted changes in amber, and GitHub's pull requests couldn't be read while its CI and commits were.",
  },
  {
    id: "undev/skiff",
    label: "Skiff",
    rule: "Restless: it pushes to skiff-app/skiff on GitHub, which no card covers, so the notice under the heading names the fix and links to Sources, where the can't-read chip lands. The ledger and river say couldn't read github; Forgejo was read. Also parked on a feature branch for three weeks.",
  },
  {
    id: "dev/odin/hello",
    label: "Hello",
    rule: "On the fence: one disk only, so the ledger says there is no remote, and the not-set-up flag shows.",
  },
  {
    id: "github:finch/obsidian-tidy",
    label: "obsidian-tidy",
    rule: "On a forge, never cloned here, on the fence: no local facts and nothing to launch, so the meta line says no local clone, and the paper pane holds the slip saying why, with Open Sources and the address to copy.",
  },
] as const;

type BirdId = (typeof birds)[number]["id"];

export function DetailScenePage() {
  const [id, setId] = useState<BirdId>("dev/perch");
  const [pressed, setPressed] = useState("nothing yet");
  const bird = mockBird(id);
  const entry = birds.find((candidate) => candidate.id === id);
  return (
    <>
      <Section
        title="Five contrasting birds"
        rule="The band is one row: the heading at the left says the bird's name, state and where it lives with the actions beside the meta, the bubble takes the middle at a reading width, and the bird sits on its perch at the right, the band sized to the bird on its stand. The page is a fixed stage: the heading, its actions and the roost hold still, and beneath them the record and the key files each scroll their own pane under the pointer. The page shows only what exists for a bird: an empty section is left out, a bird with no clone has nothing to launch, and a source that failed is named with its error."
        min={600}
      >
        <div>
          <Choice
            label="Bird"
            options={birds.map((candidate) => ({
              value: candidate.id,
              label: candidate.label,
            }))}
            value={id}
            onChange={setId}
          />
          <p className="mt-2.5 mb-0 max-w-[90ch] text-[12.5px] text-ink-faint">
            {entry?.rule}
          </p>
        </div>
      </Section>
      <div className="mt-4">
        <Stage height="max(560px, calc(100vh - 320px))">
          <DetailView
            key={id}
            bird={bird}
            now={scanMoment}
            onLaunch={(action) => setPressed(`${bird.name}: ${action.verb}`)}
            sheets={birdSheets(bird)}
            entry={{
              form: mockEntryForm(id),
              onSave: (birdId) => setPressed(`entry.onSave(${birdId})`),
              onRemove: (birdId) => setPressed(`entry.onRemove(${birdId})`),
            }}
            problems={[]}
            openPapers={false}
            arrivalChip={null}
            onSettings={() => setPressed("onSettings()")}
            onLocalSources={() => setPressed("onLocalSources()")}
            onCopy={async (text) => setPressed(`onCopy(${text})`)}
            panning={false}
          />
        </Stage>
      </div>
      <Pressed text={pressed} />

      <Usage
        component="<DetailView>"
        props={[
          { name: "bird", type: "Bird", what: "One bird from the aviary." },
          {
            name: "now",
            type: "Date",
            what: "The render's clock: ages are measured to it, and at night a sleeping bird sleeps on its perch and speaks woken.",
          },
          {
            name: "onLaunch",
            type: "(action: LaunchAction) => void",
            what: "A launch action was pressed; the app asks the main process to open it.",
          },
          {
            name: "sheets",
            type: "KeyFileSheet[]",
            what: "bird.detail.keyFiles with the markdown read from each, null where a file could not be read; empty until read.",
          },
          {
            name: "entry",
            type: "EntryControls",
            what: "The bird's entry form, null until read, and the calls that save or remove the entry: Adopt on a fence bird, The papers on an adopted one.",
          },
          {
            name: "problems",
            type: "string[]",
            what: "The main process's problems, a refused write among them, which open papers show above their signature.",
          },
          {
            name: "openPapers",
            type: "boolean",
            what: "The papers unfold as the page opens, and again whenever it turns true: the bubble's adopt key leads here with it set.",
          },
          {
            name: "arrivalChip",
            type: "ChipKind | null",
            what: "The chip pressed in the aviary's bubble that brought the camera here, landed on as the page opens.",
          },
          {
            name: "onSettings",
            type: "() => void",
            what: "A notice's Sources was pressed; the app opens the settings page.",
          },
          {
            name: "onLocalSources",
            type: "() => void",
            what: "The no-clone slip's Open Sources was pressed; the app opens the settings page on Sources, the local cards unfolded.",
          },
          {
            name: "onCopy",
            type: "(text: string) => Promise<void>",
            what: "The no-clone slip's Copy was pressed; the app puts the clone address on the clipboard, and the control says Copied once it settles.",
          },
          {
            name: "panning",
            type: "boolean",
            what: "The camera is panning the ground between birds: a page mounted during it skips its swap, and the arrival chip and any roost press wait until it settles.",
          },
        ]}
      >
        <p>
          The view fetches nothing. The app reads each key file&apos;s{" "}
          <Code>absolutePath</Code> and passes the text in. The page fills a
          flex column of fixed height and never scrolls. The band at the top
          holds the heading, its actions, notices and problems, and the roost:
          from 860px wide it is one row, the heading taking what the roost
          leaves and the roost only as wide as its bubble, capped at 56
          characters, and its bird need. Narrower, the roost follows the heading
          in a centred 480px column. Beneath the band, from 960px wide, the
          record pane (the ledger and its sections) and the paper pane (the key
          files) each scroll their own contents with a thin quiet scrollbar,{" "}
          <Code>pane-scroll</Code>. Narrower, they join into one pane, the key
          files at the end. A chip scrolls its row&apos;s pane. The adoption
          papers rise as a <Code>RisingSheet</Code> over both panes, which dim
          and go inert; the band stays in view and its controls rest, a press
          anywhere off the papers folding them. The page centres as one block up
          to 1920px. Inside the app the camera places it on the ground beneath
          the strip.
        </p>
      </Usage>
    </>
  );
}
