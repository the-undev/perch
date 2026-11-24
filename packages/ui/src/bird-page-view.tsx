// Tier C: a bird's full page, a fixed stage. The band at the top is one row: the heading (the name,
// the meta line with the launch actions, the snooze control, links out and papers' verb beside it,
// then a notice for each remote no card can read and the main process's problems), the roost's
// bubble at its reading width, and the bird sitting on its perch at the right. It never scrolls.
// Beneath it the ground holds two panes that each scroll their own contents: the record (the ledger
// and its sections) and the key files on paper, or for a bird with no local repository here the
// slip saying so; in a narrow page they join into one pane, the sheets at the end. The adoption
// papers rise as a sheet over both panes, which dim and go inert while the band stays live. A chip
// pressed in the roost's bubble lands on the ledger row holding its reading, or the can't-read chip
// on the notice, as does the chip pressed in the aviary's bubble that brought the camera here. A
// bug line pressed in the ledger opens its file on the sheet at that line. Only what exists is
// shown. The view fetches nothing: key-file contents, launching, the clipboard and the papers' form
// and writes are the caller's.

import {
  type PapersForm,
  type PapersValues,
  samePapersValues,
} from "@perch/core/papers-form.ts";
import type {
  Bird,
  ChipKind,
  LaunchAction,
  RemoteNotice,
  SheetLine,
} from "@perch/core/viewmodel.ts";
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { actionClass, LaunchActions, LinksOut } from "./actions.tsx";
import { AdoptionPapers } from "./adoption-papers.tsx";
import { birdLook } from "./bird.tsx";
import { BirdPageHeading } from "./bird-page-heading.tsx";
import { Icon } from "./icons.tsx";
import {
  type KeyFileSheet,
  KeyFileSheets,
  type Reveal,
} from "./key-file-sheets.tsx";
import {
  BranchLines,
  CommitHistory,
  FlagLines,
  type Landing,
  LandingMark,
  Ledger,
  landingScroll,
  PullRequestLines,
  SourceProblems,
} from "./ledger.tsx";
import {
  NoLocalRepositoryClause,
  NoLocalRepositorySlip,
} from "./no-local-repository-slip.tsx";
import { RisingSheet } from "./rising-sheet.tsx";
import { Roost } from "./roost.tsx";
import { SnoozeAction, type SnoozeCalls } from "./snooze-action.tsx";

/** What the bird's page needs to adopt its bird or amend its papers. */
export interface PapersControls {
  /** The open bird's papers and the form's choices; null until read, when no control shows. */
  form: PapersForm | null;
  /** Writes the bird's papers, adopting it when it has none. */
  onSave: (birdId: string, values: PapersValues) => void;
  /** Removes the bird's papers, returning it to the fence. */
  onRemove: (birdId: string) => void;
}

export interface BirdPageViewProps {
  bird: Bird;
  /** The render's clock: ages are measured to it, and the bird's look follows the hour. */
  now: Date;
  onLaunch: (action: LaunchAction) => void;
  /** The page's snooze or wake verb was pressed. */
  snooze: SnoozeCalls;
  /** The bird's key files with what was read from each; empty until the caller has read them. */
  sheets: KeyFileSheet[];
  /** Adopting the bird or amending its papers. */
  papers: PapersControls;
  /** The main process's problems, a refused write among them, which the strip under the heading or open papers show. */
  problems: string[];
  /** The papers unfold as the page opens, and again whenever this turns true. */
  openPapers: boolean;
  /** The chip pressed in the aviary's bubble that brought the camera here: landed on as the page mounts and whenever it changes; null for none. */
  arrivalChip: ChipKind | null;
  /** A notice's Sources was pressed: open the settings page. */
  onSettings: () => void;
  /** The no-local-repository slip's Open Sources was pressed: open the settings page on Sources, the local cards unfolded. */
  onLocalSources: () => void;
  /** Puts the slip's SSH address on the clipboard, settling once it is there. */
  onCopy: (text: string) => Promise<void>;
  /** The camera is panning the ground between birds' pages: a page mounted during it skips its swap. */
  panning: boolean;
}

/** What was signed and is not yet in the papers read back: the values written, or the return. */
type Signed = { kind: "values"; values: PapersValues } | { kind: "return" };

/** Whether the papers read back show what was signed. */
function landed(signed: Signed, form: PapersForm): boolean {
  if (signed.kind === "return") return form.values === null;
  return form.values !== null && samePapersValues(form.values, signed.values);
}

