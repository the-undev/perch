// Tier C: a bird's full page, a fixed stage. The band at the top is one row: the heading (the name,
// the meta line with the launch actions, links out and papers' verb beside it, then a notice for
// each remote no card can read and the main process's problems), the roost's bubble at its reading
// width, and the bird sitting on its perch at the right. It never scrolls. Beneath it the ground holds two panes that each scroll their own contents: the
// record (the ledger and its sections) and the key files on paper; in a narrow page they join into
// one pane, the key files at the end. The adoption papers rise as a sheet over both panes, which
// dim and go inert while the band stays live. A chip pressed in the roost's
// bubble lands on the ledger row holding its working, or the can't-read chip on the notice, as does
// the chip pressed in the aviary's bubble that brought the camera here. Only what exists is shown.
// The view fetches nothing: key-file contents, launching and the entry's form and writes are the
// caller's.

import {
  type EntryForm,
  type EntryValues,
  sameEntryValues,
} from "@perch/core/entry-form.ts";
import type {
  Bird,
  ChipKind,
  LaunchAction,
  RemoteNotice,
} from "@perch/core/viewmodel.ts";
import {
  type AnimationEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { actionClass, LaunchActions, LinksOut } from "./actions.tsx";
import { AdoptionPapers } from "./adoption-papers.tsx";
import { DetailHeading } from "./detail-heading.tsx";
import { Icon } from "./icons.tsx";
import {
  BranchLines,
  CommitRiver,
  FlagLines,
  type Landing,
  LandingMark,
  Ledger,
  PullRequestLines,
  SourceProblems,
} from "./ledger.tsx";
import { KeyFilePaper, type KeyFileSheet } from "./paper.tsx";
import { RisingSheet } from "./rising-sheet.tsx";
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
  /** The chip pressed in the aviary's bubble that brought the camera here: landed on as the page opens and whenever it changes; null for none. */
  arrivalChip: ChipKind | null;
  /** A notice's Sources was pressed: open the settings page. */
  onSettings: () => void;
}

/** What was signed and is not yet in the entry read back: the values written, or the return. */
type Signed = { kind: "values"; values: EntryValues } | { kind: "return" };

