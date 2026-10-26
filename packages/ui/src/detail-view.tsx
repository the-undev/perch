// Tier C: a bird's full page. The roost at the top right holds the bird on its perch and its
// bubble; the record beside it opens with the heading, then the launch actions, links out and the
// papers' verb, then the ledger and its sections beside the key files on paper. Only what exists
// is shown. The view fetches nothing: key-file contents, launching and the entry's form and
// writes are the caller's.

import {
  type EntryForm,
  type EntryValues,
  sameEntryValues,
} from "@perch/core/entry-form.ts";
import type { Bird, LaunchAction } from "@perch/core/viewmodel.ts";
import { useState } from "react";
import { actionClass, LaunchActions, LinksOut } from "./actions.tsx";
import { AdoptionPapers } from "./adoption-papers.tsx";
import { DetailHeading } from "./detail-heading.tsx";
import { Icon } from "./icons.tsx";
import {
  BranchLines,
  FlagLines,
  Ledger,
  NewestCommits,
  PullRequestLines,
  SourceProblems,
} from "./ledger.tsx";
import { KeyFilePaper, type KeyFileSheet } from "./paper.tsx";
import { Roost } from "./roost.tsx";
import { isNight, skyPhase } from "./sky.ts";

/** What the detail page needs to adopt its bird or amend its papers. */
export interface EntryControls {
  /** The open bird's entry and the form's choices; null until read, when no control shows. */
  form: EntryForm | null;
  /** Writes the bird's entry, adopting it when it has none. */
  onSave: (birdId: string, values: EntryValues) => void;
  /** Removes the bird's entry, returning it to the fence. */
  onRemove: (birdId: string) => void;
}

export interface DetailViewProps {
  bird: Bird;
  /** The render's clock: ages are measured to it, and at night a sleeping bird sleeps on its perch and speaks woken. */
  now: Date;
  onLaunch: (action: LaunchAction) => void;
  /** The bird's key files with what was read from each; empty until the caller has read them. */
  sheets: KeyFileSheet[];
  /** Adopting the bird or amending its papers. */
  entry: EntryControls;
  /** The main process's problems, a refused write among them, which the strip under the heading or open papers show. */
  problems: string[];
  /** The papers unfold as the page opens, and again whenever this turns true. */
  openPapers: boolean;
}

/** What was signed and is not yet in the entry read back: the values written, or the return. */
type Signed = { kind: "values"; values: EntryValues } | { kind: "return" };

/** Whether the entry read back shows what was signed. */
function landed(signed: Signed, form: EntryForm): boolean {
  if (signed.kind === "return") return form.values === null;
  return form.values !== null && sameEntryValues(form.values, signed.values);
}

/**
 * The papers' verb and, once pressed, the papers: Adopt for a fence bird, The papers for an
 * adopted one. Signed papers stay open until the entry read back shows the write, so a refused
 * one keeps them open with the reason. Nothing shows until the form is read and agrees with the
 * bird.
 */
function EntryPart({
  bird,
  entry,
  now,
  problems,
  open,
  setOpen,
}: {
  bird: Bird;
  entry: EntryControls;
  now: Date;
  problems: string[];
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [signed, setSigned] = useState<Signed | null>(null);
  const { form } = entry;
  if (signed !== null && form !== null && landed(signed, form)) {
    setSigned(null);
    setOpen(false);
  }
  if (form === null || (form.values !== null) !== bird.adopted) return null;
  const close = () => {
    setSigned(null);
    setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={`${actionClass} ${open ? "border-edge bg-panel text-ink" : ""}`}
      >
        <Icon name={form.values === null ? "adopt" : "edit"} size={15} />
        {form.values === null ? "Adopt" : "The papers"}
      </button>
      {open && (
        <div className="mt-3.5 basis-full">
          <AdoptionPapers
            bird={bird}
            form={form}
            night={isNight(skyPhase(now))}
            now={now}
            problems={problems}
            onSign={(values) => {
              setSigned({ kind: "values", values });
              entry.onSave(bird.id, values);
            }}
            onReturn={() => {
              setSigned({ kind: "return" });
              entry.onRemove(bird.id);
            }}
            onClose={close}
          />
        </div>
      )}
    </>
  );
}

/**
 * The main process's problems, a failed launch or a refused write, under the heading in the
 * sky's notice voice. Open papers carry the same lines beside the signature, so the strip
 * stands down while they show.
 */
function MainProblems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <div
      data-part="problems"
      role="alert"
      className="mt-3 max-w-[90ch] text-[12px] leading-normal"
    >
      {problems.map((problem) => (
        <p key={problem} className="m-0 text-amber">
          {problem}
        </p>
      ))}
    </div>
  );
}

/**
 * The whole project page, centred as one block: the roost beside the record when wide, above it and
 * centred when narrow, and the ledger beside the paper when the record is wide enough.
 */
export function DetailView({
  bird,
  now,
  onLaunch,
  sheets,
  entry,
  problems,
  openPapers,
}: DetailViewProps) {
  const { detail } = bird;
  const [open, setOpen] = useState(openPapers);
  const [asked, setAsked] = useState(openPapers);
  if (openPapers !== asked) {
    setAsked(openPapers);
    if (openPapers) setOpen(true);
  }
  const papersShown =
    open &&
    entry.form !== null &&
    (entry.form.values !== null) === bird.adopted;
  const night = isNight(skyPhase(now));
  return (
    <article
      aria-label={`${bird.name} in full`}
      className="@container mx-auto max-w-480 motion-safe:animate-swap"
    >
      <div className="grid grid-cols-1 items-start gap-x-9 gap-y-3 @min-[860px]:grid-cols-[minmax(0,1fr)_330px] @min-[1240px]:grid-cols-[minmax(0,1fr)_620px]">
        <div className="mx-auto w-82.5 max-w-full @min-[860px]:col-start-2 @min-[860px]:row-start-1 @min-[860px]:mx-0 @min-[1240px]:w-155">
          <Roost bird={bird} night={night} />
        </div>
        <div
          data-part="record"
          className="@container min-w-0 @min-[860px]:col-start-1 @min-[860px]:row-start-1"
        >
          <DetailHeading bird={bird} />
          {!papersShown && <MainProblems problems={problems} />}
          <div className="mt-3.5 flex flex-wrap items-center gap-1">
            <LaunchActions actions={detail.actions} onLaunch={onLaunch} />
            <LinksOut links={detail.links} />
            <EntryPart
              bird={bird}
              entry={entry}
              now={now}
              problems={problems}
              open={open}
              setOpen={setOpen}
            />
          </div>
          <div className="mt-4 grid items-start gap-10 @min-[960px]:grid-cols-[minmax(330px,430px)_minmax(0,1fr)]">
            <div className="min-w-0">
              <Ledger entries={detail.ledger} now={now} />
              {detail.branches.length > 0 && (
                <BranchLines branches={detail.branches} now={now} />
              )}
              {detail.newestCommits.map((commits) => (
                <NewestCommits
                  key={commits.forge}
                  commits={commits}
                  now={now}
                />
              ))}
              {detail.pullRequests.length > 0 && (
                <PullRequestLines
                  pullRequests={detail.pullRequests}
                  now={now}
                />
              )}
              {detail.flags.length > 0 && <FlagLines flags={detail.flags} />}
              {detail.problems.length > 0 && (
                <SourceProblems problems={detail.problems} />
              )}
            </div>
            <KeyFilePaper sheets={sheets} />
          </div>
        </div>
      </div>
    </article>
  );
}
