// The settings page: each group of config in its states, with what the editor would say of it,
// and the whole page as the app shows it.

import {
  type SettingsForm,
  type SettingsValues,
  settingsProblems,
} from "@perch/core/settings-form.ts";
import { FormNotes } from "@perch/ui/form-parts.tsx";
import { mockSettingsForm } from "@perch/ui/mock-birds.ts";
import {
  ForgesGroup,
  ImportanceGroup,
  LaunchGroup,
  LocalPathsGroup,
  PresencesGroup,
  ScanGroup,
  ServerGroup,
  ThresholdsGroup,
  WiresGroup,
} from "@perch/ui/settings-forms.tsx";
import { SettingsView } from "@perch/ui/settings-view.tsx";
import { type ReactNode, useState } from "react";
import {
  Choice,
  Code,
  Pressed,
  SceneFrame,
  Section,
  Specimen,
  Usage,
} from "../usage.tsx";

const mockForm = mockSettingsForm();
const mock = mockForm.values;
const { named } = mockForm;

/** One group in a state, editable here, with what the editor would list beneath it. */
function GroupSpecimen({
  label,
  rule,
  start,
  group,
}: {
  label: string;
  rule: ReactNode;
  /** The values the specimen starts from: the mock's, with a change. */
  start: SettingsValues;
  group: (
    values: SettingsValues,
    change: (change: Partial<SettingsValues>) => void,
  ) => ReactNode;
}) {
  const [values, setValues] = useState(start);
  return (
    <Specimen label={label} rule={rule}>
      {group(values, (change) => setValues({ ...values, ...change }))}
      <FormNotes notes={settingsProblems(values)} />
    </Specimen>
  );
}

const withMock = (change: Partial<SettingsValues>): SettingsValues => ({
  ...mock,
  ...change,
});

const local = (
  values: SettingsValues,
  change: (c: Partial<SettingsValues>) => void,
) => (
  <LocalPathsGroup
    value={values.local}
    onChange={(next) => change({ local: next })}
  />
);
const wires = (
  values: SettingsValues,
  change: (c: Partial<SettingsValues>) => void,
) => (
  <WiresGroup
    value={values.wires}
    named={named.wires}
    onChange={(next) => change({ wires: next })}
  />
);
const thresholds = (
  values: SettingsValues,
  change: (c: Partial<SettingsValues>) => void,
) => (
  <ThresholdsGroup
    value={values.thresholds}
    onChange={(next) => change({ thresholds: next })}
  />
);
const scan = (
  values: SettingsValues,
  change: (c: Partial<SettingsValues>) => void,
) => (
  <ScanGroup value={values.scan} onChange={(next) => change({ scan: next })} />
);
const importance = (
  values: SettingsValues,
  change: (c: Partial<SettingsValues>) => void,
) => (
  <ImportanceGroup
    value={values.importance}
    named={named.tiers}
    onChange={(next) => change({ importance: next })}
  />
);
const launch = (
  values: SettingsValues,
  change: (c: Partial<SettingsValues>) => void,
) => (
  <LaunchGroup
    value={values.launch}
    onChange={(next) => change({ launch: next })}
  />
);
const forges = (
  values: SettingsValues,
  change: (c: Partial<SettingsValues>) => void,
) => (
  <ForgesGroup
    value={values.forges}
    onChange={(next) => change({ forges: next })}
  />
);
const server = (
  values: SettingsValues,
  change: (c: Partial<SettingsValues>) => void,
) => (
  <ServerGroup
    value={values.server}
    onChange={(next) => change({ server: next })}
  />
);
const presences = (
  values: SettingsValues,
  change: (c: Partial<SettingsValues>) => void,
) => (
  <PresencesGroup
    value={{ joins: values.joins, ignore: values.ignore }}
    onChange={(next) => change(next)}
  />
);

