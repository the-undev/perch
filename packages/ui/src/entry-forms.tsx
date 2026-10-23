// The detail page's config entry forms: adopting a bird from the fence, and editing the entry of
// an adopted one. Rows are ruled like the ledger, a label on the left and its control on the
// right. The forms hold only their draft; what is saved leaves through the callbacks.

import type { ExpectationName } from "@perch/core/config.ts";
import {
  type EntryForm,
  type EntryOptions,
  type EntryValues,
  entryProblems,
  type ThresholdKey,
  thresholdWindows,
} from "@perch/core/entry-form.ts";
import { type ReactNode, useId, useState } from "react";

/** What the detail page needs to adopt its bird or edit its entry. */
export interface EntryControls {
  /** The open bird's entry and the form's choices; null until read, when no control shows. */
  form: EntryForm | null;
  /** Writes the bird's entry, adopting it when it has none. */
  onSave: (birdId: string, values: EntryValues) => void;
  /** Removes the bird's entry, returning it to the fence. */
  onRemove: (birdId: string) => void;
}

const panelClass =
  "mt-3.5 max-w-180 rounded-xl border border-edge bg-band px-5 pt-3 pb-4";

const inputClass =
  "w-full min-w-0 rounded-lg border border-edge bg-panel px-2.75 py-1.5 font-body text-[13px] text-ink placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-ink-accent";

const buttonClass =
  "inline-flex cursor-pointer items-center rounded-lg px-3.5 py-2 font-body font-semibold text-[13px] focus-visible:outline-2 focus-visible:outline-ink-accent focus-visible:outline-offset-1 disabled:cursor-default disabled:opacity-50";

const primaryClass = `${buttonClass} bg-paper text-paper-head hover:bg-paper-dim disabled:hover:bg-paper`;

const secondaryClass = `${buttonClass} border border-edge text-ink-muted hover:bg-panel hover:text-ink`;

const quietClass =
  "cursor-pointer rounded px-1.5 py-0.5 font-body text-[12px] text-ink-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-ink-accent";

const pillGroupClass =
  "m-0 flex min-w-0 flex-wrap gap-1 rounded-full border border-edge bg-panel p-0.75";

const pillClass =
  "cursor-pointer rounded-full px-3.5 py-1.25 font-semibold text-[12.5px] text-ink-muted hover:text-ink has-checked:bg-panel-hi has-checked:text-ink has-focus-visible:outline-2 has-focus-visible:outline-ink-accent";

const expectationLabel: Record<ExpectationName, string> = {
  ci: "CI",
  tickets: "Tickets",
};

/** One ruled row: what it sets, with a quiet second line, and the control. */
function FormRow({
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
        <span className="block text-[12px] text-ink-faint">{sub}</span>
      </div>
      <div className="flex min-w-0 flex-[1_1_18rem] flex-col items-start gap-1.5">
        {children}
      </div>
    </div>
  );
}

/** A form's heading, in the ledger's section voice, with the config key it writes. */
function FormHeading({ title, entryKey }: { title: string; entryKey: string }) {
  return (
    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4">
      <h3 className="m-0 font-body font-semibold text-[13.5px] text-ink-faint">
        {title}
      </h3>
      <code className="font-mono text-[12px] text-ink-faint">
        [items."{entryKey}"]
      </code>
    </div>
  );
}

/**
 * One of a few named choices as a row of pills; null stands for the default, and choosing the
 * default sets null again, so config only holds what differs.
 */
