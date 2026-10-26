// The adoption papers: one sheet of paper on a bird's page that adopts a fence bird and, reopened,
// amends an adopted one. The head carries the portrait and the ring, the config key; then what
// perch has seen, in the scanner's mono and not editable; then what the owner says, the common
// choices above a fold that names the rare ones; then the signature line. The sheet holds only its
// draft: what is signed leaves through the callbacks, and the caller decides when it folds away.

import type { ExpectationName } from "@perch/core/config.ts";
import {
  type EntryForm,
  type EntryValues,
  emptyEntryValues,
  entryProblems,
  type ThresholdKey,
  thresholdWindows,
} from "@perch/core/entry-form.ts";
import type { Bird } from "@perch/core/viewmodel.ts";
import { type ReactNode, useId, useState } from "react";
import { BirdFigure, birdLook } from "./bird.tsx";
import {
  FormRow,
  monoInputClass,
  quietClass,
  StringList,
  ThresholdField,
} from "./form-parts.tsx";
import { agoWords } from "./time.ts";

const paperInputClass =
  "w-[min(34ch,100%)] rounded-[7px] border border-paper-rule bg-paper-code px-2.5 py-1.75 font-mono text-[13px] text-paper-strong placeholder:text-paper-quiet focus-visible:outline-2 focus-visible:outline-paper-head focus-visible:outline-offset-1";

const chipClass =
  "inline-flex cursor-pointer items-center gap-1.75 rounded-lg border border-paper-rule bg-paper px-3 py-1.5 text-[13px] text-paper-text has-checked:border-paper-strong has-checked:bg-paper-strong has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-paper-head has-focus-visible:outline-offset-1";

const linkClass =
  "cursor-pointer p-0 font-body text-[13px] text-paper-quiet underline hover:text-paper-head focus-visible:outline-2 focus-visible:outline-paper-head";

const keyClass =
  "cursor-pointer rounded-[9px] bg-key px-4 py-2.5 font-body font-bold text-[13.5px] text-ink hover:bg-key-hi focus-visible:outline-2 focus-visible:outline-paper-head focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-key";

/** What each expectation asks of the item, beside its name. */
const expectationWhy: Record<ExpectationName, string> = {
  ci: "a pipeline on its forge",
};

/** The bird as it stands, facing left as on the board, small in the papers' corner. */
function Portrait({ bird, night }: { bird: Bird; night: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="-39 -58 85 63"
      width={74}
      height={55}
      className="mt-0.5 flex-none"
    >
      <g transform="scale(-1 1)">
        <BirdFigure
          look={birdLook(bird, night)}
          id={bird.id}
          speaking={false}
          idle
        />
      </g>
    </svg>
  );
}

/** A part of the sheet below a rule, named quietly. */
function Part({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="mt-4.5 border-paper-rule border-t pt-3.5">
      <p className="m-0 mb-2.5 text-[12.5px] text-paper-quiet">{name}</p>
      {children}
    </div>
  );
}

/** A field's name in the sheet's voice, which its control is labelled by, with its hint beside it. */
function FieldHead({
  id,
  label,
  hint,
}: {
  id: string;
  label: string;
  hint: string;
}) {
  return (
    <div className="mb-1.25">
      <span id={id} className="font-semibold text-[13.5px] text-paper-head">
        {label}
      </span>
      <span id={`${id}-hint`} className="ml-2 text-[12.5px] text-paper-quiet">
        {hint}
      </span>
    </div>
  );
}