/** The papers' verb: Adopt for a fence bird, The papers for an adopted one. */
function PapersVerb({
  adopt,
  open,
  onPress,
}: {
  adopt: boolean;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onPress}
      className={`${actionClass} ${open ? "border-edge bg-panel text-ink" : ""}`}
    >
      <Icon name={adopt ? "adopt" : "edit"} size={15} />
      {adopt ? "Adopt" : "The papers"}
    </button>
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
 * Each remote no card can read, one amber sentence under the heading in the same voice, its fix
 * ending on Sources, which opens the settings page. The can't-read chip lands here.
 */
function RemoteNotices({
  notices,
  landing,
  onSettings,
}: {
  notices: RemoteNotice[];
  landing: Landing | null;
  onSettings: () => void;
}) {
  if (notices.length === 0) return null;
  const landed = landing !== null && landing.chip === "unreadable";
  return (
    <div
      data-part="notices"
      data-chip="unreadable"
      className="relative isolate mt-3 max-w-[90ch] text-[12.5px] leading-normal"
    >
      {landed && <LandingMark key={`mark-${landing.press}`} />}
      {notices.map((notice) => (
        <p key={notice.text} className="m-0 text-amber">
          {notice.text} {notice.fix}{" "}
          <button
            type="button"
            onClick={onSettings}
            className="cursor-pointer text-amber underline decoration-dotted underline-offset-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-ink-accent"
          >
            Sources
          </button>
          .
        </p>
      ))}
    </div>
  );
}

/** Scrolls the element holding a chip's reading to the middle of its own pane. */
function scrollToChip(article: HTMLElement | null, chip: ChipKind) {
  article
    ?.querySelector(`[data-chip="${chip}"]`)
    ?.scrollIntoView(landingScroll);
}

/** The panes' shared grain: each scrolls its own contents, keeping room at its sides for a landing mark. */
const paneClass =
  "pane-scroll min-h-0 min-w-0 px-2.5 @min-[960px]:overflow-x-hidden @min-[960px]:overflow-y-auto @min-[960px]:pb-11";

/**
 * The whole project page as a fixed stage, centred as one block. The band at the top holds still:
 * from 860px one row, the heading taking what the roost leaves and the roost only as wide as its
 * bubble and bird need; narrower, the roost beneath the heading in a centred column. Beneath it the record
 * pane and the sheets pane each scroll their own contents when the page is wide enough; narrower,
 * they join into one pane, the key files at the record's end. It fills a flex column.
 */
export function BirdPageView({
  bird,
  now,
  onLaunch,
  snooze,
  sheets,
  papers,
  problems,
  openPapers,
  arrivalChip,
  onSettings,
  onLocalSources,
  onCopy,
  panning,
}: BirdPageViewProps) {
  const { page } = bird;
  const [open, setOpen] = useState(openPapers);
  const [asked, setAsked] = useState(openPapers);
  if (openPapers !== asked) {
    setAsked(openPapers);
    if (openPapers) setOpen(true);
  }
  // Signed papers stay open until the papers read back show the write, so a refused one keeps them
  // open with the reason.
  const [signed, setSigned] = useState<Signed | null>(null);
  const { form } = papers;
  if (signed !== null && form !== null && landed(signed, form)) {
    setSigned(null);
    setOpen(false);
  }
  // Neither the verb nor the papers show until the form is read and agrees with the bird.
  const agreed =
    form !== null && (form.values !== null) === bird.adopted ? form : null;
  const papersShown = open && agreed !== null;
  const close = () => {
    setSigned(null);
    setOpen(false);
  };
  const articleRef = useRef<HTMLElement>(null);
  // The chip that brought the camera here is marked in the page's first commit, and again whenever
  // another arrives.
  const [landing, setLanding] = useState<Landing | null>(
    arrivalChip === null ? null : { chip: arrivalChip, press: 1 },
  );
  const [arrived, setArrived] = useState(arrivalChip);
  if (arrivalChip !== arrived) {
    setArrived(arrivalChip);
    if (arrivalChip !== null) {
      setLanding((last) => ({
        chip: arrivalChip,
        press: (last?.press ?? 0) + 1,
      }));
    }
  }
  // The ground gives the page its final size as it mounts, so the arrival's row scrolls once the
  // page commits, before it paints.
  useLayoutEffect(() => {
    if (arrivalChip === null) return;
    scrollToChip(articleRef.current, arrivalChip);
  }, [arrivalChip]);
  // A press commits its mark before the scroll, so the row never paints unlit; flushSync is allowed
  // in the press's handler.
  const pressChip = (chip: ChipKind) => {
    flushSync(() => {
      setLanding((last) => ({ chip, press: (last?.press ?? 0) + 1 }));
    });
    scrollToChip(articleRef.current, chip);
  };
  // A bug line pressed in the ledger shows its line on the sheet.
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const revealLine = (at: SheetLine) =>
    setReveal((last) => ({ at, press: (last?.press ?? 0) + 1 }));
  const [swaps] = useState(!panning);
  return (
    <article
      ref={articleRef}
      aria-label={`${bird.name} in full`}
      className={`@container mx-auto grid min-h-0 w-full max-w-480 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-y-4 overflow-y-clip ${swaps ? "motion-safe:animate-swap" : ""}`}
    >
      <div
        data-part="band"
        className="col-start-1 row-start-1 flex flex-col gap-y-3 @min-[860px]:flex-row @min-[860px]:items-start @min-[860px]:gap-x-9"
      >
        <div
          data-part="heading"
          className="min-w-0 @min-[860px]:flex-[1_1_22rem]"
        >
          <BirdPageHeading
            bird={bird}
            now={now}
            actions={
              <div
                data-part="actions"
                className="flex flex-wrap items-center gap-1"
              >
                {page.noLocalRepository?.onMetaLine && (
                  <NoLocalRepositoryClause />
                )}
                <LaunchActions actions={page.actions} onLaunch={onLaunch} />
                <SnoozeAction
                  bird={bird}
                  look={birdLook(bird, now)}
                  place="page"
                  calls={snooze}
                />
                <LinksOut links={page.links} />
                {agreed !== null && (
                  <PapersVerb
                    adopt={agreed.values === null}
                    open={papersShown}
                    onPress={papersShown ? close : () => setOpen(true)}
                  />
                )}
              </div>
            }
          />
          <RemoteNotices
            notices={page.notices}
            landing={landing}
            onSettings={onSettings}
          />
          {!papersShown && <MainProblems problems={problems} />}
        </div>
        <div
          data-part="roost-cell"
          className="mx-auto w-120 max-w-full @min-[860px]:mx-0 @min-[860px]:w-auto @min-[860px]:min-w-0 @min-[860px]:flex-[0_1_auto]"
        >
          <Roost bird={bird} now={now} onChip={pressChip} />
        </div>
      </div>
      {/* The sheet spans both rows: a press anywhere off the papers, the band included, folds them,
          and the papers rise over the panes in the ground row. The article clips vertically, so the
          card rises from its foot without making anything scrollable, its shadow falling on the
          band. */}
      <RisingSheet shown={papersShown} onDismiss={close}>
        {agreed !== null && (
          <AdoptionPapers
            bird={bird}
            form={agreed}
            now={now}
            problems={problems}
            onSign={(values) => {
              setSigned({ kind: "values", values });
              papers.onSave(bird.id, values);
            }}
            onReturn={() => {
              setSigned({ kind: "return" });
              papers.onRemove(bird.id);
            }}
            onClose={close}
          />
        )}
      </RisingSheet>
      <div
        data-part="panes"
        inert={papersShown}
        className={`pane-scroll col-start-1 row-start-2 -mx-2.5 grid min-h-0 content-start gap-x-5 gap-y-10 overflow-x-hidden overflow-y-auto pb-11 @min-[960px]:grid-cols-[minmax(350px,450px)_minmax(0,1fr)] @min-[960px]:grid-rows-[minmax(0,1fr)] @min-[960px]:overflow-hidden @min-[960px]:pb-0 motion-safe:transition-opacity motion-safe:duration-420 motion-safe:ease-[ease] ${papersShown ? "opacity-25" : ""}`}
      >
        <div data-part="record" className={paneClass}>
          <Ledger
            quiet={page.quiet}
            facts={page.ledger}
            now={now}
            landing={landing}
            onReveal={revealLine}
          />
          {page.branches.length > 0 && (
            <BranchLines
              branches={page.branches}
              now={now}
              chip={
                bird.bubble.chips.some((chip) => chip.kind === "stalled")
                  ? "stalled"
                  : null
              }
              landing={landing}
            />
          )}
          {page.history.commits.length > 0 && (
            <CommitHistory history={page.history} now={now} />
          )}
          {page.pullRequests.length > 0 && (
            <PullRequestLines pullRequests={page.pullRequests} now={now} />
          )}
          {page.flags.length > 0 && <FlagLines flags={page.flags} />}
          {page.problems.length > 0 && (
            <SourceProblems problems={page.problems} />
          )}
        </div>
        <div data-part="sheets" className={paneClass}>
          {page.noLocalRepository !== null && (
            <NoLocalRepositorySlip
              slip={page.noLocalRepository}
              onLocalSources={onLocalSources}
              onCopy={onCopy}
            />
          )}
          <KeyFileSheets sheets={sheets} reveal={reveal} />
        </div>
      </div>
    </article>
  );
}