function DefaultingChoice({
  label,
  options,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  defaultValue: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const name = useId();
  const chosen = value ?? defaultValue;
  return (
    <fieldset className={pillGroupClass}>
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option} className={pillClass}>
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={option === chosen}
            onChange={() => onChange(option === defaultValue ? null : option)}
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}

/** The name field: empty keeps the scanned name. */
function NameField({
  scannedName,
  value,
  onChange,
}: {
  scannedName: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <input
      type="text"
      aria-label="Name"
      placeholder={scannedName}
      value={value ?? ""}
      onChange={(event) =>
        onChange(event.target.value.trim() === "" ? null : event.target.value)
      }
      className={`${inputClass} max-w-80`}
    />
  );
}

/**
 * A list of paths relative to the item, each once: each removable, one more added at the end.
 * Null keeps the defaults, which the list names; an empty list is none at all.
 */
function PathList({
  noun,
  defaults,
  value,
  onChange,
}: {
  /** What one path is, for the add field and the remove buttons. */
  noun: string;
  /** What null keeps, in words. */
  defaults: string;
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const path = draft.trim();
    if (path === "") return;
    if (!(value ?? []).includes(path)) onChange([...(value ?? []), path]);
    setDraft("");
  };
  return (
    <>
      {value === null && (
        <span className="pt-1 text-[13px] text-ink-faint">{defaults}</span>
      )}
      {value !== null && value.length === 0 && (
        <span className="pt-1 text-[13px] text-ink-faint">None</span>
      )}
      {value !== null && value.length > 0 && (
        <ul className="m-0 w-full list-none p-0">
          {value.map((path) => (
            <li
              key={path}
              className="flex items-baseline justify-between gap-3 py-0.75"
            >
              <code className="min-w-0 break-all font-mono text-[12.5px] text-ink-muted">
                {path}
              </code>
              <button
                type="button"
                aria-label={`Remove ${noun} ${path}`}
                onClick={() =>
                  onChange(value.filter((candidate) => candidate !== path))
                }
                className={quietClass}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex w-full max-w-110 items-center gap-1.5">
        <input
          type="text"
          aria-label={`Add a ${noun}`}
          placeholder="relative/path.md"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
          className={`${inputClass} font-mono text-[12.5px]`}
        />
        <button
          type="button"
          aria-label={`Add the ${noun}`}
          onClick={add}
          disabled={draft.trim() === ""}
          className={`${secondaryClass} px-2.75 py-1.5`}
        >
          Add
        </button>
        {value !== null && (
          <button
            type="button"
            aria-label={`Use the default ${noun}s`}
            onClick={() => onChange(null)}
            className={`${quietClass} whitespace-nowrap`}
          >
            use the defaults
          </button>
        )}
      </div>
    </>
  );
}

/** One health window's amber and red overrides, each empty for the global value. */
function ThresholdPair({
  window,
  defaults,
  value,
  onChange,
}: {
  window: (typeof thresholdWindows)[number];
  defaults: Record<ThresholdKey, number>;
  value: EntryValues["thresholds"];
  onChange: (value: EntryValues["thresholds"]) => void;
}) {
  const set = (key: ThresholdKey, text: string) => {
    const { [key]: _, ...rest } = value;
    onChange(text === "" ? rest : { ...rest, [key]: Number(text) });
  };
  const overridden =
    value[window.amber] !== undefined || value[window.red] !== undefined;
  const field = (key: ThresholdKey, level: "amber" | "red") => (
    <label className="flex items-center gap-1.5 text-[12.5px] text-ink-faint">
      <span className={level === "amber" ? "text-amber" : "text-red"}>
        {level}
      </span>
      <input
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        aria-label={`${window.label}, ${level} after ${window.unit}`}
        placeholder={String(defaults[key])}
        value={value[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
        className={`${inputClass} w-18 tabular-nums`}
      />
    </label>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {field(window.amber, "amber")}
      {field(window.red, "red")}
      {overridden ? (
        <button
          type="button"
          aria-label={`Clear ${window.label}`}
          onClick={() => {
            const {
              [window.amber]: _amber,
              [window.red]: _red,
              ...rest
            } = value;
            onChange(rest);
          }}
          className={quietClass}
        >
          clear
        </button>
      ) : (
        <span className="text-[12px] text-ink-faint">default</span>
      )}
    </div>
  );
}

/** What an adoption sets: the wire, null for the default, and a name, null for the scanned one. */
export interface Adoption {
  wire: string | null;
  name: string | null;
}

export interface AdoptFormProps {
  /** The key the new entry is written under: the bird's item id. */
  entryKey: string;
  scannedName: string;
  wires: string[];
  defaultWire: string;
  onAdopt: (adoption: Adoption) => void;
  onCancel: () => void;
}

/** Adopting a fence bird: a wire to perch on and, if wanted, a name; confirming writes the entry. */
export function AdoptForm({
  entryKey,
  scannedName,
  wires,
  defaultWire,
  onAdopt,
  onCancel,
}: AdoptFormProps) {
  const [adoption, setAdoption] = useState<Adoption>({
    wire: null,
    name: null,
  });
  return (
    <form
      aria-label={`Adopt ${scannedName}`}
      className={panelClass}
      onSubmit={(event) => {
        event.preventDefault();
        onAdopt(adoption);
      }}
    >
      <FormHeading title="Adopt onto a wire" entryKey={entryKey} />
      <FormRow label="Wire" sub={`${defaultWire} unless chosen`}>
        <DefaultingChoice
          label="Wire"
          options={wires}
          defaultValue={defaultWire}
          value={adoption.wire}
          onChange={(wire) => setAdoption({ ...adoption, wire })}
        />
      </FormRow>
      <FormRow label="Name" sub="Empty keeps the scanned name">
        <NameField
          scannedName={scannedName}
          value={adoption.name}
          onChange={(name) => setAdoption({ ...adoption, name })}
        />
      </FormRow>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="submit" className={primaryClass}>
          Adopt
        </button>
        <button type="button" onClick={onCancel} className={secondaryClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export interface EntryEditorProps {
  /** The key the entry sits under, which the edit keeps. */
  entryKey: string;
  scannedName: string;
  /** The entry as config holds it now: the draft starts here. */
  values: EntryValues;
  options: EntryOptions;
  onSave: (values: EntryValues) => void;
  /** Removes the entry; asked only after a second press. */
  onUnadopt: () => void;
  onCancel: () => void;
}

/**
 * Editing an adopted bird's entry: wire, name, importance, expectations, key files, roadmaps and
 * the threshold overrides. Save stays off while the thresholds cannot be written.
 */
export function EntryEditor({
  entryKey,
  scannedName,
  values: initial,
  options,
  onSave,
  onUnadopt,
  onCancel,
}: EntryEditorProps) {
  const [values, setValues] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const problems = entryProblems(values, options);
  const update = (change: Partial<EntryValues>) =>
    setValues({ ...values, ...change });
  return (
    <form
      aria-label={`Edit ${values.name ?? scannedName}`}
      className={panelClass}
      onSubmit={(event) => {
        event.preventDefault();
        if (problems.length === 0) onSave(values);
      }}
    >
      <FormHeading title="Config entry" entryKey={entryKey} />
      <FormRow label="Wire" sub={`${options.defaultWire} unless chosen`}>
        <DefaultingChoice
          label="Wire"
          options={options.wires}
          defaultValue={options.defaultWire}
          value={values.wire}
          onChange={(wire) => update({ wire })}
        />
      </FormRow>
      <FormRow label="Name" sub="Empty keeps the scanned name">
        <NameField
          scannedName={scannedName}
          value={values.name}
          onChange={(name) => update({ name })}
        />
      </FormRow>
      <FormRow label="Importance" sub="Sets the bird's size">
        <DefaultingChoice
          label="Importance"
          options={options.tiers}
          defaultValue={options.defaultTier}
          value={values.importance}
          onChange={(importance) => update({ importance })}
        />
      </FormRow>
      <FormRow label="Expects" sub="Sources it should have">
        <fieldset className={pillGroupClass}>
          <legend className="sr-only">Expects</legend>
          {options.expectations.map((name) => (
            <label key={name} className={pillClass}>
              <input
                type="checkbox"
                className="sr-only"
                checked={values.expect.includes(name)}
                onChange={(event) =>
                  update({
                    expect: options.expectations.filter((candidate) =>
                      candidate === name
                        ? event.target.checked
                        : values.expect.includes(candidate),
                    ),
                  })
                }
              />
              {expectationLabel[name]}
            </label>
          ))}
        </fieldset>
      </FormRow>
      <FormRow label="Key files" sub="On paper beside the ledger">
        <PathList
          noun="key file"
          defaults="The README and the roadmaps"
          value={values.keyFiles}
          onChange={(keyFiles) => update({ keyFiles })}
        />
      </FormRow>
      <FormRow label="Roadmaps" sub="Read for outstanding work">
        <PathList
          noun="roadmap"
          defaults="The standard roadmap names"
          value={values.roadmaps}
          onChange={(roadmaps) => update({ roadmaps })}
        />
      </FormRow>
      {thresholdWindows.map((window) => (
        <FormRow key={window.label} label={window.label} sub={window.unit}>
          <ThresholdPair
            window={window}
            defaults={options.thresholds}
            value={values.thresholds}
            onChange={(thresholds) => update({ thresholds })}
          />
        </FormRow>
      ))}
      {problems.map((problem) => (
        <p key={problem} className="mt-1 mb-0 text-[12.5px] text-amber">
          {problem}
        </p>
      ))}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={problems.length > 0}
          className={primaryClass}
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className={secondaryClass}>
          Cancel
        </button>
        <span className="ml-auto flex items-center gap-2">
          {confirming ? (
            <>
              <button
                type="button"
                onClick={onUnadopt}
                className={`${buttonClass} border border-red/60 text-red hover:bg-red/10`}
              >
                Return to the fence
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={quietClass}
              >
                keep
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={`${buttonClass} text-ink-faint hover:text-red`}
            >
              Unadopt
            </button>
          )}
        </span>
      </div>
    </form>
  );
}
