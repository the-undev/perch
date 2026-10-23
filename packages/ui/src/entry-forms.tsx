// The detail page's config entry forms: adopting a bird from the fence, and editing the entry of
// an adopted one. Rows are ruled like the ledger, a label on the left and its control on the
// right (form-parts.tsx). The forms hold only their draft; what is saved leaves through the
// callbacks.

import type { ExpectationName } from "@perch/core/config.ts";
import {
  type EntryForm,
  type EntryOptions,
  type EntryValues,
  entryProblems,
  type ThresholdKey,
  thresholdWindows,
} from "@perch/core/entry-form.ts";
import { useState } from "react";
import {
  buttonClass,
  FormNotes,
  FormRow,
  inputClass,
  PillChoice,
  panelClass,
  pillClass,
  pillGroupClass,
  primaryClass,
  quietClass,
  StringList,
  secondaryClass,
  ThresholdField,
} from "./form-parts.tsx";

/** What the detail page needs to adopt its bird or edit its entry. */
export interface EntryControls {
  /** The open bird's entry and the form's choices; null until read, when no control shows. */
  form: EntryForm | null;
  /** Writes the bird's entry, adopting it when it has none. */
  onSave: (birdId: string, values: EntryValues) => void;
  /** Removes the bird's entry, returning it to the fence. */
  onRemove: (birdId: string) => void;
}

const entryPanelClass = `mt-3.5 max-w-180 ${panelClass}`;

const expectationLabel: Record<ExpectationName, string> = {
  ci: "CI",
  tickets: "Tickets",
};

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
  return (
    <PillChoice
      label={label}
      options={options}
      value={value ?? defaultValue}
      onChange={(option) => onChange(option === defaultValue ? null : option)}
    />
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
  return (
    <>
      {value === null && (
        <span className="pt-1 text-[13px] text-ink-faint">{defaults}</span>
      )}
      {value !== null && value.length === 0 && (
        <span className="pt-1 text-[13px] text-ink-faint">None</span>
      )}
      <StringList
        noun={noun}
        placeholder="relative/path.md"
        values={value ?? []}
        ordered={false}
        onChange={onChange}
      />
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
  const set = (key: ThresholdKey, next: number) => {
    const { [key]: _, ...rest } = value;
    onChange(Number.isNaN(next) ? rest : { ...rest, [key]: next });
  };
  const overridden =
    value[window.amber] !== undefined || value[window.red] !== undefined;
  const field = (key: ThresholdKey, level: "amber" | "red") => (
    <ThresholdField
      window={window}
      level={level}
      value={value[key]}
      placeholder={String(defaults[key])}
      onChange={(next) => set(key, next)}
    />
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
      className={entryPanelClass}
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
      className={entryPanelClass}
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
      <FormNotes notes={problems} />
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
