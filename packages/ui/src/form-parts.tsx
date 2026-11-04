// The pieces the config forms are made of, the adoption papers' fold and the settings page
// alike: page headings, ruled rows, pill choices, switches, editable lists and threshold fields,
// in one set of styles.

import type { thresholdWindows } from "@perch/core/entry-form.ts";
import { type ReactNode, useId, useState } from "react";

export const panelClass =
  "rounded-xl border border-edge bg-band px-5 pt-3 pb-4";

export const inputClass =
  "w-full min-w-0 rounded-lg border border-edge bg-panel px-2.75 py-1.5 font-body text-[13px] text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-ink-accent";

export const monoInputClass = `${inputClass} font-mono text-[12.5px]`;

export const buttonClass =
  "inline-flex cursor-pointer items-center rounded-lg px-3.5 py-2 font-body font-semibold text-[13px] focus-visible:outline-2 focus-visible:outline-ink-accent focus-visible:outline-offset-1 disabled:cursor-default disabled:opacity-50";

export const primaryClass = `${buttonClass} bg-paper text-paper-head hover:bg-paper-dim disabled:hover:bg-paper`;

export const secondaryClass = `${buttonClass} border border-edge text-ink-muted hover:bg-panel hover:text-ink`;

export const quietClass =
  "cursor-pointer rounded px-1.5 py-0.5 font-body text-[12px] text-ink-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-ink-accent disabled:cursor-default disabled:opacity-40 disabled:hover:text-ink-faint";

/** The width of the gutter beside a list's inputs, shared by each row's remove and the add line's Add. */
const listGutterClass = "w-16 shrink-0 justify-center";

export const pillGroupClass =
  "m-0 flex min-w-0 flex-wrap gap-1 rounded-full border border-edge bg-panel p-0.75";

export const pillClass =
  "cursor-pointer rounded-full px-3.5 py-1.25 font-semibold text-[12.5px] text-ink-muted hover:text-ink has-checked:bg-panel-hi has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-ink-accent";

/** A settings page's heading: its title, the config table it writes, and a lead beneath. */
export function SettingsPageHead({
  title,
  table,
  lead,
}: {
  title: string;
  table: string;
  lead: ReactNode;
}) {
  return (
    <>
      <div className="mb-0.5 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="m-0 font-bold font-display text-[20px] text-ink">
          {title}
        </h2>
        <code className="font-mono text-[12px] text-ink-faint">{table}</code>
      </div>
      <p className="mt-0 mb-4.5 max-w-[64ch] text-[13px] text-ink-muted leading-normal">
        {lead}
      </p>
    </>
  );
}

/** One ruled row: what it sets, with a quiet second line, and the control. */
export function FormRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-edge border-t px-0.5 py-2.75 first:border-t-0">
      <div className="w-44 flex-none pt-1">
        <span className="block font-body text-[13.5px] text-ink">{label}</span>
        {sub !== "" && (
          <span className="block text-[12px] text-ink-faint">{sub}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-[1_1_18rem] flex-col items-start gap-1.5">
        {children}
      </div>
    </div>
  );
}

/** Lines in amber beneath a form: what stops it saving, or what saving will do. */
export function FormNotes({ notes }: { notes: string[] }) {
  return notes.map((note) => (
    <p key={note} className="mt-1 mb-0 text-[12.5px] text-amber">
      {note}
    </p>
  ));
}

/** One of a few named choices as a row of pills. */
export function PillChoice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className={pillGroupClass}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option} className={pillClass}>
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={option === value}
            onChange={() => onChange(option)}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * An on and off switch: a button with the switch role. A held switch stays focusable and says it
 * is disabled, but a press does nothing.
 */
export function Switch({
  label,
  checked,
  held,
  describedBy,
  onChange,
}: {
  label: string;
  checked: boolean;
  held: boolean;
  /** The ids of the lines that say what the switch does. */
  describedBy: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={held}
      aria-label={label}
      aria-describedby={describedBy}
      onClick={() => {
        if (!held) onChange(!checked);
      }}
      className={`relative h-5 w-9.5 flex-none rounded-full border focus-visible:outline-2 focus-visible:outline-ink-accent focus-visible:outline-offset-2 ${checked ? "border-ink-accent bg-ink-accent" : "border-edge-hi bg-edge"} ${held ? "cursor-default opacity-45" : "cursor-pointer"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 size-3.5 rounded-full transition-[left,background-color] duration-120 ease-out motion-reduce:transition-none ${checked ? "left-5 bg-bg" : "left-0.5 bg-ink-faint"}`}
      />
    </button>
  );
}

/** A list moved one place: the entry at the index swapped with its neighbour. */
export function moved<T>(list: T[], index: number, by: -1 | 1): T[] {
  const next = [...list];
  const other = index + by;
  const [a, b] = [next[index], next[other]];
  if (a === undefined || b === undefined) return list;
  next[index] = b;
  next[other] = a;
  return next;
}

/**
 * A list of strings, each a text field edited in place and removable, one more added at the end,
 * each once.
 */
export function StringList({
  noun,
  placeholder,
  values,
  onChange,
}: {
  /** What one entry is, for the add field and each entry's buttons. */
  noun: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const one = `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
  const add = () => {
    const entry = draft.trim();
    if (entry === "") return;
    if (!values.includes(entry)) onChange([...values, entry]);
    setDraft("");
  };
  return (
    <>
      {values.length > 0 && (
        <ul className="m-0 flex w-full list-none flex-col gap-1 p-0">
          {values.map((entry, index) => (
            <li
              // Entries are edited in place, so the text cannot be the key.
              // biome-ignore lint/suspicious/noArrayIndexKey: the position is the entry's identity.
              key={index}
              className="flex items-center gap-1"
            >
              <input
                type="text"
                aria-label={`${noun} ${index + 1}`}
                value={entry}
                onChange={(event) =>
                  onChange(
                    values.map((candidate, at) =>
                      at === index ? event.target.value : candidate,
                    ),
                  )
                }
                className={monoInputClass}
              />
              <button
                type="button"
                aria-label={`Remove ${noun} ${entry}`}
                onClick={() => onChange(values.filter((_, at) => at !== index))}
                className={`${quietClass} ${listGutterClass}`}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex w-full items-center gap-1">
        <input
          type="text"
          aria-label={`Add ${one}`}
          placeholder={placeholder}
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
          aria-label={`Add the ${noun}`}
          onClick={add}
          disabled={draft.trim() === ""}
          className={`${secondaryClass} py-1.5 ${listGutterClass}`}
        >
          Add
        </button>
      </div>
    </>
  );
}

/** One threshold as a whole number field, labelled amber or red; an emptied field reads as NaN. */
export function ThresholdField({
  window,
  level,
  value,
  placeholder,
  onChange,
}: {
  window: (typeof thresholdWindows)[number];
  level: "amber" | "red";
  value: number | undefined;
  /** What an empty field stands for, or nothing. */
  placeholder: string;
  onChange: (value: number) => void;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-ink-faint">
      <span className={level === "amber" ? "text-amber" : "text-red"}>
        {level}
      </span>
      <NumberInput
        label={`${window.label}, ${level} after ${window.unit}`}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
      />
      {window.unit}
    </span>
  );
}

/** A whole number field; empty reads as NaN and NaN shows empty. */
export function NumberInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | undefined;
  placeholder: string;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={1}
      step={1}
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder}
      value={value === undefined || Number.isNaN(value) ? "" : value}
      onChange={(event) =>
        onChange(
          event.target.value === "" ? Number.NaN : Number(event.target.value),
        )
      }
      className={`${inputClass} w-18 tabular-nums`}
    />
  );
}
