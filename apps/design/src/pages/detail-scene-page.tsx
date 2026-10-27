import { DetailView } from "@perch/ui/detail-view.tsx";
import { useState } from "react";
import { birdSheets } from "../key-files.ts";
import { mockBird, mockEntryForm, scanMoment } from "../specimens.ts";
import { Choice, Code, Pressed, Section, Usage } from "../usage.tsx";

const birds = [
  {
    id: "dev/perch",
    label: "Perch",
    rule: "Content and being edited: branches, the commit river over here and both forges, a draft pull request, and three key files from config, which this repository's own files stand in for. Press a chip in its bubble to land on the ledger row holding its working.",
  },
  {
    id: "undev/prism",
    label: "Prism",
    rule: "Distressed: CI failing on Forgejo in red, four uncommitted changes in amber, and GitHub's pull requests not read while its CI and commits were.",
  },
  {
    id: "undev/skiff",
    label: "Skiff",
    rule: "Restless: parked on a feature branch for three weeks with everything pushed.",
  },
  {
    id: "dev/odin/hello",
    label: "Hello",
    rule: "On the fence: one disk only, so the ledger says there is no remote, and the not-set-up flag shows.",
  },
  {
    id: "github:finch/obsidian-tidy",
    label: "obsidian-tidy",
    rule: "On a forge, never cloned here: no local facts, nothing to launch, no key files; only the link out.",
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
        rule="The bird sits on its perch at the top right with its bubble, and the heading beside it says its name, state and where it lives. The page shows only what exists for a bird: an empty section is left out, a bird with no clone has nothing to launch, and a source that failed is named with its error."
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
      <div className="mt-4 rounded-xl border border-edge bg-ground px-7.5 pt-5.5 pb-11">
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
        />
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
        ]}
      >
        <p>
          The view fetches nothing. The app reads each key file&apos;s{" "}
          <Code>absolutePath</Code> and passes the text in. From 860px wide the
          heading and the roost share the top band, the roost in a 480px column
          at the right, and the record spans the whole width beneath; narrower,
          the order is the heading, the roost, centred, then the record. Inside
          the record the ledger and its sections sit beside the paper when the
          record is at least 960px wide, above it when narrower. The page
          centres as one block up to 1920px. Inside the app the camera places it
          on the ground beneath the strip.
        </p>
      </Usage>
    </>
  );
}
