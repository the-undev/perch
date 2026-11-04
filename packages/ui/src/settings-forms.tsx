// The settings page's pages, one per part of config, and the editor that holds them: sources,
// joining up, wires, judgement, scanning, launching and the window.
// Each page is presentational, its value in and every change out; the editor holds the draft
// across them and shows the page the rail has open.

import { thresholdWindows } from "@perch/core/entry-form.ts";
import {
  cardIcon,
  cardObsidianOnly,
  cardVerb,
  kindTaken,
  type LaunchActionValues,
  type LaunchField,
  type LaunchProblem,
  launchDefaults,
  launchFieldLabels,
  launchProblems,
  newCard,
  withKindAdded,
} from "@perch/core/launch-form.ts";
import {
  commandKinds,
  customKind,
  type IconName,
  kindWords,
  type LaunchKind,
  launchKinds,
  lineIcons,
} from "@perch/core/launch-kinds.ts";
import {
  defaultName,
  loginEntryLine,
  loginSentence,
  type SettingsForm,
  type SettingsValues,
  settingsProblems,
  traySentence,
  type WireRow,
  wireWarnings,
} from "@perch/core/settings-form.ts";
import type { KeyringCalls } from "@perch/core/sources-form.ts";
import type { SourceCard, SourceCardKind } from "@perch/core/viewmodel.ts";
import { type ReactNode, useId, useState } from "react";
import {
  FormNotes,
  FormRow,
  inputClass,
  monoInputClass,
  moved,
  NumberInput,
  PillChoice,
  panelClass,
  pillClass,
  pillGroupClass,
  primaryClass,
  quietClass,
  SettingsPageHead,
  StringList,
  Switch,
  secondaryClass,
  ThresholdField,
} from "./form-parts.tsx";
import { Icon } from "./icons.tsx";
import { SourcesPage } from "./sources-page.tsx";

/** A page the settings rail names. */
export type SettingsPageName =
  | "sources"
  | "joining"
  | "wires"
  | "judgement"
  | "scanning"
  | "launching"
  | "window";

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
  { page: "window", label: "Window", sub: false },
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

/** A labelled field on a launch action's card, with its refusals in red beneath. */
function ActionField({
  field,
  sub,
  problems,
  children,
}: {
  field: LaunchField;
  /** A quiet second half of the label, or nothing. */
  sub: string;
  problems: string[];
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-stretch gap-1.5">
      <span className="text-[12px] text-ink-faint">
        {launchFieldLabels[field]}
        {sub !== "" && ` · ${sub}`}
      </span>
      {children}
      {problems.map((problem) => (
        <p key={problem} className="m-0 text-[12.5px] text-red">
          {problem}
        </p>
      ))}
    </div>
  );
}

const quietLineClass =
  "m-0 max-w-[62ch] text-[12.5px] text-ink-faint leading-normal";

/** The placeholders a kind's command may use, as the field's label says them. */
function placeholderWords(kind: LaunchKind): string {
  const allowed =
    kind === "command" || kind === "zellij"
      ? customKind.placeholders
      : commandKinds[kind].placeholders;
  return allowed.map((name) => `{${name}}`).join(", ");
}

