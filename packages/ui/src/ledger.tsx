// Tier C's ruled ledger: facts in full words, then the sections beneath it (branches, the commit
// history, pull requests, flags, the sources that couldn't be read). Every row is a label on the left and a value on
// the right; clean zeros read a quiet green "none", counts take their severity's tone. A row that
// holds a bubble chip's reading is marked with a dot and spells it out beneath, source by source.

import type {
  BranchLine,
  ChipKind,
  FlagLine,
  HeldOnTone,
  History,
  HistoryCommit,
  LedgerFact,
  PullRequestLine,
  Reading,
  SheetLine,
  SourceProblem,
  Tone,
} from "@perch/core/viewmodel.ts";
import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
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

function factValue(fact: LedgerFact, now: Date): ReactNode {
  switch (fact.kind) {
    case "count":
      return fact.text;
    case "state":
      return fact.url === null ? (
        fact.text
      ) : (
        <OutLink href={fact.url}>{fact.text}</OutLink>
      );
    case "time":
      return agoWords(fact.at, now);
  }
}

/** A reading's ink: its tone, else the muted ink that reads beside the faint source. */
const readingToneClass: Record<NonNullable<Tone> | "none", string> = {
  ...toneClass,
  none: "text-ink-muted",
};

/** Components that keep a bug title one inline run: no paragraph, and links and images as plain text. */
const titleComponents: Components = {
  p: ({ children }) => <>{children}</>,
  a: ({ children }) => <span>{children}</span>,
  img: ({ alt }) => <span>{alt}</span>,
  code: ({ children }) => (
    <code className="rounded-sm bg-ink-faint/15 px-1">{children}</code>
  ),
};

/** A bug title with its inline markdown rendered. */
function BugTitle({ title }: { title: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={titleComponents}
      allowedElements={["p", "em", "strong", "del", "code", "a", "img"]}
      unwrapDisallowed
    >
      {title}
    </Markdown>
  );
}

/** What a reading says: a button showing its line on the sheet, a link out, or plain words. */
function ReadingText({
  reading,
  onReveal,
}: {
  reading: Reading;
  onReveal: (line: SheetLine) => void;
}) {
  const { reveal } = reading;
  if (reveal !== null) {
    return (
      <button
        type="button"
        data-part="reveal"
        onClick={() => onReveal(reveal)}
        className="cursor-pointer text-left text-inherit underline decoration-ink-faint decoration-dotted underline-offset-3 hover:text-ink hover:decoration-ink-accent focus-visible:outline-2 focus-visible:outline-ink-accent"
      >
        <BugTitle title={reading.text} />
      </button>
    );
  }
  if (reading.url === null) return reading.text;
  return <OutLink href={reading.url}>{reading.text}</OutLink>;
}

/** One source's part in a row, in mono: the source, what it says there, toned and linked, and its age. */
function ReadingLine({
  reading,
  now,
  onReveal,
}: {
  reading: Reading;
  now: Date;
  onReveal: (line: SheetLine) => void;
}) {
  return (
    <li data-part="reading" className="break-words">
      {reading.source}
      {" · "}
      <span
        data-reading-tone={reading.tone ?? "none"}
        className={readingToneClass[reading.tone ?? "none"]}
      >
        <ReadingText reading={reading} onReveal={onReveal} />
      </span>
      {reading.at === null ? "" : ` · ${agoWords(reading.at, now)}`}
    </li>
  );
}

/** The mark before a label whose row holds a bubble chip's reading. */
function HandleMark() {
  return (
    <span
      aria-hidden="true"
      data-part="handle-mark"
      className="mr-2 inline-block size-1.75 rounded-full bg-ink-accent align-[1px]"
    />
  );
}

/** A chip pressed on the roost: the row to mark, and the press's number, so a second press marks it again. */
export interface Landing {
  chip: ChipKind;
  press: number;
}

/** The landing scroll; the DOM lib's options lack `container`, which Chromium 156 supports. */
export const landingScroll: ScrollIntoViewOptions & { container: "nearest" } = {
  block: "center",
  behavior: "instant",
  container: "nearest",
};

/** The brief mark on the row a chip landed on, behind its words; drawn afresh for each press. */
export function LandingMark() {
  return (
    <span
      aria-hidden="true"
      data-part="landing"
      className="pointer-events-none absolute -inset-x-2.5 inset-y-0 -z-10 animate-land rounded-md bg-panel-hi opacity-0 ring-1 ring-ink-accent"
    />
  );
}