/** Whether the entry read back shows what was signed. */
function landed(signed: Signed, form: EntryForm): boolean {
  if (signed.kind === "return") return form.values === null;
  return form.values !== null && sameEntryValues(form.values, signed.values);
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

/** Whether the page's arrival is still animating: false where the platform cannot say, or motion is reduced and nothing runs. */
function swapRunning(article: HTMLElement | null): boolean {
  if (article === null || typeof article.getAnimations !== "function") {
    return false;
  }
  return article.getAnimations().length > 0;
}

/** The panes' shared grain: each scrolls its own contents, keeping room at its sides for a landing mark. */
const paneClass =
  "pane-scroll min-h-0 min-w-0 px-2.5 @min-[960px]:overflow-x-hidden @min-[960px]:overflow-y-auto @min-[960px]:pb-11";

/**
 * The whole project page as a fixed stage, centred as one block. The band at the top holds still:
 * from 860px one row, the heading taking what the roost leaves and the roost only as wide as its
 * bubble and bird need; narrower, the roost beneath the heading in a centred column. Beneath it the record
 * pane and the paper pane each scroll their own contents when the page is wide enough; narrower,
 * they join into one pane, the key files at the record's end. It fills a flex column.
 */
export function DetailView({
  bird,
  now,
  onLaunch,
  sheets,
  entry,
  problems,
  openPapers,
  arrivalChip,
  onSettings,
}: DetailViewProps) {
  const { detail } = bird;
  const [open, setOpen] = useState(openPapers);
  const [asked, setAsked] = useState(openPapers);
  if (openPapers !== asked) {
    setAsked(openPapers);
    if (openPapers) setOpen(true);
  }
  // Signed papers stay open until the entry read back shows the write, so a refused one keeps them
  // open with the reason.
  const [signed, setSigned] = useState<Signed | null>(null);
  const { form } = entry;
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
  const night = isNight(skyPhase(now));
  const [landing, setLanding] = useState<Landing | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  // The mark is committed before the scroll, so the row never paints unlit; both callers, a press
  // and the arrival effect, run outside render, where flushSync is allowed. The row's pane scrolls.
  const landOn = useCallback((chip: ChipKind) => {
    flushSync(() => {
      setLanding((last) => ({ chip, press: (last?.press ?? 0) + 1 }));
    });
    articleRef.current
      ?.querySelector(`[data-chip="${chip}"]`)
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  }, []);
  // The arrival lands once the page's own swap is over, since a scroll and a mark during it flicker.
  const [settled, setSettled] = useState(false);
  useLayoutEffect(() => {
    if (!swapRunning(articleRef.current)) setSettled(true);
  }, []);
  const settleOnSwap = (event: AnimationEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.animationName !== "swap") return;
    setSettled(true);
  };
  useEffect(() => {
    if (!settled || arrivalChip === null) return;
    landOn(arrivalChip);
  }, [settled, arrivalChip, landOn]);
  return (
    <article
      ref={articleRef}
      aria-label={`${bird.name} in full`}
      className="@container mx-auto grid min-h-0 w-full max-w-480 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-y-4 overflow-y-clip motion-safe:animate-swap"
      onAnimationEnd={settleOnSwap}
    >
      <div
        data-part="band"
        className="col-start-1 row-start-1 flex flex-col gap-y-3 @min-[860px]:flex-row @min-[860px]:items-start @min-[860px]:gap-x-9"
      >
        <div
          data-part="heading"
          className="min-w-0 @min-[860px]:flex-[1_1_22rem]"
        >
          <DetailHeading
            bird={bird}
            actions={
              <div
                data-part="actions"
                className="flex flex-wrap items-center gap-1"
              >
                <LaunchActions actions={detail.actions} onLaunch={onLaunch} />
                <LinksOut links={detail.links} />
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
            notices={detail.notices}
            landing={landing}
            onSettings={onSettings}
          />
          {!papersShown && <MainProblems problems={problems} />}
        </div>
        <div
          data-part="roost-cell"
          className="mx-auto w-120 max-w-full @min-[860px]:mx-0 @min-[860px]:w-auto @min-[860px]:min-w-0 @min-[860px]:flex-[0_1_auto]"
        >
          <Roost bird={bird} night={night} onChip={landOn} />
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
            night={night}
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
        )}
      </RisingSheet>
      <div
        data-part="panes"
        inert={papersShown}
        className={`pane-scroll col-start-1 row-start-2 -mx-2.5 grid min-h-0 content-start gap-x-5 gap-y-10 overflow-x-hidden overflow-y-auto pb-11 @min-[960px]:grid-cols-[minmax(350px,450px)_minmax(0,1fr)] @min-[960px]:grid-rows-[minmax(0,1fr)] @min-[960px]:overflow-hidden @min-[960px]:pb-0 motion-safe:transition-opacity motion-safe:duration-420 motion-safe:ease-[ease] ${papersShown ? "opacity-25" : ""}`}
      >
        <div data-part="record" className={paneClass}>
          <Ledger entries={detail.ledger} now={now} landing={landing} />
          {detail.branches.length > 0 && (
            <BranchLines
              branches={detail.branches}
              now={now}
              chip={
                bird.bubble.chips.some((chip) => chip.kind === "stalled")
                  ? "stalled"
                  : null
              }
              landing={landing}
            />
          )}
          {detail.river.commits.length > 0 && (
            <CommitRiver river={detail.river} now={now} />
          )}
          {detail.pullRequests.length > 0 && (
            <PullRequestLines pullRequests={detail.pullRequests} now={now} />
          )}
          {detail.flags.length > 0 && <FlagLines flags={detail.flags} />}
          {detail.problems.length > 0 && (
            <SourceProblems problems={detail.problems} />
          )}
        </div>
        <div data-part="paper" className={paneClass}>
          <KeyFilePaper sheets={sheets} />
        </div>
      </div>
    </article>
  );
}
