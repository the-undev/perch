// The adoption papers: the sheet that adopts a fence bird and amends an adopted one, in each of its
// states from the mock dataset.

import type { EntryForm, EntryValues } from "@perch/core/entry-form.ts";
import { AdoptionPapers } from "@perch/ui/adoption-papers.tsx";
import { DetailView } from "@perch/ui/detail-view.tsx";
import { useState } from "react";
import { birdSheets } from "../key-files.ts";
import { mockBird, mockEntryForm, scanMoment } from "../specimens.ts";
import { Code, Ground, Pressed, Section, Specimen, Usage } from "../usage.tsx";

/** What a signature would write, in short, so the page shows the callback working. */
function signedWords(values: EntryValues): string {
  const set = Object.entries(values).filter(
    ([, value]) =>
      value !== null &&
      !(Array.isArray(value) && value.length === 0) &&
      !(typeof value === "object" && Object.keys(value).length === 0),
  );
  if (set.length === 0) return "an entry with nothing set";
  return set
    .map(([field, value]) => `${field} = ${JSON.stringify(value)}`)
    .join(", ");
}

/** One bird's papers on a patch of ground, their callbacks printed. */
function PapersSpecimen({
  id,
  form,
  problems,
  onPressed,
}: {
  id: string;
  form: EntryForm;
  problems: string[];
  onPressed: (text: string) => void;
}) {
  return (
    <Ground>
      <AdoptionPapers
        bird={mockBird(id)}
        form={form}
        night={false}
        now={scanMoment}
        problems={problems}
        onSign={(values) => onPressed(`onSign(${signedWords(values)})`)}
        onReturn={() => onPressed("onReturn()")}
        onClose={() => onPressed("onClose()")}
      />
    </Ground>
  );
}

/** A mock bird's entry form with its values changed, as a draft would hold them. */
function withValues(id: string, change: Partial<EntryValues>): EntryForm {
  const form = mockEntryForm(id);
  if (form.values === null) throw new Error(`${id} has no entry`);
  return { ...form, values: { ...form.values, ...change } };
}