/** A row of the ledger proper: the label and value, with the row's reading beneath, source by source. */
function FactRow({
  fact,
  now,
  landing,
  onReveal,
}: {
  fact: LedgerFact;
  now: Date;
  landing: Landing | null;
  onReveal: (line: SheetLine) => void;
}) {
  const tone = fact.kind === "time" ? null : fact.tone;
  const chip = fact.kind === "time" ? null : fact.chip;
  const readings = fact.kind === "time" ? [] : fact.readings;
  const landed = chip !== null && landing !== null && landing.chip === chip;
  return (
    <div
      data-part="ledger-fact"
      data-chip={chip ?? undefined}
      className="relative isolate border-edge border-t px-0.5 first-of-type:border-t-0"
    >
      {landed && <LandingMark key={`mark-${landing.press}`} />}
      <div className="flex items-baseline justify-between gap-4 py-2.25">
        <span className="min-w-0">
          {chip !== null && <HandleMark />}
          {fact.label}
        </span>
        <span
          data-tone={tone ?? "none"}
          className={`whitespace-nowrap text-[13px] tabular-nums ${toneClass[tone ?? "none"]}`}
        >
          {factValue(fact, now)}
        </span>
      </div>
      {readings.length > 0 && (
        <ul
          key={landed ? `ink-${landing.press}` : "ink-resting"}
          data-part="readings"
          className={`m-0 -mt-1 list-none space-y-0.5 p-0 pb-2.25 font-mono text-[12px] text-ink-faint leading-normal ${landed ? "animate-land-ink" : ""}`}
        >
          {readings.map((reading) => (
            <ReadingLine
              key={`${reading.source} ${reading.reveal?.line ?? reading.text}`}
              reading={reading}
              now={now}
              onReveal={onReveal}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export interface LedgerProps {
  /** The sentence that opens the ledger when nothing waits; null when something does. */
  quiet: string | null;
  facts: LedgerFact[];
  /** The moment times are measured to: the render's clock, passed in. */
  now: Date;
  /** The chip last pressed on the roost, whose row is briefly marked; null when none has been. */
  landing: Landing | null;
  /** A reading's line in a key file was pressed: show it on the sheet. */
  onReveal: (line: SheetLine) => void;
}

/** The facts that exist for a bird, in full words, each chip's reading spelled out on its row. */
export function Ledger({ quiet, facts, now, landing, onReveal }: LedgerProps) {
  return (
    <div data-part="ledger">
      {quiet !== null && (
        <p
          data-part="quiet"
          className="m-0 pb-1.5 text-[12.5px] text-ink-faint"
        >
          {quiet}
        </p>
      )}
      {facts.map((fact) => (
        <FactRow
          key={fact.label}
          fact={fact}
          now={now}
          landing={landing}
          onReveal={onReveal}
        />
      ))}
    </div>
  );
}

/** The local branches, the checked-out one first, each with its newest commit. */
export function BranchLines({
  branches,
  now,
  chip,
  landing,
}: {
  branches: BranchLine[];
  now: Date;
  /** The bubble chip whose reading the section holds, null when the bubble carries none. */
  chip: ChipKind | null;
  landing: Landing | null;
}) {
  const landed = chip !== null && landing !== null && landing.chip === chip;
  return (
    <section
      data-part="branches"
      data-chip={chip ?? undefined}
      className="relative isolate"
    >
      {landed && <LandingMark key={`mark-${landing.press}`} />}
      <LedgerHeading>
        {chip !== null && <HandleMark />}
        Branches
      </LedgerHeading>
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

/** Green or amber by which forges hold the commit, and the quietest faint dot for a bird with no forge. */
const heldOnDotClass: Record<NonNullable<HeldOnTone> | "none", string> = {
  green: "size-1.75 bg-green",
  amber: "size-1.75 bg-amber",
  none: "size-0.75 bg-edge-hi",
};

/** A commit's one dot, its holders spoken for a screen reader and on hover. */
function HeldOnDot({ commit }: { commit: HistoryCommit }) {
  const tone = commit.tone ?? "none";
  return (
    <span
      role="img"
      aria-label={commit.heldOn}
      title={commit.heldOn}
      data-held-on-tone={tone}
      className="inline-flex size-1.75 items-center justify-center self-center"
    >
      <span className={`rounded-full ${heldOnDotClass[tone]}`} />
    </span>
  );
}

/** A line in amber above the commits: a forge that couldn't be read, or the divergence. */
function HistoryLine({ part, text }: { part: string; text: string }) {
  return (
    <p data-part={part} className="m-0 mt-1.5 text-[12.5px] text-amber">
      {text}
    </p>
  );
}

/** The heading names the branch the history judges, when one does. */
function historyHeading(branch: string | null): string {
  return branch === null
    ? "Commits, and where each has reached"
    : `Commits on ${branch}, and where each has reached`;
}

/** The newest commits on the default branch, each once, a dot before each saying which forges hold it. */
export function CommitHistory({
  history,
  now,
}: {
  history: History;
  now: Date;
}) {
  return (
    <section data-part="history">
      <LedgerHeading>{historyHeading(history.branch)}</LedgerHeading>
      {history.notes.map((note) => (
        <HistoryLine key={note} part="history-note" text={note} />
      ))}
      {history.divergence !== null && (
        <HistoryLine part="divergence" text={history.divergence} />
      )}
      <ul className="m-0 mt-1 grid list-none grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2.5 p-0">
        {history.commits.map((commit) => (
          <li
            key={commit.sha}
            data-part="history-commit"
            className="col-span-full grid grid-cols-subgrid items-baseline py-0.75 font-mono text-[12.5px]"
          >
            <HeldOnDot commit={commit} />
            <span className="truncate text-ink-muted" title={commit.subject}>
              {commit.url === null ? (
                commit.subject
              ) : (
                <OutLink href={commit.url}>{commit.subject}</OutLink>
              )}
            </span>
            <span className="whitespace-nowrap text-right text-[11.5px] text-ink-faint">
              {agoWords(commit.committedAt, now)}
            </span>
          </li>
        ))}
      </ul>
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
      <LedgerHeading>What couldn't be read</LedgerHeading>
      {problems.map((problem) => (
        <LedgerRow
          key={problem.source}
          label={
            <>
              {problem.source}
              <Sub>{problem.error}</Sub>
            </>
          }
          value="couldn't read"
          tone="amber"
        />
      ))}
    </section>
  );
}