/** The bird drawn small on the chosen wire, in the paper's strongest ink. */
function SittingBird({ shown }: { shown: boolean }) {
  return (
    <g
      transform="translate(46 2)"
      className={`transition-opacity duration-150 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
    >
      <ellipse cx={20} cy={16} rx={11} ry={8} className="fill-paper-strong" />
      <circle cx={11} cy={10} r={5.5} className="fill-paper-strong" />
      <polygon points="6,9.4 1.5,11 6,12.6" className="fill-paper-quiet" />
      <path
        d="M17 24 L17 28 M23 24 L23 28"
        strokeWidth={1.8}
        strokeLinecap="round"
        className="stroke-paper-strong"
      />
    </g>
  );
}

/** The wires drawn as strokes on the paper, the bird sitting on the chosen one; the default stores null. */
function WirePicker({
  labelId,
  wires,
  defaultWire,
  value,
  onChange,
}: {
  labelId: string;
  wires: string[];
  defaultWire: string;
  value: string | null;
  onChange: (wire: string | null) => void;
}) {
  const name = useId();
  const chosen = value ?? defaultWire;
  return (
    <fieldset aria-labelledby={labelId} className="m-0 border-0 p-0">
      {wires.map((wire) => {
        const on = wire === chosen;
        return (
          <label
            key={wire}
            data-wire={wire}
            data-chosen={on}
            className="relative block cursor-pointer rounded pb-2.25 has-focus-visible:outline-2 has-focus-visible:outline-paper-head has-focus-visible:outline-offset-3"
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={on}
              onChange={() => onChange(wire === defaultWire ? null : wire)}
            />
            <svg
              aria-hidden="true"
              height={34}
              className="block w-full overflow-visible"
            >
              <line
                x1={0}
                y1={30}
                x2="100%"
                y2={30}
                strokeWidth={on ? 3.5 : 3}
                strokeLinecap="round"
                className={`transition-[stroke] duration-150 motion-reduce:transition-none ${on ? "stroke-paper-strong" : "stroke-paper-quiet/50"}`}
              />
              <SittingBird shown={on} />
            </svg>
            <span
              className={`mt-1.25 block text-[13px] ${on ? "font-semibold text-paper-head" : "text-paper-quiet"}`}
            >
              {wire}{" "}
              {wire === defaultWire && (
                <span className="opacity-60">· the default</span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
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

/** A text field's value as an entry holds it: blank is null. */
function blankAsNull(text: string): string | null {
  return text.trim() === "" ? null : text;
}

export interface AdoptionPapersProps {
  /** The bird the papers are for: its name and portrait head the sheet. */
  bird: Bird;
  /** The bird's entry form: amend mode when it has values, adopt mode when it has none. */
  form: EntryForm;
  /** The sky is at night: the portrait sleeps as the bird does. */
  night: boolean;
  /** The render's clock, which the last commit's age is measured to. */
  now: Date;
  /** Sentences from the main process, a refused write among them, shown above the signature. */
  problems: string[];
  /** Signed: the values to write, every untouched field null. */
  onSign: (values: EntryValues) => void;
  /** Return to the fence was pressed and then confirmed. */
  onReturn: () => void;
  /** Not now, or Escape: the papers fold away and nothing is written. */
  onClose: () => void;
}

/** The adoption papers for one bird, adopting it or amending its entry. */
export function AdoptionPapers({
  bird,
  form,
  night,
  now,
  problems,
  onSign,
  onReturn,
  onClose,
}: AdoptionPapersProps) {
  const [values, setValues] = useState(form.values ?? emptyEntryValues());
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const id = useId();
  const { options, seen } = form;
  const amending = form.values !== null;
  const holds = entryProblems(values, options);
  const update = (change: Partial<EntryValues>) =>
    setValues({ ...values, ...change });
  const ids = {
    wire: `${id}-wire`,
    name: `${id}-name`,
    expect: `${id}-expect`,
    more: `${id}-more`,
  };
  return (
    <form
      aria-label={`Adoption papers for ${bird.name}`}
      className="w-full max-w-155 rounded-[10px] bg-paper px-7.5 pt-6.5 pb-6 text-paper-text shadow-paper motion-safe:animate-swap"
      onSubmit={(event) => {
        event.preventDefault();
        if (holds.length === 0) onSign(values);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // The papers fold before the camera rides home.
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 mb-0.5 text-[12.5px] text-paper-quiet tracking-[0.02em]">
            Adoption papers
          </p>
          <h3 className="m-0 mb-0.5 font-display font-extrabold text-[30px] text-paper-strong leading-tight">
            {bird.name}
          </h3>
          <p className="m-0 font-mono text-[12px] text-paper-quiet">
            ring {form.key ?? bird.id}
          </p>
        </div>
        <Portrait bird={bird} night={night} />
      </div>

      <Part name="What perch has seen">
        <div
          data-part="seen"
          className="font-mono text-[12.5px] text-paper-text leading-[2]"
        >
          {seen.foundAt !== null && (
            <div>
              <span className="inline-block min-w-[11ch] text-paper-quiet">
                found at
              </span>{" "}
              {seen.foundAt}
            </div>
          )}
          {seen.forges.map((forge) => (
            <div key={forge}>
              <span className="inline-block min-w-[11ch] text-paper-quiet">
                {seen.foundAt === null ? "lives at" : "also lives at"}
              </span>{" "}
              {forge}
            </div>
          ))}
          {seen.lastCommit !== null && (
            <div>
              <span className="inline-block min-w-[11ch] text-paper-quiet">
                last commit
              </span>{" "}
              {agoWords(seen.lastCommit.at, now)}
              {seen.lastCommit.subject !== null &&
                ` · "${seen.lastCommit.subject}"`}
            </div>
          )}
        </div>
      </Part>

      <Part name="What you say">
        <div className="my-3.5">
          <FieldHead
            id={ids.wire}
            label="Its wire"
            hint="where it perches; everything else stays on the fence"
          />
          <WirePicker
            labelId={ids.wire}
            wires={options.wires}
            defaultWire={options.defaultWire}
            value={values.wire}
            onChange={(wire) => update({ wire })}
          />
        </div>
        <div className="my-3.5">
          <FieldHead
            id={ids.name}
            label="Goes by"
            hint="leave it and the scanned name stands"
          />
          <input
            type="text"
            aria-labelledby={ids.name}
            aria-describedby={`${ids.name}-hint`}
            placeholder={form.scannedName}
            value={values.name ?? ""}
            onChange={(event) =>
              update({ name: blankAsNull(event.target.value) })
            }
            className={paperInputClass}
          />
        </div>
        <div className="my-3.5">
          <FieldHead
            id={ids.expect}
            label="What it should have"
            hint="an unmet one shows on the bird"
          />
          <fieldset
            aria-labelledby={ids.expect}
            className="m-0 flex flex-wrap gap-2 border-0 p-0"
          >
            {options.expectations.map((name) => (
              <label key={name} className={chipClass}>
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
                {name}{" "}
                <span className="text-[12px] opacity-65">
                  · {expectationWhy[name]}
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </Part>

      <div className="mt-4.5 border-paper-rule border-t">
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls={ids.more}
          onClick={() => setMoreOpen(!moreOpen)}
          className="w-full cursor-pointer py-3 text-left text-[13px] text-paper-quiet focus-visible:outline-2 focus-visible:outline-paper-head focus-visible:outline-offset-1"
        >
          <span
            aria-hidden="true"
            className={`inline-block w-[1.2em] ${moreOpen ? "rotate-90" : ""}`}
          >
            ▸
          </span>
          More particulars · its windows, key files, roadmaps and session
        </button>
        {moreOpen && (
          <div id={ids.more} data-material="paper" className="pb-3.5">
            <FormRow label="Key files" sub="Shown as paper on its page">
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
            <FormRow
              label="Zellij session"
              sub="Blank follows the launch rules"
            >
              <input
                type="text"
                aria-label="Zellij session"
                placeholder={form.defaultSession ?? ""}
                value={values.zellijSession ?? ""}
                onChange={(event) =>
                  update({ zellijSession: blankAsNull(event.target.value) })
                }
                className={`${monoInputClass} max-w-80`}
              />
            </FormRow>
            <p className="mt-3 mb-0 px-0.5 font-semibold text-[13.5px] text-paper-head">
              Its own windows
              <span className="ml-2 font-normal text-[12.5px] text-paper-quiet">
                hours and days before amber and red; blank follows the judgement
                settings
              </span>
            </p>
            {thresholdWindows.map((window) => (
              <FormRow
                key={window.label}
                label={window.label}
                sub={window.unit}
              >
                <ThresholdPair
                  window={window}
                  defaults={options.thresholds}
                  value={values.thresholds}
                  onChange={(thresholds) => update({ thresholds })}
                />
              </FormRow>
            ))}
          </div>
        )}
      </div>

      {holds.map((hold) => (
        <p key={hold} className="mt-1 mb-0 text-[12.5px] text-paper-amber">
          {hold}
        </p>
      ))}
      {problems.map((problem) => (
        <p
          key={problem}
          role="alert"
          className="mt-1 mb-0 text-[12.5px] text-paper-red"
        >
          {problem}
        </p>
      ))}

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3.5 border-paper-rule border-t pt-4">
        {confirming ? (
          <>
            <span className="text-[12.5px] text-paper-quiet">
              Every line of these papers is struck out.
            </span>
            <span className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={linkClass}
              >
                Keep the papers
              </button>
              <button type="button" onClick={onReturn} className={keyClass}>
                Return it to the fence
              </button>
            </span>
          </>
        ) : (
          <>
            <span className="text-[12.5px] text-paper-quiet">
              Signed, the owner
            </span>
            <span className="flex flex-wrap items-center gap-3.5">
              {amending && (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className={linkClass}
                >
                  Return to the fence
                </button>
              )}
              <button type="button" onClick={onClose} className={linkClass}>
                Not now
              </button>
              <button
                type="submit"
                disabled={holds.length > 0}
                className={keyClass}
              >
                {amending
                  ? "Amend the papers"
                  : `Adopt onto ${values.wire ?? options.defaultWire}`}
              </button>
            </span>
          </>
        )}
      </div>
    </form>
  );
}
