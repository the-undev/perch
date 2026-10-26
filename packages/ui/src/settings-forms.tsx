// The settings page's pages, one per part of config, and the editor that holds them: sources,
// joining up, wires, judgement, scanning and launching.
// Each page is presentational, its value in and every change out; the editor holds the draft
// across them and shows the page the rail has open.

import {
  type LaunchCommandName,
  launchPlaceholders,
} from "@perch/core/config.ts";
import { thresholdWindows } from "@perch/core/entry-form.ts";
import {
  type SettingsForm,
  type SettingsValues,
  settingsProblems,
  wireWarnings,
} from "@perch/core/settings-form.ts";
import type { KeyringCalls } from "@perch/core/sources-form.ts";
import type { SourceCard } from "@perch/core/viewmodel.ts";
import { type ReactNode, useState } from "react";
import {
  FormNotes,
  FormRow,
  monoInputClass,
  NumberInput,
  PillChoice,
  panelClass,
  primaryClass,
  quietClass,
  SettingsPageHead,
  StringList,
  secondaryClass,
  ThresholdField,
} from "./form-parts.tsx";
import { SourcesPage } from "./sources-page.tsx";

/** A page the settings rail names. */
export type SettingsPageName =
  | "sources"
  | "joining"
  | "wires"
  | "judgement"
  | "scanning"
  | "launching";

/** The rail's pages in order; Joining up sits under Sources, since joins act on what it finds. */
export const settingsPages: readonly {
  page: SettingsPageName;
  label: string;
  /** Drawn as a sub-page of the page above it. */
  sub: boolean;
}[] = [
  { page: "sources", label: "Sources", sub: false },
  { page: "joining", label: "Joining up", sub: true },
  { page: "wires", label: "Wires", sub: false },
  { page: "judgement", label: "Judgement", sub: false },
  { page: "scanning", label: "Scanning", sub: false },
  { page: "launching", label: "Launching", sub: false },
];

/** One page of config: its title, the table it writes, a lead beneath the title, and its rows. */
function SettingsGroup({
  title,
  table,
  lead,
  children,
}: {
  title: string;
  table: string;
  lead: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="pb-5">
      <SettingsPageHead title={title} table={table} lead={lead} />
      <div className={panelClass}>{children}</div>
    </section>
  );
}

/**
 * The default kept with its name: when the one entry edited in place was the default, the
 * default follows the new text.
 */
function followDefault(
  before: string[],
  after: string[],
  current: string,
): string {
  if (before.length !== after.length) return current;
  const index = before.findIndex((name, at) => name !== after[at]);
  if (index < 0 || before[index] !== current) return current;
  return after[index] ?? current;
}

/** An ordered list of names and the default picked from them. */
function NamesWithDefault({
  noun,
  placeholder,
  value,
  onChange,
}: {
  noun: string;
  placeholder: string;
  value: { names: string[]; default: string };
  onChange: (value: { names: string[]; default: string }) => void;
}) {
  const label = `${noun[0]?.toUpperCase()}${noun.slice(1)}s`;
  return (
    <>
      <FormRow label={label} sub="In order, first at the top">
        <StringList
          noun={noun}
          placeholder={placeholder}
          values={value.names}
          ordered={true}
          onChange={(names) =>
            onChange({
              names,
              default: followDefault(value.names, names, value.default),
            })
          }
        />
      </FormRow>
      <FormRow label="Default" sub={`The ${noun} an entry naming none takes`}>
        <PillChoice
          label={`Default ${noun}`}
          options={value.names.filter((name) => name.trim() !== "")}
          value={value.default}
          onChange={(chosen) => onChange({ ...value, default: chosen })}
        />
      </FormRow>
    </>
  );
}

export interface GroupProps<T> {
  value: T;
  onChange: (value: T) => void;
}

/** The wires top to bottom and the default; removing a wire entries name says what moves. */
export function WiresGroup({
  value,
  named,
  onChange,
}: GroupProps<SettingsValues["wires"]> & {
  /** The entry keys naming each wire. */
  named: Record<string, string[]>;
}) {
  return (
    <SettingsGroup
      title="Wires"
      table="[wires]"
      lead="The owner's priority bands, top to bottom. An adopted bird sits on the wire its entry names, else on the default."
    >
      <NamesWithDefault
        noun="wire"
        placeholder="Someday"
        value={value}
        onChange={onChange}
      />
      <FormNotes notes={wireWarnings(named, value)} />
    </SettingsGroup>
  );
}

/** The six global thresholds, amber before red in each window. */
export function ThresholdsGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["thresholds"]>) {
  return (
    <SettingsGroup
      title="Judgement"
      table="[thresholds]"
      lead="Amber at the first, red at the second, each a whole number above zero. A bird's entry may override any of them."
    >
      {thresholdWindows.map((window) => (
        <FormRow key={window.label} label={window.label} sub={window.unit}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {(["amber", "red"] as const).map((level) => {
              const key = window[level];
              return (
                <ThresholdField
                  key={level}
                  window={window}
                  level={level}
                  value={value[key]}
                  placeholder=""
                  onChange={(next) => onChange({ ...value, [key]: next })}
                />
              );
            })}
          </div>
        </FormRow>
      ))}
    </SettingsGroup>
  );
}

