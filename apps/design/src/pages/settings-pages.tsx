// The settings page: each page of config but the sources in its states, with what the editor
// would say of it, the Updates page's status row in every update state, and the whole page as the
// app shows it, rail and all.

import { defaultConfig } from "@perch/core/config-default.ts";
import {
  mockAviary,
  mockConfig,
  mockImage,
  mockLogin,
  mockSnapshot,
  mockUpdates,
} from "@perch/core/mock.ts";
import {
  type SettingsForm,
  type SettingsValues,
  settingsFormFor,
  settingsProblems,
  sourceRunHeld,
} from "@perch/core/settings-form.ts";
import type { UpdateState } from "@perch/core/update.ts";
import { FormNotes } from "@perch/ui/form-parts.tsx";
import { mockHome, mockSettingsForm } from "@perch/ui/mock-birds.ts";
import {
  LaunchGroup,
  PresencesGroup,
  ScanGroup,
  type SettingsPageName,
  ThresholdsGroup,
  type UpdateCalls,
  UpdatesGroup,
  WindowGroup,
  WiresGroup,
} from "@perch/ui/settings-forms.tsx";
import { SettingsView } from "@perch/ui/settings-view.tsx";
import { type ReactNode, useState } from "react";
import { stubKeyring } from "../specimens.ts";
import {
  Choice,
  Code,
  Pressed,
  SceneFrame,
  Section,
  Specimen,
  Usage,
} from "../usage.tsx";