export function AdoptionPapersPage() {
  const [pressed, setPressed] = useState("nothing yet");
  const hello = mockBird("dev/odin/hello");
  const perch = mockBird("dev/perch");
  const specimen = (id: string, problems: string[] = []) => (
    <PapersSpecimen
      id={id}
      form={mockEntryForm(id)}
      problems={problems}
      onPressed={setPressed}
    />
  );
  return (
    <>
      <Pressed text={pressed} />
      <Section
        title="On the bird's page"
        rule="The papers unfold on the ground of the bird's page, beneath its action row. A fence bird's row ends with Adopt; an adopted bird's with The papers. The fence bubble's Adopt key leads to the same page with the papers already unfolded. Signed papers stay open until the entry read back shows the write."
        min={620}
      >
        <Specimen
          label="A fence bird"
          rule="hello: press Adopt to unfold the papers; Adopt onto Projects signs them."
        >
          <div className="rounded-xl border border-edge bg-ground px-5 py-4">
            <DetailView
              bird={hello}
              now={scanMoment}
              onLaunch={(action) => setPressed(`onLaunch(${action.verb})`)}
              sheets={birdSheets(hello)}
              entry={{
                form: mockEntryForm(hello.id),
                onSave: (birdId, values) =>
                  setPressed(`onSave(${birdId}, ${signedWords(values)})`),
                onRemove: (birdId) => setPressed(`onRemove(${birdId})`),
              }}
              problems={[]}
              openPapers={false}
            />
          </div>
        </Specimen>
        <Specimen
          label="Led here by the bubble's Adopt"
          rule="Perch with openPapers set: the papers are unfolded as the page opens, filled with the entry as written."
        >
          <div className="rounded-xl border border-edge bg-ground px-5 py-4">
            <DetailView
              bird={perch}
              now={scanMoment}
              onLaunch={(action) => setPressed(`onLaunch(${action.verb})`)}
              sheets={birdSheets(perch)}
              entry={{
                form: mockEntryForm(perch.id),
                onSave: (birdId, values) =>
                  setPressed(`onSave(${birdId}, ${signedWords(values)})`),
                onRemove: (birdId) => setPressed(`onRemove(${birdId})`),
              }}
              problems={[]}
              openPapers={true}
            />
          </div>
        </Specimen>
      </Section>
      <Section
        title="Adopting"
        rule="What perch has seen is set in mono and cannot be edited: where the clone is, the forges that also hold it, and the last commit. What you say starts on the defaults; a choice left on its default is written as nothing. The signature button names the wire it will write."
        min={560}
      >
        <Specimen
          label="Found under an include path"
          rule="hearth-config: a clone joined to two forges, not yet decided."
        >
          {specimen("dev/hearth-config")}
        </Specimen>
        <Specimen
          label="One disk only"
          rule="hello: no remote at all, so no forge line; adopting it perches it all the same."
        >
          {specimen("dev/odin/hello")}
        </Specimen>
        <Specimen
          label="Forge only"
          rule="obsidian-tidy: never cloned here, so it lives at its forge, its ring is the forge reference, and its last commit is the forge's newest."
        >
          {specimen("github:finch/obsidian-tidy")}
        </Specimen>
      </Section>
      <Section
        title="Amending"
        rule="The same sheet, filled with the entry as written and signed with Amend the papers. Return to the fence sits on the signature line. More particulars names what it holds while closed: the key files, roadmaps, zellij session and the bird's own windows, the current form parts in the paper's ink."
        min={560}
      >
        <Specimen
          label="Key files"
          rule="Perch: three key files from config, on the default wire. Open the fold to see the key files."
        >
          {specimen("dev/perch")}
        </Specimen>
        <Specimen
          label="Wire and roadmaps"
          rule="The Hothouse Vault: on Machine & Home, two roadmap files in place of the standard names."
        >
          {specimen("obsidian/Hothouse")}
        </Specimen>
        <Specimen
          label="A session from the launch rules"
          rule="Spool: open the fold, and the session field's placeholder is undev, the session the launch rules give ~/undev."
        >
          {specimen("undev/spool")}
        </Specimen>
      </Section>
      <Section
        title="Held states"
        rule="Return to the fence asks twice, and the second press names the cost. A threshold that cannot be written holds the signature and says why. A write the main process refused shows its sentence in red above the signature line, and the papers stay open."
        min={560}
      >
        <Specimen
          label="Returning to the fence"
          rule="Spool: press Return to the fence. Every line of these papers is struck out; Return it to the fence confirms, Keep the papers goes back."
        >
          {specimen("undev/spool")}
        </Specimen>
        <Specimen
          label="Cannot be signed"
          rule="A stalled amber of 40 days opens after the global red of 30: the papers say so and Amend the papers waits."
        >
          <PapersSpecimen
            id="undev/spool"
            form={withValues("undev/spool", {
              thresholds: { stalled_amber_days: 40 },
            })}
            problems={[]}
            onPressed={setPressed}
          />
        </Specimen>
        <Specimen
          label="A refused write"
          rule="Perch, after a write the main process could not make: its sentence above the signature line."
        >
          {specimen("dev/perch", [
            "The config was not changed: the disk is read-only",
          ])}
        </Specimen>
      </Section>
      <Usage
        component="<AdoptionPapers>"
        props={[
          {
            name: "bird",
            type: "Bird",
            what: "The bird the papers are for: its name and portrait head the sheet.",
          },
          {
            name: "form",
            type: "EntryForm",
            what: "The bird's entry form: what perch has seen, the choices, the session the launch rules give, and the entry's values, null for a fence bird.",
          },
          {
            name: "night",
            type: "boolean",
            what: "The sky is at night: the portrait sleeps as the bird does.",
          },
          {
            name: "now",
            type: "Date",
            what: "The render's clock, which the last commit's age is measured to.",
          },
          {
            name: "problems",
            type: "string[]",
            what: "The main process's problems, a refused write among them, shown in red above the signature.",
          },
          {
            name: "onSign",
            type: "(values: EntryValues) => void",
            what: "Signed with values that can be written, every untouched field null.",
          },
          {
            name: "onReturn",
            type: "() => void",
            what: "Return to the fence was pressed and then confirmed.",
          },
          {
            name: "onClose",
            type: "() => void",
            what: "Not now, or Escape: the papers fold away and nothing is written.",
          },
        ]}
      >
        <p>
          The form comes from <Code>entryFormFor(config, item, home)</Code> in{" "}
          <Code>@perch/core/entry-form.ts</Code>, which the main process answers{" "}
          <Code>entryForm(birdId)</Code> with. Inside the app the detail page
          mounts the papers and hands a signature to the main process as{" "}
          <Code>saveEntry(birdId, values)</Code>, written under the key that
          already names the bird, else its id; a return to the fence as{" "}
          <Code>removeEntry(birdId)</Code>, which removes every key naming it.
          The papers fold once the entry read back matches what was signed.
        </p>
      </Usage>
    </>
  );
}