/** The two scan intervals and the finalised commits read on each default branch. */
export function ScanGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["scan"]>) {
  return (
    <SettingsGroup
      title="Scanning"
      table="[scan]"
      lead="Every source is scanned on the interval, counted from the end of the last scan. The archived interval is read by nothing yet."
    >
      <FormRow label="Interval" sub="minutes">
        <NumberInput
          label="Scan interval in minutes"
          value={value.intervalMinutes}
          placeholder=""
          onChange={(intervalMinutes) =>
            onChange({ ...value, intervalMinutes })
          }
        />
      </FormRow>
      <FormRow label="Archived interval" sub="hours">
        <NumberInput
          label="Archived scan interval in hours"
          value={value.archivedIntervalHours}
          placeholder=""
          onChange={(archivedIntervalHours) =>
            onChange({ ...value, archivedIntervalHours })
          }
        />
      </FormRow>
      <FormRow label="Finalised commits" sub="Read on each default branch">
        <NumberInput
          label="Finalised commits"
          value={value.finalisedCommits}
          placeholder=""
          onChange={(finalisedCommits) =>
            onChange({ ...value, finalisedCommits })
          }
        />
      </FormRow>
    </SettingsGroup>
  );
}

/** Rows of a few text fields each, removable, one more added at the end. */
function RecordRows<Field extends string>({
  noun,
  fields,
  rows,
  onChange,
}: {
  /** What one row is, for its fields and buttons. */
  noun: string;
  fields: { key: Field; label: string; placeholder: string }[];
  rows: Record<Field, string>[];
  onChange: (rows: Record<Field, string>[]) => void;
}) {
  const blank = Object.fromEntries(
    fields.map(({ key }) => [key, ""]),
  ) as Record<Field, string>;
  return (
    <>
      {rows.length > 0 && (
        <ul className="m-0 flex w-full list-none flex-col gap-1 p-0">
          {rows.map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place, so the position is the row's identity.
            <li key={index} className="flex items-center gap-1">
              {fields.map((field) => (
                <input
                  key={field.key}
                  type="text"
                  aria-label={`${noun} ${index + 1}, ${field.label}`}
                  placeholder={field.placeholder}
                  value={row[field.key]}
                  onChange={(event) =>
                    onChange(
                      rows.map((candidate, at) =>
                        at === index
                          ? { ...candidate, [field.key]: event.target.value }
                          : candidate,
                      ),
                    )
                  }
                  className={monoInputClass}
                />
              ))}
              <button
                type="button"
                aria-label={`Remove ${noun} ${index + 1}`}
                onClick={() => onChange(rows.filter((_, at) => at !== index))}
                className={quietClass}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => onChange([...rows, blank])}
        className={`${secondaryClass} px-2.75 py-1.5`}
      >
        Add {noun}
      </button>
    </>
  );
}

/** Each launch command's name on the page, with what its action does. */
const commandWords: Record<LaunchCommandName, { label: string; does: string }> =
  {
    zellij: { label: "zellij", does: "Finds or opens the item's tab" },
    terminal: { label: "Terminal", does: "Attaches a session not running" },
    vscode: { label: "VS Code", does: "Open in VS Code" },
    folder: { label: "Folder", does: "Open the folder" },
    obsidian: { label: "Obsidian", does: "Open in Obsidian" },
  };

/** The zellij sessions and the commands behind the launch actions, each a list line. */
export function LaunchGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["launch"]>) {
  return (
    <SettingsGroup
      title="Launching"
      table="[launch]"
      lead={
        <>
          Each command is a list in brackets of strings in double quotes, as in
          the config file, with JSON's escapes:{" "}
          <code className="font-mono">["code", "{"{path}"}"]</code>. Arguments
          are never split on spaces, and a command runs without a shell. An
          empty field removes the action.
        </>
      }
    >
      <FormRow label="Zellij session" sub="For an item nothing else assigns">
        <input
          type="text"
          aria-label="Zellij session"
          value={value.zellijSession}
          onChange={(event) =>
            onChange({ ...value, zellijSession: event.target.value })
          }
          className={`${monoInputClass} max-w-60`}
        />
      </FormRow>
      <FormRow label="Sessions by root" sub="The longest root holding the item">
        <RecordRows
          noun="session root"
          fields={[
            { key: "root", label: "root", placeholder: "~/work" },
            { key: "session", label: "session", placeholder: "work" },
          ]}
          rows={value.zellijSessions}
          onChange={(zellijSessions) => onChange({ ...value, zellijSessions })}
        />
      </FormRow>
      {(Object.keys(launchPlaceholders) as LaunchCommandName[]).map((name) => {
        const placeholders = launchPlaceholders[name];
        return (
          <FormRow
            key={name}
            label={commandWords[name].label}
            sub={
              placeholders.length === 0
                ? commandWords[name].does
                : `${commandWords[name].does}; ${placeholders.map((entry) => `{${entry}}`).join(", ")}`
            }
          >
            <input
              type="text"
              aria-label={`${commandWords[name].label} command`}
              placeholder="Not offered"
              spellCheck={false}
              value={value.commands[name]}
              onChange={(event) =>
                onChange({
                  ...value,
                  commands: { ...value.commands, [name]: event.target.value },
                })
              }
              className={monoInputClass}
            />
          </FormRow>
        );
      })}
    </SettingsGroup>
  );
}

/** The presence lists: joins, each a list line, and the presences ignored. */
export function PresencesGroup({
  value,
  onChange,
}: GroupProps<Pick<SettingsValues, "joins" | "ignore">>) {
  return (
    <SettingsGroup
      title="Joining up"
      table="joins, ignore"
      lead="A presence is local: and a path under the home directory, github:owner/name or forgejo:owner/name. A join is a list line, as a launch command is."
    >
      <FormRow label="Joins" sub="Presences that are one project">
        <StringList
          noun="join"
          placeholder='["github:owner/notes", "forgejo:owner/notes"]'
          values={value.joins}
          ordered={false}
          onChange={(joins) => onChange({ ...value, joins })}
        />
      </FormRow>
      <FormRow label="Ignore" sub="Left off the main view">
        <StringList
          noun="ignored presence"
          placeholder="github:owner/name"
          values={value.ignore}
          ordered={false}
          onChange={(ignore) => onChange({ ...value, ignore })}
        />
      </FormRow>
    </SettingsGroup>
  );
}

/** Two values are the same when they serialise alike: they are plain data. */
function same(a: SettingsValues, b: SettingsValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface SettingsEditorProps {
  /** The config as the file holds it now; the draft starts here and follows it while untouched. */
  form: SettingsForm;
  /** The page the rail has open. */
  page: SettingsPageName;
  /** Each configured source card's last scan; null until a snapshot holds them. */
  cards: SourceCard[] | null;
  /** The moment the source cards' scan times are measured to. */
  now: Date;
  /** Stores a forge card's pasted token and tests its connection. */
  keyring: KeyringCalls;
  /** Save was pressed with values that changed and can be written. */
  onSave: (values: SettingsValues) => void;
}

/**
 * The open page, with Save and Discard beneath, the draft held across every page. While the draft
 * is untouched it follows the file; once edited, a change to the file is noted and saving writes
 * over it.
 */
export function SettingsEditor({
  form,
  page,
  cards,
  now,
  keyring,
  onSave,
}: SettingsEditorProps) {
  const [base, setBase] = useState(form.values);
  const [draft, setDraft] = useState(form.values);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  if (form.values !== base) {
    setBase(form.values);
    if (saving || same(draft, base)) {
      setDraft(form.values);
      setSaving(false);
      setStale(false);
    } else {
      setStale(true);
    }
  }
  const dirty = !same(draft, base);
  const problems = settingsProblems(draft);
  const update = (change: Partial<SettingsValues>) => {
    setDraft({ ...draft, ...change });
    setSaving(false);
  };
  return (
    <form
      aria-label="Settings"
      onSubmit={(event) => {
        event.preventDefault();
        if (!dirty || problems.length > 0) return;
        setSaving(true);
        onSave(draft);
      }}
    >
      {page === "sources" && (
        <SourcesPage
          value={draft.sources}
          cards={cards}
          now={now}
          keyring={keyring}
          onChange={(sources) => update({ sources })}
        />
      )}
      {page === "joining" && (
        <PresencesGroup
          value={{ joins: draft.joins, ignore: draft.ignore }}
          onChange={(presences) => update(presences)}
        />
      )}
      {page === "wires" && (
        <WiresGroup
          value={draft.wires}
          named={form.named.wires}
          onChange={(wires) => update({ wires })}
        />
      )}
      {page === "judgement" && (
        <ThresholdsGroup
          value={draft.thresholds}
          onChange={(thresholds) => update({ thresholds })}
        />
      )}
      {page === "scanning" && (
        <ScanGroup value={draft.scan} onChange={(scan) => update({ scan })} />
      )}
      {page === "launching" && (
        <LaunchGroup
          value={draft.launch}
          onChange={(launch) => update({ launch })}
        />
      )}
      <div className="sticky bottom-0 -mx-4 border-edge border-t bg-rail px-4 py-3 @min-[900px]:-mx-6.5 @min-[900px]:px-6.5">
        {stale && (
          <p className="mt-0 mb-1 text-[12.5px] text-ink-muted">
            The config file changed since this form was edited. Saving writes
            the form over it; Discard takes the file's values.
          </p>
        )}
        <FormNotes notes={problems} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!dirty || problems.length > 0}
            className={primaryClass}
          >
            Save
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => {
              setDraft(base);
              setStale(false);
            }}
            className={secondaryClass}
          >
            Discard changes
          </button>
          <span className="text-[12px] text-ink-faint">
            {dirty ? "Unsaved changes" : "As the config file holds it"}
          </span>
        </div>
      </div>
    </form>
  );
}
