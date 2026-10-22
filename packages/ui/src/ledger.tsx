// Tier C's ruled ledger: facts in full words, then the sections beneath it (branches, newest
// commits, pull requests, flags, unread sources). Every row is a label on the left and a value on
// the right; clean zeros read a quiet green "none", counts take their severity's tone.

import type {
  BranchLine,
  FlagLine,
  ForgeCommits,
  LedgerEntry,
  PullRequestLine,
  SourceProblem,
  Tone,
} from "@perch/core/viewmodel.ts";
import type { ReactNode } from "react";
import { agoWords } from "./time.ts";

const forgeLabel = { github: "GitHub", forgejo: "Forgejo" } as const;

/** A value's ink by tone: green for a clean zero or a good state, amber and red by severity. */
export const toneClass: Record<NonNullable<Tone> | "none", string> = {
  green: "text-green opacity-90",
  amber: "text-amber",
  red: "text-red",
  none: "text-ink-faint",
};

/** A link out of the app, dotted until hovered. */
export function OutLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-inherit underline decoration-ink-faint decoration-dotted underline-offset-3 hover:text-ink hover:decoration-ink-accent"
    >
      {children}
    </a>
  );
}

/** One ruled row: the label and its value, the value toned. */
export function LedgerRow({
  label,
  value,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  tone: Tone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-edge border-t px-0.5 py-2.25 first:border-t-0">
      <span className="min-w-0">{label}</span>
      <span
        data-tone={tone ?? "none"}
        className={`whitespace-nowrap text-[13px] tabular-nums ${toneClass[tone ?? "none"]}`}
      >
        {value}
      </span>
    </div>
  );
}

/** A section's heading: the actual thing, never a concept. */
export function LedgerHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6.5 mb-0.5 font-body font-semibold text-[13.5px] text-ink-faint">
      {children}
    </h3>
  );
}

/** A second line under a row's label. */
function Sub({ children }: { children: ReactNode }) {
  return <span className="block text-[12.5px] text-ink-faint">{children}</span>;
}

function entryValue(entry: LedgerEntry, now: Date): ReactNode {
  switch (entry.kind) {
    case "count":
      return entry.text;
    case "state":
      return entry.url === null ? (
        entry.text
      ) : (
        <OutLink href={entry.url}>{entry.text}</OutLink>
      );
    case "time":
      return agoWords(entry.at, now);
  }
}

export interface LedgerProps {
  entries: LedgerEntry[];
  /** The moment times are measured to: the render's clock, passed in. */
  now: Date;
}

/** The facts that exist for a bird, in full words. */
export function Ledger({ entries, now }: LedgerProps) {
  return (
    <div data-part="ledger">
      {entries.map((entry) => (
        <LedgerRow
          key={entry.label}
          label={entry.label}
          value={entryValue(entry, now)}
          tone={entry.kind === "time" ? null : entry.tone}
        />
      ))}
    </div>
  );
}

/** The local branches, the checked-out one first, each with its newest commit. */
export function BranchLines({
  branches,
  now,
}: {
  branches: BranchLine[];
  now: Date;
}) {
  return (
    <section>
      <LedgerHeading>Branches</LedgerHeading>
      {branches.map((branch) => (
        <LedgerRow
          key={branch.name}
          label={
            <>
              <b className="font-semibold">
                {branch.url === null ? (
                  branch.name
                ) : (
                  <OutLink href={branch.url}>{branch.name}</OutLink>
                )}
              </b>
              {branch.current && (
                <span className="ml-2 text-[12px] text-ink-accent">
                  checked out
                </span>
              )}
              {branch.isDefault && (
                <span className="ml-2 text-[12px] text-ink-faint">default</span>
              )}
              <Sub>{branch.subject}</Sub>
            </>
          }
          value={agoWords(branch.lastCommitAt, now)}
          tone={null}
        />
      ))}
    </section>
  );
}

/** One forge's default branch, headed by its name on the forge, with its newest commits. */
export function NewestCommits({
  commits,
  now,
}: {
  commits: ForgeCommits;
  now: Date;
}) {
  return (
    <section>
      <LedgerHeading>
        <OutLink href={commits.branchUrl}>{commits.heading}</OutLink>, newest
        commits
      </LedgerHeading>
      {commits.commits.map((commit) => (
        <LedgerRow
          key={commit.sha}
          label={commit.subject}
          value={
            <>
              <OutLink href={commit.url}>
                <code className="font-mono text-[12px]">{commit.shortSha}</code>
              </OutLink>
              {` · ${agoWords(commit.committedAt, now)}`}
            </>
          }
          tone={null}
        />
      ))}
    </section>
  );
}

/** Open pull requests on every forge, the most recently updated first. */
export function PullRequestLines({
  pullRequests,
  now,
}: {
  pullRequests: PullRequestLine[];
  now: Date;
}) {
  return (
    <section>
      <LedgerHeading>Open pull requests</LedgerHeading>
      {pullRequests.map((pull) => (
        <LedgerRow
          key={`${pull.forge}-${pull.number}`}
          label={
            <>
              <OutLink href={pull.url}>{pull.title}</OutLink>
              <Sub>
                #{pull.number} on {forgeLabel[pull.forge]}
                {pull.author === null ? "" : `, by ${pull.author}`}
                {pull.draft ? ", draft" : ""}
              </Sub>
            </>
          }
          value={agoWords(pull.updatedAt, now)}
          tone={null}
        />
      ))}
    </section>
  );
}

/** Facts the scan raised about the bird itself, toned by their level. */
export function FlagLines({ flags }: { flags: FlagLine[] }) {
  return (
    <section>
      <LedgerHeading>Flags</LedgerHeading>
      {flags.map((flag) => (
        <LedgerRow
          key={flag.flag}
          label={flag.detail}
          value={flag.text}
          tone={flag.level}
        />
      ))}
    </section>
  );
}

/** Sources that could not be read for this bird; their previous results stand. */
export function SourceProblems({ problems }: { problems: SourceProblem[] }) {
  return (
    <section>
      <LedgerHeading>Sources not read</LedgerHeading>
      {problems.map((problem) => (
        <LedgerRow
          key={problem.source}
          label={
            <>
              {problem.source}
              <Sub>{problem.error}</Sub>
            </>
          }
          value="not read"
          tone="amber"
        />
      ))}
    </section>
  );
}
