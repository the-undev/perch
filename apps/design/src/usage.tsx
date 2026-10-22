// The parts every usage page is made of: sections of labelled states, each with the rule behind
// it, sky plates to stand birds on, and the usage note with the props.

import type { SkyPhase } from "@perch/ui/sky.ts";
import type { ReactNode } from "react";

export interface SectionProps {
  title: string;
  /** The rule this section shows, in the field guide's wording. */
  rule: ReactNode;
  /** The narrowest a column of specimens may get, in pixels; wider windows flow to more columns. */
  min: number;
  children: ReactNode;
}

/** A group of states that share a rule, flowing into as many columns as the window allows. */
export function Section({ title, rule, min, children }: SectionProps) {
  return (
    <section className="mt-11">
      <h2 className="m-0 font-bold font-display text-[20px]">{title}</h2>
      <p className="mt-1 mb-4 max-w-[76ch] text-[13.5px] text-ink-muted leading-relaxed">
        {rule}
      </p>
      <div
        className="grid items-start gap-x-6 gap-y-7"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`,
        }}
      >
        {children}
      </div>
    </section>
  );
}

export interface SpecimenProps {
  /** The state shown, in a few words. */
  label: string;
  /** Why it looks like this: the fact or rule behind the state. */
  rule: ReactNode;
  children: ReactNode;
}

/** One state of a component, rendered, with its label and rule beneath. */
export function Specimen({ label, rule, children }: SpecimenProps) {
  return (
    <figure className="m-0 min-w-0">
      <div className="min-w-0">{children}</div>
      <figcaption className="mt-2.5">
        <div className="font-semibold text-[13.5px] text-ink">{label}</div>
        <div className="mt-0.5 max-w-[60ch] text-[12.5px] text-ink-faint leading-normal">
          {rule}
        </div>
      </figcaption>
    </figure>
  );
}

/** A piece of sky at one phase, holding whatever stands on it, centred. */
export function Plate({
  phase,
  children,
}: {
  phase: SkyPhase;
  children: ReactNode;
}) {
  return (
    <div
      data-phase={phase}
      className="flex min-h-40 items-end justify-center overflow-hidden rounded-xl border border-edge px-4 pt-6 pb-3"
      style={{
        background:
          "linear-gradient(var(--color-sky-top), var(--color-sky-low) 78%, var(--color-horizon))",
      }}
    >
      {children}
    </div>
  );
}

/** A dark panel for specimens that sit on the ground rather than the sky. */
export function Ground({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-edge bg-ground px-5 py-4">
      {children}
    </div>
  );
}

export interface PropRow {
  name: string;
  type: string;
  what: string;
}

export interface UsageProps {
  /** The component as it is written in code, for the heading. */
  component: string;
  props: PropRow[];
  /** Where the data comes from and how to place the component. */
  children: ReactNode;
}

/** The usage note: the props, and where their values come from. */
export function Usage({ component, props, children }: UsageProps) {
  return (
    <section className="mt-14 max-w-[1100px] rounded-xl border border-edge bg-band px-6 py-5">
      <h2 className="m-0 font-bold font-display text-[18px]">
        Usage: <code className="font-mono text-[15px]">{component}</code>
      </h2>
      <div className="mt-2 max-w-[76ch] space-y-2 text-[13.5px] text-ink-muted leading-relaxed">
        {children}
      </div>
      <table className="mt-4 w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-ink-faint">
            <th className="w-44 py-1.5 pr-4 font-semibold">Prop</th>
            <th className="w-80 py-1.5 pr-4 font-semibold">Type</th>
            <th className="py-1.5 font-semibold">What it is</th>
          </tr>
        </thead>
        <tbody>
          {props.map((prop) => (
            <tr key={prop.name} className="border-edge border-t align-top">
              <td className="py-2 pr-4 font-mono text-[12.5px] text-ink">
                {prop.name}
              </td>
              <td className="py-2 pr-4 font-mono text-[12.5px] text-ink-accent">
                {prop.type}
              </td>
              <td className="py-2 text-ink-muted">{prop.what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Inline code in a usage note. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-edge bg-black/25 px-1.5 py-px font-mono text-[12px]">
      {children}
    </code>
  );
}

export interface ChoiceProps<T extends string> {
  /** What the choice sets, for assistive technology and as its visible label. */
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** A row of pills, one of them on: the scene pages' switchers. */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChoiceProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-[12.5px] text-ink-faint">{label}</span>
      <fieldset
        aria-label={label}
        className="m-0 flex flex-wrap gap-1 rounded-full border border-edge bg-band p-0.75"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={
              option.value === value
                ? "cursor-pointer rounded-full bg-panel-hi px-3.5 py-1.25 font-semibold text-[12.5px] text-ink"
                : "cursor-pointer rounded-full px-3.5 py-1.25 font-semibold text-[12.5px] text-ink-muted hover:text-ink"
            }
          >
            {option.label}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/** A window-sized frame for a whole scene: the app's own view, embedded in the page. */
export function SceneFrame({
  height,
  children,
}: {
  /** The frame's height as a CSS length. */
  height: string;
  children: ReactNode;
}) {
  return (
    <div
      className="mt-4 overflow-hidden rounded-xl border border-edge"
      style={{ height }}
    >
      {children}
    </div>
  );
}

/** A quiet line showing what the scene's callbacks last reported. */
export function Pressed({ text }: { text: string }) {
  return (
    <p className="mt-3 mb-0 text-[13px] text-ink-faint">
      Last called back: <span className="text-ink-muted">{text}</span>
    </p>
  );
}