/** The line icons as a row of choices, the chosen one marked: a custom command's icon. */
function IconPicker({
  value,
  onChange,
}: {
  value: IconName;
  onChange: (icon: IconName) => void;
}) {
  const name = useId();
  return (
    <fieldset className="m-0 flex min-w-0 flex-col items-start gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[12px] text-ink-faint">
        Icon · worn on the bird&apos;s page
      </legend>
      <div className={pillGroupClass}>
        {lineIcons.map((icon) => (
          <label key={icon} title={icon} className={`${pillClass} px-2.5`}>
            <input
              type="radio"
              name={name}
              aria-label={icon}
              className="sr-only"
              checked={icon === value}
              onChange={() => onChange(icon)}
            />
            <Icon name={icon} size={15} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * A launch action's fields by its kind, each with its refusals. A kind's fields show its defaults
 * in grey until typed over; a custom command's are its own, with its icon picked beside them.
 */
function ActionFields({
  action,
  problems,
  onChange,
}: {
  action: LaunchActionValues;
  problems: (field: LaunchField) => string[];
  onChange: (action: LaunchActionValues) => void;
}) {
  const defaults = launchDefaults(action.kind);
  const text = (
    field: "verb" | "command" | "zellij" | "terminal" | "session",
    value: string,
    change: (value: string) => void,
    mono: boolean,
  ) => (
    <input
      type="text"
      aria-label={launchFieldLabels[field]}
      spellCheck={false}
      placeholder={defaults[field]}
      value={value}
      onChange={(event) => change(event.target.value)}
      className={mono ? monoInputClass : inputClass}
    />
  );
  const verb = (
    <ActionField
      field="verb"
      sub="the action's label on the bird's page"
      problems={problems("verb")}
    >
      {text(
        "verb",
        action.verb,
        (next) => onChange({ ...action, verb: next }),
        false,
      )}
    </ActionField>
  );
  if (action.kind !== "zellij") {
    return (
      <>
        {verb}
        <ActionField
          field="command"
          sub={`runs detached, no shell · ${placeholderWords(action.kind)}`}
          problems={problems("command")}
        >
          {text(
            "command",
            action.command,
            (command) => onChange({ ...action, command }),
            true,
          )}
        </ActionField>
        {action.kind === "command" && (
          <IconPicker
            value={action.icon}
            onChange={(icon) => onChange({ ...action, icon })}
          />
        )}
        <p className={quietLineClass}>
          {cardObsidianOnly(action)
            ? "Offered on Obsidian birds only."
            : "Offered on every bird with a folder on this machine."}
        </p>
      </>
    );
  }
  return (
    <>
      {verb}
      <ActionField field="zellij" sub="" problems={problems("zellij")}>
        {text(
          "zellij",
          action.zellij,
          (zellij) => onChange({ ...action, zellij }),
          true,
        )}
      </ActionField>
      <ActionField
        field="terminal"
        sub="attaches a session not running · {session}, {cwd}"
        problems={problems("terminal")}
      >
        {text(
          "terminal",
          action.terminal,
          (terminal) => onChange({ ...action, terminal }),
          true,
        )}
      </ActionField>
      <div className="grid gap-2.5 @min-[520px]:grid-cols-2">
        <ActionField
          field="session"
          sub="for an item no root assigns"
          problems={problems("session")}
        >
          {text(
            "session",
            action.session,
            (session) => onChange({ ...action, session }),
            true,
          )}
        </ActionField>
        <ActionField
          field="sessions"
          sub="the longest root holding the item"
          problems={problems("sessions")}
        >
          <RecordRows
            noun="session root"
            fields={[
              { key: "root", label: "root", placeholder: "~/work" },
              { key: "session", label: "session", placeholder: "work" },
            ]}
            rows={action.sessions}
            onChange={(sessions) => onChange({ ...action, sessions })}
          />
        </ActionField>
      </div>
      <p className={quietLineClass}>
        Finds the session&apos;s tab named after the project and goes to it, or
        opens one in the project&apos;s directory. It does not raise the
        terminal&apos;s window.
      </p>
    </>
  );
}

/**
 * One launch action's card: its icon, its kind's name and its verb, greyed, with the arrows that
 * order it on the bird and its remove; opened by its head to its fields.
 */
function ActionCard({
  action,
  index,
  last,
  open,
  problems,
  onToggle,
  onChange,
  onMove,
  onRemove,
}: {
  action: LaunchActionValues;
  index: number;
  /** The card is the last, so it cannot move later. */
  last: boolean;
  open: boolean;
  problems: LaunchProblem[];
  onToggle: () => void;
  onChange: (action: LaunchActionValues) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const headingId = useId();
  const bodyId = useId();
  const name = kindWords(action.kind).name;
  const verb = cardVerb(action);
  const called = verb.trim() === "" ? name : verb;
  const fieldProblems = (field: LaunchField) =>
    problems
      .filter((problem) => problem.field === field)
      .map((problem) => problem.problem);
  return (
    <section
      aria-labelledby={headingId}
      className="mb-2.5 overflow-hidden rounded-[10px] border border-edge bg-panel"
    >
      <div className="relative flex items-center gap-3 px-4 py-3">
        <Icon name={cardIcon(action)} size={15} />
        <h3
          id={headingId}
          className="m-0 shrink-0 whitespace-nowrap font-display font-semibold text-[14.5px] text-ink"
        >
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={onToggle}
            className="cursor-pointer text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-ink-accent"
          >
            {name}
          </button>
        </h3>
        <span className="min-w-0 truncate text-[12.5px] text-ink-faint">
          {verb.trim() === "" ? "no words yet" : verb}
        </span>
        <span className="relative ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={`Move ${called} earlier on the bird`}
            title="Earlier on the bird"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className={quietClass}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move ${called} later on the bird`}
            title="Later on the bird"
            disabled={last}
            onClick={() => onMove(1)}
            className={quietClass}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label={`Remove ${called}`}
            onClick={onRemove}
            className={`${quietClass} hover:text-red`}
          >
            remove
          </button>
        </span>
      </div>
      {open && (
        <div
          id={bodyId}
          className="@container grid gap-3.5 border-edge border-t bg-band p-4"
        >
          <ActionFields
            action={action}
            problems={fieldProblems}
            onChange={onChange}
          />
        </div>
      )}
    </section>
  );
}

/** The kinds, then the custom command, as rows of what each does and asks; zellij greys once added. */
function LaunchShelf({
  actions,
  onAdd,
}: {
  actions: LaunchActionValues[];
  onAdd: (kind: LaunchKind) => void;
}) {
  return (
    <div className="mt-4 rounded-[10px] border border-edge-hi border-dashed">
      <ul aria-label="Kinds of action" className="m-0 list-none p-0">
        {launchKinds.map((kind) => {
          const words = kindWords(kind);
          const taken = kindTaken(actions, kind);
          return (
            <li
              key={kind}
              className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-edge border-b px-4 py-3.25"
            >
              <span
                className={`flex min-w-36 items-center gap-2 font-display font-semibold text-[14px] ${taken ? "text-ink-faint" : "text-ink"}`}
              >
                <Icon name={cardIcon(newCard(kind))} size={15} />
                {words.name}
              </span>
              <span className="min-w-0 flex-[1_1_18rem] text-[13px] text-ink-muted">
                {words.what}
              </span>
              <span className="ml-auto whitespace-nowrap text-[12px] text-ink-faint">
                {taken ? "already added" : words.needs}
              </span>
              <button
                type="button"
                aria-label={`Add ${words.name}`}
                disabled={taken}
                onClick={() => onAdd(kind)}
                className="cursor-pointer font-body font-semibold text-[13px] text-ink hover:text-ink-accent focus-visible:outline-2 focus-visible:outline-ink-accent disabled:cursor-default disabled:font-normal disabled:text-ink-faint"
              >
                Add
              </button>
            </li>
          );
        })}
      </ul>
      <p className="m-0 px-4 py-2.75 text-[12.5px] text-ink-faint">
        Each kind works as it is; its card changes its words or command. More
        kinds are added in later versions.
      </p>
    </div>
  );
}

/**
 * The Launching page: one card per launch action in the order a bird offers them, then the shelf
 * of kinds that adds one. A card with refusals starts open, and an added card opens alone.
 */
export function LaunchGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["launch"]>) {
  const { actions } = value;
  const problems = launchProblems(actions);
  const [open, setOpen] = useState(() =>
    actions.map((_, index) =>
      problems.some((problem) => problem.index === index),
    ),
  );
  // The file can change under the page, so each card reads its place, closed when it has none.
  const shown = actions.map((_, index) => open[index] ?? false);
  return (
    <section aria-label="Launching" className="pb-5">
      <SettingsPageHead
        title="Launching"
        table="[[launch.actions]]"
        lead={
          <>
            What a bird&apos;s page can open. Each action appears on every bird
            with a folder on this machine, in this order; the Obsidian kind, and
            a custom command using{" "}
            <code className="font-mono">{"{obsidian}"}</code>, on Obsidian birds
            only. A kind&apos;s card shows its defaults in grey until they are
            typed over.
          </>
        }
      />
      {actions.map((action, index) => (
        <ActionCard
          // biome-ignore lint/suspicious/noArrayIndexKey: cards hold no state of their own, so the position is the card's identity.
          key={index}
          action={action}
          index={index}
          last={index === actions.length - 1}
          open={shown[index] ?? false}
          problems={problems.filter((problem) => problem.index === index)}
          onToggle={() => setOpen(shown.with(index, !shown[index]))}
          onChange={(next) => onChange({ actions: actions.with(index, next) })}
          onMove={(by) => {
            setOpen(moved(shown, index, by));
            onChange({ actions: moved(actions, index, by) });
          }}
          onRemove={() => {
            setOpen(shown.filter((_, at) => at !== index));
            onChange({ actions: actions.filter((_, at) => at !== index) });
          }}
        />
      ))}
      <LaunchShelf
        actions={actions}
        onAdd={(kind) => {
          setOpen([...actions.map(() => false), true]);
          onChange({ actions: withKindAdded(actions, kind) });
        }}
      />
    </section>
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
      lead="A presence is local: and a path under the home directory, github:owner/name or forgejo:owner/name. A join is a list line: its presences in brackets, double-quoted."
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

/** One setting as a switch: its name, the sentence saying what its state does, lines beneath, and the switch. */
function SwitchRow({
  label,
  sentence,
  entry,
  held,
  checked,
  onChange,
}: {
  label: string;
  sentence: string;
  /** A path in mono beneath the sentence, or null. */
  entry: string | null;
  /** Why the switch cannot change, in amber beneath, or null when it can. */
  held: string | null;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const sentenceId = useId();
  const heldId = useId();
  return (
    <div className="flex items-center gap-6.5 border-edge border-t px-0.5 py-3.5 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-body font-semibold text-[14px] text-ink">
          {label}
        </span>
        <p
          id={sentenceId}
          className="m-0 max-w-[52ch] text-[13px] text-ink-muted leading-normal"
        >
          {sentence}
        </p>
        {entry !== null && (
          <p className="m-0 break-all font-mono text-[12px] text-ink-faint">
            {entry}
          </p>
        )}
        {held !== null && (
          <p
            id={heldId}
            className="m-0 max-w-[52ch] text-[13px] text-amber leading-normal"
          >
            Held: {held}
          </p>
        )}
      </div>
      <Switch
        label={label}
        checked={checked}
        held={held !== null}
        describedBy={held === null ? sentenceId : `${sentenceId} ${heldId}`}
        onChange={onChange}
      />
    </div>
  );
}

/**
 * The Window page: whether the window stays in the tray, from config, and whether the app starts
 * at login, from its autostart entry. Each row's sentence follows both switches.
 */
export function WindowGroup({
  value,
  login,
  onChange,
}: GroupProps<SettingsValues["window"]> & {
  /** The login row's hold, and the entry's path and target. */
  login: SettingsForm["login"];
}) {
  return (
    <SettingsGroup
      title="Window"
      table="[window]"
      lead="How the window lives on this machine."
    >
      <SwitchRow
        label="Stay in the tray"
        sentence={traySentence(value.tray)}
        entry={null}
        held={null}
        checked={value.tray}
        onChange={(tray) => onChange({ ...value, tray })}
      />
      <SwitchRow
        label="Start at login"
        sentence={loginSentence(value.login, value.tray)}
        entry={loginEntryLine(login, value.login)}
        held={login.held}
        checked={value.login}
        onChange={(on) => onChange({ ...value, login: on })}
      />
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
  /** The Sources page's cards of this kind start unfolded, as a link to the page asks; null for none. */
  unfold: SourceCardKind | null;
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
  unfold,
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
          unfold={unfold}
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
      {page === "window" && (
        <WindowGroup
          value={draft.window}
          login={form.login}
          onChange={(next) => update({ window: next })}
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
