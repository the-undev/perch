// The settings page's pages, one per part of config, and the editor that holds them: sources,
// joining up, wires, judgement, scanning and launching.
// Each page is presentational, its value in and every change out; the editor holds the draft
// across them and shows the page the rail has open.

import { thresholdWindows } from "@perch/core/entry-form.ts";
import { type LaunchActionValues, presetOf } from "@perch/core/launch-form.ts";
import {
  defaultName,
  type SettingsForm,
  type SettingsValues,
  settingsProblems,
  type WireRow,
  wireWarnings,
} from "@perch/core/settings-form.ts";
import type { KeyringCalls } from "@perch/core/sources-form.ts";
import type { SourceCard } from "@perch/core/viewmodel.ts";
import { type ReactNode, useId, useState } from "react";
import {
  FormNotes,
  FormRow,
  monoInputClass,
  moved,
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

export interface GroupProps<T> {
  value: T;
  onChange: (value: T) => void;
}

type Wires = SettingsValues["wires"];

/** The wires with the row at the index moved one place, the default kept on its row. */
function wiresMoved(wires: Wires, index: number, by: -1 | 1): Wires {
  const other = index + by;
  const { defaultRow } = wires;
  return {
    rows: moved(wires.rows, index, by),
    defaultRow:
      defaultRow === index ? other : defaultRow === other ? index : defaultRow,
  };
}

/** The wires without the row at the index, which is not the default's. */
function wiresWithout(wires: Wires, index: number): Wires {
  return {
    rows: wires.rows.filter((_, at) => at !== index),
    defaultRow:
      wires.defaultRow > index ? wires.defaultRow - 1 : wires.defaultRow,
  };
}

/** What removing a row does to the entries naming its config wire, in words. */
function removalWords(count: number, defaultWire: string): string {
  if (count === 0) return "No bird names this wire.";
  if (count === 1) return `1 bird names this wire; it moves to ${defaultWire}.`;
  return `${count} birds name this wire; they move to ${defaultWire}.`;
}

/**
 * The wires as rows edited in place, each keeping the config wire it started as through a rename
 * and a move, one more added at the end, each name once. Removing a row takes a second press,
 * after the row says what moves.
 */
function WireRows({
  value,
  named,
  onChange,
}: {
  value: Wires;
  /** The entry keys naming each config wire. */
  named: Record<string, string[]>;
  onChange: (value: Wires) => void;
}) {
  const [draft, setDraft] = useState("");
  // The row asked about, by identity: a move keeps the question on its row, an edit to it drops it.
  const [confirming, setConfirming] = useState<WireRow | null>(null);
  const linePrefix = useId();
  const { rows } = value;
  const add = () => {
    const name = draft.trim();
    if (name === "") return;
    if (!rows.some((row) => row.name === name)) {
      onChange({ ...value, rows: [...rows, { from: null, name }] });
    }
    setDraft("");
  };
  return (
    <>
      {rows.length > 0 && (
        <ul className="m-0 flex w-full list-none flex-col gap-1 p-0">
          {rows.map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place and carry their own from, so the position is the field's identity.
            <li key={index} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  aria-label={`wire ${index + 1}`}
                  value={row.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    onChange({
                      ...value,
                      rows: rows.map((candidate, at) =>
                        at === index ? { ...candidate, name } : candidate,
                      ),
                    });
                  }}
                  className={monoInputClass}
                />
                {row.from !== null && row.from !== row.name && (
                  <span className="flex-none whitespace-nowrap px-1 text-[12px] text-ink-faint">
                    was {row.from}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Move wire ${row.name} up`}
                  disabled={index === 0}
                  onClick={() => onChange(wiresMoved(value, index, -1))}
                  className={quietClass}
                >
                  up
                </button>
                <button
                  type="button"
                  aria-label={`Move wire ${row.name} down`}
                  disabled={index === rows.length - 1}
                  onClick={() => onChange(wiresMoved(value, index, 1))}
                  className={quietClass}
                >
                  down
                </button>
                <button
                  type="button"
                  aria-label={`Remove wire ${row.name}`}
                  aria-describedby={
                    row === confirming ? `${linePrefix}-${index}` : undefined
                  }
                  disabled={index === value.defaultRow}
                  onClick={() => {
                    if (row !== confirming) {
                      setConfirming(row);
                      return;
                    }
                    setConfirming(null);
                    onChange(wiresWithout(value, index));
                  }}
                  className={
                    row === confirming
                      ? `${quietClass} whitespace-nowrap text-red hover:text-red`
                      : quietClass
                  }
                >
                  {row === confirming ? "remove for good" : "remove"}
                </button>
              </div>
              {row === confirming && (
                <div className="flex flex-wrap items-baseline gap-x-2 px-1 text-[12.5px]">
                  <span
                    id={`${linePrefix}-${index}`}
                    className="text-ink-muted"
                  >
                    {removalWords(
                      row.from === null ? 0 : (named[row.from]?.length ?? 0),
                      defaultName(value) ?? "",
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className={quietClass}
                  >
                    keep
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex w-full max-w-110 items-center gap-1.5">
        <input
          type="text"
          aria-label="Add a wire"
          placeholder="Someday"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
          className={monoInputClass}
        />
        <button
          type="button"
          aria-label="Add the wire"
          onClick={add}
          disabled={draft.trim() === ""}
          className={`${secondaryClass} px-2.75 py-1.5`}
        >
          Add
        </button>
      </div>
    </>
  );
}

/** The wires top to bottom and the default; a renamed wire carries its entries with it. */
export function WiresGroup({
  value,
  named,
  onChange,
}: GroupProps<Wires> & {
  /** The entry keys naming each config wire. */
  named: Record<string, string[]>;
}) {
  return (
    <SettingsGroup
      title="Wires"
      table="[wires]"
      lead="The owner's priority bands, top to bottom. An adopted bird sits on the wire its entry names, else on the default. Renaming a wire takes its birds with it."
    >
      <FormRow label="Wires" sub="In order, first at the top">
        <WireRows value={value} named={named} onChange={onChange} />
      </FormRow>
      <FormRow
        label="Default"
        sub="The wire an entry naming none takes; pick another to remove it"
      >
        <PillChoice
          label="Default wire"
          options={value.rows
            .map((row) => row.name)
            .filter((name) => name.trim() !== "")}
          value={defaultName(value) ?? ""}
          onChange={(chosen) =>
            onChange({
              ...value,
              defaultRow: value.rows.findIndex((row) => row.name === chosen),
            })
          }
        />
      </FormRow>
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

/** The scan interval and the finalised commits read on each default branch. */
export function ScanGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["scan"]>) {
  return (
    <SettingsGroup
      title="Scanning"
      table="[scan]"
      lead="Every source is scanned on the interval, counted from the end of the last scan."
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

/** The launch actions in the order a bird offers them, each its words and commands as list lines. */
export function LaunchGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["launch"]>) {
  const set = (index: number, action: LaunchActionValues) =>
    onChange({ actions: value.actions.with(index, action) });
  const line = (
    label: string,
    text: string,
    change: (text: string) => void,
  ) => (
    <input
      type="text"
      aria-label={label}
      spellCheck={false}
      value={text}
      onChange={(event) => change(event.target.value)}
      className={monoInputClass}
    />
  );
  return (
    <SettingsGroup
      title="Launching"
      table="[[launch.actions]]"
      lead="What a bird's page can open, in this order. Each command is a list line, as in the config file."
    >
      {value.actions.map((action, index) => {
        const at = `Action ${index + 1}`;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: actions are edited in place, so the position is the row's identity.
          <FormRow key={index} label={presetOf(action).name} sub={at}>
            {line(`${at}, words`, action.verb, (verb) =>
              set(index, { ...action, verb }),
            )}
            {action.kind === "command" ? (
              line(`${at}, command`, action.command, (command) =>
                set(index, { ...action, command }),
              )
            ) : (
              <>
                {line(`${at}, zellij command`, action.zellij, (zellij) =>
                  set(index, { ...action, zellij }),
                )}
                {line(`${at}, terminal command`, action.terminal, (terminal) =>
                  set(index, { ...action, terminal }),
                )}
                {line(`${at}, session`, action.session, (session) =>
                  set(index, { ...action, session }),
                )}
                <RecordRows
                  noun="session root"
                  fields={[
                    { key: "root", label: "root", placeholder: "~/work" },
                    { key: "session", label: "session", placeholder: "work" },
                  ]}
                  rows={action.sessions}
                  onChange={(sessions) => set(index, { ...action, sessions })}
                />
              </>
            )}
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
          onChange={(joins) => onChange({ ...value, joins })}
        />
      </FormRow>
      <FormRow label="Ignore" sub="Left off the main view">
        <StringList
          noun="ignored presence"
          placeholder="github:owner/name"
          values={value.ignore}
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