export function SettingsGroupsPage() {
  return (
    <>
      <Section
        title="Local paths"
        rule="The include and ignore lists, each entry a text field edited in place. Config holds the paths expanded; the page shows a path under the home directory with ~, and the file is written so."
        min={560}
      >
        <GroupSpecimen
          label="As the mock holds them"
          rule="Six includes, ~/undev and both vaults among them, and two ignores."
          start={mock}
          group={local}
        />
        <GroupSpecimen
          label="A path neither absolute nor under ~"
          rule="dev would be read against nothing in particular: every path starts with / or ~."
          start={withMock({
            local: { include: ["~/dev", "undev"], ignore: [] },
          })}
          group={local}
        />
      </Section>
      <Section
        title="Wires and importance"
        rule="Ordered names, moved up and down, and the default picked from them. Removing a wire or tier that item entries name is allowed: the form names the entries, and saving moves them to the default."
        min={560}
      >
        <GroupSpecimen
          label="As the mock holds them"
          rule="Machine & Home above Projects, Projects the default."
          start={mock}
          group={wires}
        />
        <GroupSpecimen
          label="A wire removed that entries name"
          rule="Three entries sit on Machine & Home: the warning says they move to Projects. It is not a problem; Save stays on."
          start={withMock({
            wires: { names: ["Projects"], default: "Projects" },
          })}
          group={wires}
        />
        <GroupSpecimen
          label="A blank name and a default not among them"
          rule="Every wire needs a name, and the default must be one of them."
          start={withMock({
            wires: { names: ["Machine & Home", " "], default: "Someday" },
          })}
          group={wires}
        />
        <GroupSpecimen
          label="A tier removed that entries name"
          rule="Two entries have importance machine: saving gives them the default tier."
          start={withMock({
            importance: { tiers: ["server", "projects"], default: "projects" },
          })}
          group={importance}
        />
      </Section>
      <Section
        title="Thresholds and scan"
        rule="The six global thresholds use the entry forms' rule: whole numbers above zero, amber opening before red. The intervals are whole numbers above zero too; an emptied field counts as none."
        min={560}
      >
        <GroupSpecimen
          label="As the mock holds them"
          rule="24 and 72 hours, 7 and 30 days, twice."
          start={mock}
          group={thresholds}
        />
        <GroupSpecimen
          label="Amber after red, and an empty field"
          rule="Stalled amber at 40 days opens after its red at 30; unsafe red emptied."
          start={withMock({
            thresholds: {
              ...mock.thresholds,
              stalled_amber_days: 40,
              unsafe_red_hours: Number.NaN,
            },
          })}
          group={thresholds}
        />
        <GroupSpecimen
          label="Scan as the mock holds it"
          rule="Every 15 minutes; the archived lane every 24 hours."
          start={mock}
          group={scan}
        />
        <GroupSpecimen
          label="An interval of zero"
          rule="A scan every zero minutes cannot be written."
          start={withMock({
            scan: { intervalMinutes: 0, archivedIntervalHours: 24 },
          })}
          group={scan}
        />
      </Section>
      <Section
        title="Launch"
        rule="The zellij session, sessions by root, and each command as one list line in the file's own form, read as JSON. Arguments are never split on spaces; an empty field removes the action."
        min={620}
      >
        <GroupSpecimen
          label="As the mock holds it"
          rule="Every command set, ~/undev in its own session."
          start={mock}
          group={launch}
        />
        <GroupSpecimen
          label="Malformed commands, and one removed"
          rule="VS Code typed as words, Folder with a placeholder it cannot fill, Obsidian emptied, which removes Open in Obsidian."
          start={withMock({
            launch: {
              ...mock.launch,
              commands: {
                ...mock.launch.commands,
                vscode: "code {path}",
                folder: '["dolphin", "{cwd}"]',
                obsidian: "",
              },
            },
          })}
          group={launch}
        />
      </Section>
      <Section
        title="Forges"
        rule="The finalised commit count, then each forge's hosts, accounts and tracked forks as raw text. Each account names its keyring key; the token itself never touches the file."
        min={620}
      >
        <GroupSpecimen
          label="As the mock holds them"
          rule="Three GitHub accounts and two on Forgejo."
          start={mock}
          group={forges}
        />
        <GroupSpecimen
          label="An account without a key, a fork without its owner"
          rule="Each account needs a name and a key; tracked forks are owner/name."
          start={withMock({
            forges: {
              ...mock.forges,
              github: {
                ...mock.forges.github,
                accounts: [{ account: "finch", key: "" }],
                trackedForks: ["fork"],
              },
            },
          })}
          group={forges}
        />
      </Section>
      <Section
        title="Server"
        rule="Absent by default. Monitor a server adds the section with three empty fields; Stop monitoring removes it again."
        min={460}
      >
        <GroupSpecimen
          label="Monitored"
          rule="The mock's Silo through its Uptime Kuma status page."
          start={mock}
          group={server}
        />
        <GroupSpecimen
          label="Not monitored"
          rule="No [server] section in the file."
          start={withMock({ server: null })}
          group={server}
        />
        <GroupSpecimen
          label="Turned on, not filled in"
          rule="Each of the three fields needs a value before the form saves."
          start={withMock({
            server: { name: "", kumaBaseUrl: "", kumaStatusPage: "" },
          })}
          group={server}
        />
      </Section>
      <Section
        title="Joins and ignores"
        rule="The presence lists as raw text: each join one list line of references, each ignore one reference."
        min={560}
      >
        <GroupSpecimen
          label="As the mock holds them"
          rule="No joins and nothing ignored."
          start={mock}
          group={presences}
        />
        <GroupSpecimen
          label="A join, an ignore, and a join typed as words"
          rule="The second join is not a list line."
          start={withMock({
            joins: [
              '["github:finch/notes", "forgejo:finch/notes"]',
              "github:a/b forgejo:a/b",
            ],
            ignore: ["github:finch/scratch"],
          })}
          group={presences}
        />
      </Section>
      <Usage
        component="<SettingsEditor>"
        props={[
          {
            name: "form",
            type: "SettingsForm",
            what: "The values as the file holds them, and the entries naming each wire and tier. The draft starts here and follows it while untouched.",
          },
          {
            name: "onSave",
            type: "(values: SettingsValues) => void",
            what: "Save was pressed with values that changed and can be written.",
          },
        ]}
      >
        <p>
          Each group (<Code>LocalPathsGroup</Code>, <Code>WiresGroup</Code>,{" "}
          <Code>ThresholdsGroup</Code>, <Code>ScanGroup</Code>,{" "}
          <Code>ImportanceGroup</Code>, <Code>LaunchGroup</Code>,{" "}
          <Code>ForgesGroup</Code>, <Code>ServerGroup</Code>,{" "}
          <Code>PresencesGroup</Code>) takes its slice of{" "}
          <Code>SettingsValues</Code> as <Code>value</Code> and every change as{" "}
          <Code>onChange</Code>; the wire and importance groups take{" "}
          <Code>named</Code> for their warnings. The editor composes them in
          config's order and lists <Code>settingsProblems(values)</Code> beside
          Save, as this page does beneath each specimen.
        </p>
        <p>
          The form comes from <Code>settingsFormFor(config, home)</Code> in{" "}
          <Code>@perch/core/settings-form.ts</Code>, which the main process
          answers <Code>settingsForm()</Code> with; saving goes back as{" "}
          <Code>saveSettings(values)</Code>, written by{" "}
          <Code>withSettings(config, values, home)</Code>.
        </p>
      </Usage>
    </>
  );
}

