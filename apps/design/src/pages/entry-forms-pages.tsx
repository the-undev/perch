// The config entry forms: adopting a fence bird, and editing an adopted bird's entry.

import type { EntryValues } from "@perch/core/entry-form.ts";
import { DetailView } from "@perch/ui/detail-view.tsx";
import { AdoptForm, EntryEditor } from "@perch/ui/entry-forms.tsx";
import { useState } from "react";
import { birdSheets } from "../key-files.ts";
import { mockBird, mockEntryForm, scanMoment } from "../specimens.ts";
import { Code, Pressed, Section, Specimen, Usage } from "../usage.tsx";

/** What a save would write, in short, so the page shows the callback working. */
function savedWords(values: EntryValues): string {
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

function AdoptSpecimen({
  id,
  onPressed,
}: {
  id: string;
  onPressed: (text: string) => void;
}) {
  const form = mockEntryForm(id);
  return (
    <AdoptForm
      entryKey={id}
      scannedName={form.scannedName}
      wires={form.options.wires}
      defaultWire={form.options.defaultWire}
      onAdopt={(adoption) =>
        onPressed(
          `onAdopt(${adoption.wire ?? "default wire"}, ${adoption.name ?? "scanned name"})`,
        )
      }
      onCancel={() => onPressed("onCancel()")}
    />
  );
}

export function AdoptFormPage() {
  const [pressed, setPressed] = useState("nothing yet");
  const hello = mockBird("dev/odin/hello");
  return (
    <>
      <Pressed text={pressed} />
      <Section
        title="The adopt control on a fence bird"
        rule="A fence bird's detail page ends its action row with Adopt. Pressing it opens the form beneath the row; confirming writes the entry and rescans, and the bird flies to the wire chosen."
        min={620}
      >
        <Specimen
          label="On the detail page"
          rule="hello: press Adopt to open the form; Adopt again confirms."
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
                  setPressed(`onSave(${birdId}, ${savedWords(values)})`),
                onRemove: (birdId) => setPressed(`onRemove(${birdId})`),
              }}
              problems={[]}
              openPapers={false}
            />
          </div>
        </Specimen>
      </Section>
      <Section
        title="The form"
        rule="A wire and a name, nothing else: the rest of the entry is edited once the bird is adopted. The default wire is chosen until another is; empty keeps the scanned name. The entry is keyed by the bird's item id."
        min={520}
      >
        <Specimen
          label="Found under an include path"
          rule="hearth-config: a clone joined to two forges, not yet decided."
        >
          <AdoptSpecimen id="dev/hearth-config" onPressed={setPressed} />
        </Specimen>
        <Specimen
          label="One disk only"
          rule="hello: no remote at all; adopting it puts it on a wire all the same."
        >
          <AdoptSpecimen id="dev/odin/hello" onPressed={setPressed} />
        </Specimen>
        <Specimen
          label="Forge only"
          rule="obsidian-tidy: never cloned here, so its key is the forge reference."
        >
          <AdoptSpecimen
            id="github:finch/obsidian-tidy"
            onPressed={setPressed}
          />
        </Specimen>
      </Section>
      <Usage
        component="<AdoptForm>"
        props={[
          {
            name: "entryKey",
            type: "string",
            what: "The key the new entry is written under: the bird's item id.",
          },
          {
            name: "scannedName",
            type: "string",
            what: "The name the scan found, the name field's placeholder.",
          },
          {
            name: "wires",
            type: "string[]",
            what: "The configured wires, top to bottom.",
          },
          {
            name: "defaultWire",
            type: "string",
            what: "The wire an entry naming none sits on, chosen at first.",
          },
          {
            name: "onAdopt",
            type: "(adoption: Adoption) => void",
            what: "Confirmed: the wire, null for the default, and the name, null for the scanned one.",
          },
          {
            name: "onCancel",
            type: "() => void",
            what: "The form was put away without writing.",
          },
        ]}
      >
        <p>
          Inside the app the detail page opens it from its Adopt verb when{" "}
          <Code>entry.form.values</Code> is null, and hands the adoption to the
          main process as <Code>saveEntry(birdId, values)</Code>. The main
          process rereads the config file, adds the entry, writes it with{" "}
          <Code>writeConfig</Code> in one rename, rereads it and scans.
        </p>
      </Usage>
    </>
  );
}