/** Four minutes after the mock's scan, the moment the source cards are measured to. */
const afterScan = new Date(Date.parse(mockSnapshot.scannedAt) + 4 * 60_000);

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
const launch = (
  values: SettingsValues,
  change: (c: Partial<SettingsValues>) => void,
) => (
  <LaunchGroup
    value={values.launch}
    onChange={(next) => change({ launch: next })}
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

/** The mock's autostart entry once written by an earlier image. */
const loginOn = settingsFormFor(
  mockConfig,
  mockHome,
  {
    ...mockLogin,
    on: true,
    target: `${mockHome}/Applications/perch-0.2.0-x86_64.AppImage`,
  },
  mockImage,
).login;

/** The mock run from source, with no entry. */
const fromSource = settingsFormFor(
  mockConfig,
  mockHome,
  {
    ...mockLogin,
    held: sourceRunHeld,
  },
  null,
).login;

/** The Window page with the login row's hold and entry as given. */
const windowWith =
  (login: SettingsForm["login"]) =>
  (values: SettingsValues, change: (c: Partial<SettingsValues>) => void) => (
    <WindowGroup
      value={values.window}
      login={login}
      onChange={(next) => change({ window: next })}
    />
  );

/** The moment the mock's update states are measured to: the mock's scan. */
const atScan = new Date(mockSnapshot.scannedAt);

/** Update calls that only say they were made. */
const quietUpdateCalls: UpdateCalls = {
  onCheck: () => {},
  onInstall: () => {},
  onRestart: () => {},
};

/** The mock's install row run from its AppImage. */
const onImage = mockForm.install;

/** The install row run from source. */
const sourceInstall = settingsFormFor(
  mockConfig,
  mockHome,
  mockLogin,
  null,
).install;

/** The Updates page in an update state, with the install row as given. */
const updatesWith =
  (update: UpdateState, install: SettingsForm["install"]) =>
  (values: SettingsValues, change: (c: Partial<SettingsValues>) => void) => (
    <UpdatesGroup
      value={values.update}
      install={install}
      update={update}
      now={atScan}
      calls={quietUpdateCalls}
      onChange={(next) => change({ update: next })}
    />
  );

/** Install on in config, as the install flow's specimens start. */
const installOn = withMock({ update: { check: true, install: true } });

export function SettingsGroupsPage() {
  return (
    <>
      <Section
        title="Wires"
        rule="Ordered rows, each edited in place and moved up and down, and the default picked from them. A row keeps the wire it started as, so a rename carries that wire's entries to the new name, and the default stays on its row. Removing a wire takes a second press on its remove, after the row says how many birds name it and that they move to the default; the form then names the entries. The default itself cannot be removed."
        min={560}
      >
        <GroupSpecimen
          label="As the mock holds them"
          rule="Machine & Home above Projects, Projects the default."
          start={mock}
          group={wires}
        />
        <GroupSpecimen
          label="A wire renamed"
          rule="Machine & Home is now Home: the row says what it was, and saving moves its three entries to Home. Nothing warns."
          start={withMock({
            wires: {
              rows: [
                { from: "Machine & Home", name: "Home" },
                { from: "Projects", name: "Projects" },
              ],
              defaultRow: 1,
            },
          })}
          group={wires}
        />
        <GroupSpecimen
          label="A wire removed that entries name"
          rule="Three entries sit on Machine & Home: the warning says they move to Projects. It is not a problem; Save stays on."
          start={withMock({
            wires: {
              rows: [{ from: "Projects", name: "Projects" }],
              defaultRow: 0,
            },
          })}
          group={wires}
        />
        <GroupSpecimen
          label="A blank name and a repeat"
          rule="Every wire needs a name, and each name appears once."
          start={withMock({
            wires: {
              rows: [
                { from: "Machine & Home", name: "Machine & Home" },
                { from: "Projects", name: " " },
                { from: null, name: "Machine & Home" },
              ],
              defaultRow: 1,
            },
          })}
          group={wires}
        />
      </Section>
      <Section
        title="Judgement and scanning"
        rule="The six global thresholds use the adoption papers' rule: whole numbers above zero, amber opening before red. The interval and the finalised commit count are whole numbers above zero too; an emptied field counts as none."
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
          rule="Every 15 minutes; the archived lane every 24 hours; ten finalised commits."
          start={mock}
          group={scan}
        />
        <GroupSpecimen
          label="An interval of zero"
          rule="A scan every zero minutes cannot be written."
          start={withMock({
            scan: { ...mock.scan, intervalMinutes: 0 },
          })}
          group={scan}
        />
      </Section>
      <Section
        title="Launching"
        rule="One card per launch action, in the order a bird offers them, then the shelf of kinds and the custom command that adds one. A card's head wears its icon, its kind's name and its verb, greyed, with the arrows and remove; its head opens it. A kind's fields show its defaults in grey until typed over, and only what differs is written. A custom command names its own verb and command and picks its icon. A command keeps the file's list form, read as JSON, never split on spaces. The shelf offers zellij once; refusals are red on the card and listed beside Save."
        min={620}
      >
        <GroupSpecimen
          label="As the mock holds it"
          rule="Obsidian, the zellij tab with its own terminal and ~/undev in its own session, VS Code, the folder in dolphin, nvim, and a custom command wearing the terminal; zellij greys on the shelf. Press a head to open its card."
          start={mock}
          group={launch}
        />
        <GroupSpecimen
          label="Nothing added"
          rule="A fresh config offers nothing on any bird: the shelf is the whole page, zellij among its kinds."
          start={withMock({ launch: { actions: [] } })}
          group={launch}
        />
        <GroupSpecimen
          label="A card's refusals"
          rule="A folder command not naming a program first, a VS Code command using {obsidian}, which only the Obsidian kind and a custom command may, and a custom command with no words; each card with a refusal starts open."
          start={withMock({
            launch: {
              actions: [
                {
                  kind: "folder",
                  verb: "",
                  command: '["", "dolphin", "{path}"]',
                },
                {
                  kind: "vscode",
                  verb: "",
                  command: '["code", "{obsidian}"]',
                },
                {
                  kind: "command",
                  verb: "",
                  command: '["lnav", "{path}/logs"]',
                  icon: "terminal",
                },
              ],
            },
          })}
          group={launch}
        />
        <GroupSpecimen
          label="The zellij card's refusals"
          rule="Its two commands, the session and the roots on the one card: a root not starting with / or ~, and a terminal using {path}, which zellij's terminal may not."
          start={withMock({
            launch: {
              actions: [
                {
                  kind: "zellij",
                  verb: "",
                  zellij: "",
                  terminal: '["alacritty", "--working-directory", "{path}"]',
                  session: "",
                  sessions: [{ root: "work", session: "work" }],
                },
              ],
            },
          })}
          group={launch}
        />
      </Section>
      <Section
        title="Joining up"
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
      <Section
        title="Window"
        rule="Two switch rows. Stay in the tray is config's [window] tray, true unless the file says false. Start at login reads whether ~/.config/autostart/perch.desktop exists, and Save writes or removes that entry, never config. Each row's sentence says what its state does, and the login sentence follows the tray switch: hidden in the tray, or with the window open. An entry that exists is named in mono beneath, with the image its Exec runs. Run from source the login switch is held, in amber, while the tray switch stays editable."
        min={560}
      >
        <GroupSpecimen
          label="The defaults"
          rule="Tray on, no autostart entry: Save writes nothing. The login sentence already says what turning it on does."
          start={mock}
          group={windowWith(mockForm.login)}
        />
        <GroupSpecimen
          label="Start at login, on"
          rule="The entry exists: the sentence says what is true, and the line beneath names the entry and the image it runs."
          start={withMock({ window: { tray: true, login: true } })}
          group={windowWith(loginOn)}
        />
        <GroupSpecimen
          label="The tray, off"
          rule="Closing quits, and the login row starts the window open: Save writes tray = false and the entry without --hidden."
          start={withMock({ window: { tray: false, login: true } })}
          group={windowWith(loginOn)}
        />
        <GroupSpecimen
          label="Run from source"
          rule="No APPIMAGE, so no image to point the entry at: the login switch is held at what the entry says, and pressing it does nothing."
          start={mock}
          group={windowWith(fromSource)}
        />
      </Section>
      <Section
        title="Updates"
        rule="The status row first, one shape in every state: a sentence saying what is known, a detail line, and one button slot. The slot holds Check now, quiet, until something newer is known, then the next step: Open the releases page with install off, Install with it on, Restart now once downloaded; its weight says whether Perch itself can act. The detail line holds the releases link, an amber failure, the download's bar or a quiet note. Two switch rows follow: Check for updates is [update] check, true unless the file says false; Install updates is [update] install, false unless it says true, its row naming the image it replaces. Run from source the install switch is held, in amber. The status row is state, never saved."
        min={560}
      >
        <GroupSpecimen
          label="The defaults, up to date"
          rule="Check on, install off: Save writes nothing. The last check's answer and its age."
          start={mock}
          group={updatesWith(mockUpdates.upToDate, onImage)}
        />
        <GroupSpecimen
          label="Before the first check"
          rule="Nothing learned yet; Check now checks once."
          start={mock}
          group={updatesWith(mockUpdates.noCheck, onImage)}
        />
        <GroupSpecimen
          label="Checking"
          rule="The sentence says so and the button quiets."
          start={mock}
          group={updatesWith(mockUpdates.checking, onImage)}
        />
        <GroupSpecimen
          label="A release is out, install off"
          rule="Both versions named; the button opens the release's page in the browser and Perch touches nothing."
          start={mock}
          group={updatesWith(mockUpdates.found, onImage)}
        />
        <GroupSpecimen
          label="A release is out, install on"
          rule="The button is the install itself, waiting for the press."
          start={installOn}
          group={updatesWith(mockUpdates.foundInstall, onImage)}
        />
        <GroupSpecimen
          label="Downloading"
          rule="The bar in the detail line, the install held."
          start={installOn}
          group={updatesWith(mockUpdates.downloading, onImage)}
        />
        <GroupSpecimen
          label="Downloaded"
          rule="Restart now replaces the image and starts it as the window stands; quitting normally also installs it. Nothing restarts by itself."
          start={installOn}
          group={updatesWith(mockUpdates.ready, onImage)}
        />
        <GroupSpecimen
          label="A failed download"
          rule="One amber sentence, mechanism first; Install returns. A checksum mismatch discards the download and says so."
          start={installOn}
          group={updatesWith(mockUpdates.downloadFailed, onImage)}
        />
        <GroupSpecimen
          label="A failed check"
          rule="The last answer stays above the amber line saying why it is old."
          start={installOn}
          group={updatesWith(mockUpdates.checkFailed, onImage)}
        />
        <GroupSpecimen
          label="Checking by hand"
          rule="Check off and install on: Perch never calls GitHub by itself, and Check now still does. Save writes both switches."
          start={withMock({ update: { check: false, install: true } })}
          group={updatesWith(mockUpdates.checkOff, onImage)}
        />
        <GroupSpecimen
          label="Run from source"
          rule="No APPIMAGE, so no image to replace: the install switch is held and its row says why. The check still works."
          start={mock}
          group={updatesWith(mockUpdates.sourceRun, sourceInstall)}
        />
      </Section>
      <Usage
        component="<SettingsEditor>"
        props={[
          {
            name: "form",
            type: "SettingsForm",
            what: "The values as the file and the autostart entry hold them, the entries naming each wire, and the login row's hold and entry. The draft starts here and follows it while untouched.",
          },
          {
            name: "page",
            type: "SettingsPageName",
            what: "The page the rail has open.",
          },
          {
            name: "cards",
            type: "SourceCard[] | null",
            what: "Each configured source card's last scan, for the Sources page.",
          },
          {
            name: "now",
            type: "Date",
            what: "The moment the source cards' scan times are measured to.",
          },
          {
            name: "keyring",
            type: "KeyringCalls",
            what: "Stores a forge card's pasted token and tests its connection, each resolving to a result the card puts in a sentence.",
          },
          {
            name: "update",
            type: "UpdateState",
            what: "The update state the Updates page's status row shows.",
          },
          {
            name: "updateCalls",
            type: "UpdateCalls",
            what: "What the status row asks of the main process: check, install, restart.",
          },
          {
            name: "onSave",
            type: "(values: SettingsValues) => void",
            what: "Save was pressed with values that changed and can be written.",
          },
        ]}
      >
        <p>
          Each page (<Code>WiresGroup</Code>, <Code>ThresholdsGroup</Code>,{" "}
          <Code>ScanGroup</Code>, <Code>LaunchGroup</Code>,{" "}
          <Code>PresencesGroup</Code>, <Code>WindowGroup</Code>,{" "}
          <Code>UpdatesGroup</Code>, and <Code>SourcesPage</Code> on a page of
          its own) takes its slice of <Code>SettingsValues</Code> as{" "}
          <Code>value</Code> and every change as <Code>onChange</Code>; the
          wires page takes <Code>named</Code> for its warnings, the window page{" "}
          <Code>login</Code> for the login row, and the updates page{" "}
          <Code>install</Code>, <Code>update</Code> and <Code>calls</Code> for
          the install row and the status row. The editor shows the page the rail
          has open, holds the draft across every page, and lists{" "}
          <Code>settingsProblems(values)</Code> beside Save, as this page does
          beneath each specimen.
        </p>
        <p>
          The form comes from{" "}
          <Code>settingsFormFor(config, home, login, image)</Code> in{" "}
          <Code>@perch/core/settings-form.ts</Code>, which the main process
          answers <Code>settingsForm()</Code> with, the login entry read from
          the machine; saving goes back as <Code>saveSettings(values)</Code>,
          written by <Code>withSettings(config, values, home)</Code>, and the
          main process writes or removes the autostart entry.
        </p>
      </Usage>
    </>
  );
}

type Problems = "none" | "refused";

type ScanState = "idle" | "scanning" | "first";

const scanOptions: { value: ScanState; label: string }[] = [
  { value: "idle", label: "Scanned" },
  { value: "scanning", label: "Scanning" },
  { value: "first", label: "No scan yet" },
];

type Start = "mock" | "starter";

const startOptions: { value: Start; label: string }[] = [
  { value: "mock", label: "The mock's" },
  { value: "starter", label: "The starter's, no sources" },
];

const startForms: Record<Start, SettingsForm> = {
  mock: mockForm,
  starter: settingsFormFor(defaultConfig(), mockHome, mockLogin, mockImage),
};

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
  const [start, setStart] = useState<Start>("mock");
  const [form, setForm] = useState(mockForm);
  const [problems, setProblems] = useState<Problems>("none");
  const [scan, setScan] = useState<ScanState>("idle");
  const [pressed, setPressed] = useState("nothing yet");
  const [page, setPage] = useState<SettingsPageName>("sources");
  const keyring = stubKeyring(
    { stored: { ok: true }, tested: { ok: true, count: 5 } },
    setPressed,
  );
  return (
    <>
      <Section
        title="The settings page, end to end"
        rule="The camera header's settings word leads here, in the camera's place, open on Sources. The header carries the camera's scan line; pressing it scans now. Pressing the config path opens the file. The rail names every page beside one reading-width column, capped near 1400px and centred; below about 900px it folds to a row of words above the column. The brand, back to the aviary and Escape go home. Edit a field, then change the file on disk: the draft is kept across pages and the page says the file moved. Leave the form untouched and the change shows."
        min={600}
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Choice
            label="Config"
            options={startOptions}
            value={start}
            onChange={(next) => {
              setStart(next);
              setForm(startForms[next]);
            }}
          />
          <Choice
            label="Problems"
            options={problemOptions}
            value={problems}
            onChange={setProblems}
          />
          <Choice
            label="Scan"
            options={scanOptions}
            value={scan}
            onChange={setScan}
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
          key={start}
          form={form}
          cards={mockSnapshot.sourceCards}
          now={afterScan}
          aviary={scan === "first" ? null : mockAviary}
          scanning={scan !== "idle"}
          onRescan={() => setPressed("onRescan()")}
          onOpenConfig={() => setPressed("onOpenConfig()")}
          keyring={keyring}
          problems={
            problems === "refused"
              ? [
                  "The config was not changed: Wires: two wires are named Projects; each name may appear once",
                ]
              : []
          }
          unfold={null}
          page={page}
          onPage={setPage}
          update={mockUpdates.upToDate}
          updateCalls={{
            onCheck: () => setPressed("updateCalls.onCheck()"),
            onInstall: () => setPressed("updateCalls.onInstall()"),
            onRestart: () => setPressed("updateCalls.onRestart()"),
          }}
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
            name: "cards",
            type: "SourceCard[] | null",
            what: "Each configured source card's last scan from the pushed state; null until a snapshot holds them.",
          },
          {
            name: "now",
            type: "Date",
            what: "The render's clock: the scan line's phase and age, and the source cards' scan times.",
          },
          {
            name: "aviary",
            type: "Aviary | null",
            what: "The latest scan's aviary, whose time and unread sources the header's scan line says; null until the first scan has finished, when the line says no scan yet.",
          },
          {
            name: "scanning",
            type: "boolean",
            what: "A scan is running; the scan line says so and holds its press.",
          },
          {
            name: "onRescan",
            type: "() => void",
            what: "The scan line was pressed: scan now.",
          },
          {
            name: "onOpenConfig",
            type: "() => void",
            what: "The config path in the header was pressed: the main process opens the file in the first VS Code action, else its directory with the folder action or the folder kind's default.",
          },
          {
            name: "keyring",
            type: "KeyringCalls",
            what: "Stores a forge card's pasted token and tests its connection, each resolving to a result the card puts in a sentence.",
          },
          {
            name: "problems",
            type: "string[]",
            what: "The main process's problems, a refused save among them, listed above the form.",
          },
          {
            name: "unfold",
            type: "SourceCardKind | null",
            what: "The Sources page's cards of this kind start unfolded: /settings?unfold=local, from a no-clone slip's Open Sources. Null for none.",
          },
          {
            name: "page",
            type: "SettingsPageName",
            what: "The page the rail has open: /settings?page=updates, from the tray's update entry. Sources without one.",
          },
          {
            name: "onPage",
            type: "(page: SettingsPageName) => void",
            what: "The rail asked for a page.",
          },
          {
            name: "update",
            type: "UpdateState",
            what: "The running version, the release checks' answers and the download, from the pushed state, for the Updates page's status row.",
          },
          {
            name: "updateCalls",
            type: "UpdateCalls",
            what: "Check now, Install and Restart now from the status row; Open the releases page is a link.",
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
          camera, and goes there once the welcome creates the config file. The
          open page is the URL's, Sources without one. Every pushed state reads
          the form again, so an edit to the file by hand, which the main process
          watches for, reaches an open page; an equal answer keeps the same
          object and the draft.
        </p>
      </Usage>
    </>
  );
}