type Problems = "none" | "refused";

const problemOptions: { value: Problems; label: string }[] = [
  { value: "none", label: "None" },
  { value: "refused", label: "A refused save" },
];

/** The mock's form after the file was edited by hand: the scan interval moved. */
function editedOnDisk(
  form: SettingsForm,
  intervalMinutes: number,
): SettingsForm {
  return {
    ...form,
    values: { ...form.values, scan: { ...form.values.scan, intervalMinutes } },
  };
}

export function SettingsScenePage() {
  const [form, setForm] = useState(mockForm);
  const [problems, setProblems] = useState<Problems>("none");
  const [pressed, setPressed] = useState("nothing yet");
  return (
    <>
      <Section
        title="The settings page, end to end"
        rule="The camera header's settings word leads here, in the camera's place. The brand, back to the aviary and Escape go home. Edit a field, then change the file on disk: the draft is kept and the page says the file moved. Leave the form untouched and the change simply shows."
        min={600}
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Choice
            label="Problems"
            options={problemOptions}
            value={problems}
            onChange={setProblems}
          />
          <button
            type="button"
            onClick={() =>
              setForm(
                editedOnDisk(
                  form,
                  form.values.scan.intervalMinutes === 15 ? 20 : 15,
                ),
              )
            }
            className="cursor-pointer rounded-full border border-edge bg-band px-3.5 py-1.25 font-semibold text-[12.5px] text-ink-muted hover:text-ink"
          >
            Change the file on disk
          </button>
        </div>
      </Section>
      <SceneFrame height="max(640px, calc(100vh - 260px))">
        <SettingsView
          form={form}
          problems={
            problems === "refused"
              ? ["The config was not changed: Wires: each wire once"]
              : []
          }
          onSave={(values) => {
            setPressed("onSave(values)");
            setForm({ ...form, values });
          }}
          onHome={() => setPressed("onHome()")}
        />
      </SceneFrame>
      <Pressed text={pressed} />
      <Usage
        component="<SettingsView>"
        props={[
          {
            name: "form",
            type: "SettingsForm | null",
            what: "The settings as the file holds them; null until read, when the page says so.",
          },
          {
            name: "problems",
            type: "string[]",
            what: "The main process's problems, a refused save among them, listed above the form.",
          },
          {
            name: "onSave",
            type: "(values: SettingsValues) => void",
            what: "Save was pressed.",
          },
          {
            name: "onHome",
            type: "() => void",
            what: "The brand, back to the aviary, or Escape.",
          },
        ]}
      >
        <p>
          The desktop app renders it at <Code>/settings</Code> in place of the
          camera. Every pushed state reads the form again, so an edit to the
          file by hand, which the main process watches for, reaches an open
          page; an equal answer keeps the same object and the draft.
        </p>
      </Usage>
    </>
  );
}
