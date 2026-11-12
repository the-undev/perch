// The key files as paper, the bubble's material, with a folder tab per file. The view model holds
// the paths and a roadmap file's margin marks; the caller reads the files and passes their markdown in.
// A reveal opens its file's tab, scrolls its line into view and briefly marks it, as a chip's
// landing marks a ledger row.

import type { KeyFile, LineMarks, PaperLine } from "@perch/core/viewmodel.ts";
import {
  createElement,
  type HTMLAttributes,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { landingScroll } from "./ledger.tsx";

/** One key file and what was read from it; null when it could not be read. */
export interface KeyFileSheet {
  file: KeyFile;
  markdown: string | null;
}

/** Whether an image address names a scheme, so the window can fetch it; a path inside the repository does not. */
const isAbsoluteAddress = (src: string) => /^[a-z][a-z0-9+.-]*:/i.test(src);

/** A remote image as an image, and a repository-relative one as its alt text, since nothing serves it. */
function PaperImage({
  src,
  alt,
}: {
  src?: string | Blob | undefined;
  alt?: string | undefined;
}) {
  if (typeof src === "string" && isAbsoluteAddress(src)) {
    return <img src={src} alt={alt ?? ""} />;
  }
  return <>{alt ?? ""}</>;
}

/** A line pressed in the ledger: the key file and line to show, and the press's number, so a second press shows it again. */
export interface Reveal {
  at: PaperLine;
  press: number;
}

/** The brief mark behind a revealed line, in the paper's ink; drawn afresh for each press. */
function PaperLandingMark() {
  return (
    <span
      aria-hidden="true"
      data-part="landing"
      className="pointer-events-none absolute -inset-x-2.5 inset-y-0 -z-10 animate-land rounded-md bg-paper-dim opacity-0 ring-1 ring-paper-head"
    />
  );
}

/** The elements a roadmap's bug can start on: a list item, or a heading. */
const markable = ["li", "h1", "h2", "h3", "h4", "h5", "h6"] as const;

/**
 * Each markable element carrying the mark of the source line it starts on, if that line has one,
 * and the landing mark when it is the revealed line.
 */
function markedComponents(
  marks: LineMarks,
  revealed: Reveal | null,
): Components {
  return Object.fromEntries(
    markable.map((Tag) => [
      Tag,
      ({
        node,
        children,
        ...props
      }: HTMLAttributes<HTMLElement> & ExtraProps) => {
        const line = node?.position?.start.line;
        const mark = line === undefined ? undefined : marks[line];
        if (mark === undefined) return createElement(Tag, props, children);
        const landed = revealed !== null && revealed.at.line === line;
        return createElement(
          Tag,
          {
            ...props,
            "data-mark": mark.kind,
            "data-mark-done": mark.done ? "" : undefined,
            "data-revealed": landed ? "" : undefined,
          },
          landed && <PaperLandingMark key={`mark-${revealed.press}`} />,
          children,
        );
      },
    ]),
  );
}

/** A sheet of paper holding one rendered markdown file, with a mark in the margin beside each marked line. */
export function MarkdownPaper({
  markdown,
  marks,
  revealed,
}: {
  markdown: string;
  marks: LineMarks;
  /** The reveal whose line is on this sheet, which it marks; null for none. */
  revealed: Reveal | null;
}) {
  const components = useMemo(
    () => ({ ...markedComponents(marks, revealed), img: PaperImage }),
    [marks, revealed],
  );
  return (
    <div className="perch-prose">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}

/**
 * The key files behind folder tabs, the first open; nothing when the bird has none. The sheet
 * keeps its full height and the pane around it scrolls, the tabs held at the pane's top. Each new
 * reveal opens its file's tab and scrolls its line to the middle of the pane, marked; pressing a
 * tab drops the mark.
 */
export function KeyFilePaper({
  sheets,
  reveal,
}: {
  sheets: KeyFileSheet[];
  /** The line last pressed in the ledger; null when none has been. */
  reveal: Reveal | null;
}) {
  const [openPath, setOpenPath] = useState(
    reveal === null ? sheets[0]?.file.path : reveal.at.path,
  );
  const [shown, setShown] = useState(reveal);
  const [asked, setAsked] = useState(reveal);
  if (reveal !== asked) {
    setAsked(reveal);
    setShown(reveal);
    if (reveal !== null) setOpenPath(reveal.at.path);
  }
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // The line scrolls once the open sheet has committed with its mark, before it paints.
  useLayoutEffect(() => {
    if (shown === null) return;
    panelRef.current
      ?.querySelector("[data-revealed]")
      ?.scrollIntoView(landingScroll);
  }, [shown]);
  const open =
    sheets.find((sheet) => sheet.file.path === openPath) ?? sheets[0];
  if (open === undefined) return null;
  const revealed =
    shown !== null && shown.at.path === open.file.path ? shown : null;
  return (
    <div className="min-w-0">
      <div
        role="tablist"
        aria-label="Key files"
        className="sticky top-0 z-10 flex items-end gap-1.5 bg-ground pl-4.5"
      >
        {sheets.map((sheet) => {
          const selected = sheet === open;
          return (
            <button
              key={sheet.file.path}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              onClick={() => {
                setOpenPath(sheet.file.path);
                setShown(null);
              }}
              className={
                selected
                  ? "cursor-pointer rounded-t-[9px] bg-paper px-4 pt-2 pb-2.25 font-mono font-semibold text-[12px] text-paper-head focus-visible:outline-2 focus-visible:outline-ink-accent"
                  : "cursor-pointer rounded-t-[9px] bg-paper-dim px-4 pt-2 pb-1.75 font-mono font-semibold text-[12px] text-paper-tab opacity-75 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-ink-accent"
              }
            >
              {sheet.file.path}
            </button>
          );
        })}
      </div>
      <div
        ref={panelRef}
        id={panelId}
        role="tabpanel"
        aria-label={open.file.path}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the sheet takes focus so the keys scroll the pane holding it.
        tabIndex={0}
        className="rounded-paper bg-paper px-9.5 pt-7 pb-8.5 text-paper-ink shadow-paper focus-visible:outline-2 focus-visible:outline-ink-accent"
      >
        {open.markdown === null ? (
          <p className="m-0 text-[14px] text-paper-quiet">
            <code className="font-mono">{open.file.path}</code> could not be
            read.
          </p>
        ) : (
          <MarkdownPaper
            markdown={open.markdown}
            marks={open.file.marks}
            revealed={revealed}
          />
        )}
      </div>
    </div>
  );
}