function EditorSpecimen({
  id,
  values,
  onPressed,
}: {
  id: string;
  values?: Partial<EntryValues>;
  onPressed: (text: string) => void;
}) {
  const form = mockEntryForm(id);
  if (form.values === null) throw new Error(`${id} has no entry`);
  return (
    <EntryEditor
      entryKey={form.key ?? id}
      scannedName={form.scannedName}
      values={{ ...form.values, ...values }}
      options={form.options}
      onSave={(saved) => onPressed(`onSave(${savedWords(saved)})`)}
      onUnadopt={() => onPressed("onUnadopt()")}
      onCancel={() => onPressed("onCancel()")}
    />
  );
}

export function EntryEditorPage() {
  const [pressed, setPressed] = useState("nothing yet");
  return (
    <>
      <Pressed text={pressed} />
      <Section
        title="An adopted bird's entry"
        rule="Every field an entry holds but the zellij session, which the edit keeps. A choice left on its default is not written. Key files and roadmaps are lists of paths relative to the item; with none set the defaults apply, and an empty list is none."
        min={620}
      >
        <Specimen
          label="Key files and an expectation"
          rule="Perch: three key files from config and CI expected, on the default wire."
        >
          <EditorSpecimen id="dev/perch" onPressed={setPressed} />
        </Specimen>
        <Specimen
          label="Wire, tier and roadmaps"
          rule="The Hothouse Vault: on Machine & Home, machine importance, two roadmap files in place of the standard names."
        >
          <EditorSpecimen id="obsidian/Hothouse" onPressed={setPressed} />
        </Specimen>
      </Section>
      <Section
        title="Threshold overrides"
        rule="Each health window's amber and red, empty for the global value shown as the placeholder. Clear puts a window back to the defaults. Save waits while amber does not open before red, or a value is not a whole number above zero."
        min={620}
      >
        <Specimen
          label="Overrides set"
          rule="Spool, given tighter unsafe-work windows and a quicker stall: press clear on either window to return it to the defaults."
        >
          <EditorSpecimen
            id="undev/spool"
            values={{
              thresholds: {
                unsafe_amber_hours: 12,
                unsafe_red_hours: 48,
                stalled_amber_days: 3,
              },
            }}
            onPressed={setPressed}
          />
        </Specimen>
        <Specimen
          label="Overrides cleared"
          rule="Spool as config has it: every window on the global values."
        >
          <EditorSpecimen id="undev/spool" onPressed={setPressed} />
        </Specimen>
        <Specimen
          label="Cannot be saved"
          rule="A stalled amber of 40 days opens after the global red of 30: the form says so and Save waits."
        >
          <EditorSpecimen
            id="undev/spool"
            values={{ thresholds: { stalled_amber_days: 40 } }}
            onPressed={setPressed}
          />
        </Specimen>
      </Section>
      <Usage
        component="<EntryEditor>"
        props={[
          {
            name: "entryKey",
            type: "string",
            what: "The key the entry sits under, which the edit keeps: an id or a forge reference.",
          },
          {
            name: "scannedName",
            type: "string",
            what: "The name the scan found, which an empty name keeps.",
          },
          {
            name: "values",
            type: "EntryValues",
            what: "The entry as config holds it now; the draft starts here.",
          },
          {
            name: "options",
            type: "EntryOptions",
            what: "The wires, tiers and expectations to choose from, and the global thresholds.",
          },
          {
            name: "onSave",
            type: "(values: EntryValues) => void",
            what: "Save was pressed with values that can be written.",
          },
          {
            name: "onUnadopt",
            type: "() => void",
            what: "Unadopt was pressed and then confirmed.",
          },
          {
            name: "onCancel",
            type: "() => void",
            what: "The form was put away without writing.",
          },
        ]}
      >
        <p>
          The values and options come from{" "}
          <Code>entryFormFor(config, item)</Code> in{" "}
          <Code>@perch/core/entry-form.ts</Code>, which the main process answers{" "}
          <Code>entryForm(birdId)</Code> with. Saving goes back as{" "}
          <Code>saveEntry(birdId, values)</Code>, written under the key that
          already names the bird; unadopting as <Code>removeEntry(birdId)</Code>
          , which removes every key naming it.
        </p>
      </Usage>
    </>
  );
}
