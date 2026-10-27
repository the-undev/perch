// The key files as paper, the bubble's material, with a folder tab per file. The view model holds
// the paths; the caller reads the files and passes their markdown in.

import type { KeyFile } from "@perch/core/viewmodel.ts";
import { useId, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** One key file and what was read from it; null when it could not be read. */
export interface KeyFileSheet {
  file: KeyFile;
  markdown: string | null;
}

/**
 * The open sheet stops short of the window's height and scrolls inside itself, so long or many
 * documents keep the page's rhythm; a short one keeps its natural height.
 */
export const paperScroll =
  "max-h-[max(20rem,calc(100vh-18rem))] overflow-y-auto overscroll-contain [scrollbar-color:var(--color-paper-quiet)_transparent]";

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

/** A sheet of paper holding one rendered markdown file. */
export function MarkdownPaper({ markdown }: { markdown: string }) {
  return (
    <div className="perch-prose">
      <Markdown remarkPlugins={[remarkGfm]} components={{ img: PaperImage }}>
        {markdown}
      </Markdown>
    </div>
  );
}

/** The key files behind folder tabs, the first open; nothing when the bird has none. */
export function KeyFilePaper({ sheets }: { sheets: KeyFileSheet[] }) {
  const [openPath, setOpenPath] = useState(sheets[0]?.file.path);
  const panelId = useId();
  const open =
    sheets.find((sheet) => sheet.file.path === openPath) ?? sheets[0];
  if (open === undefined) return null;
  return (
    <div className="min-w-0">
      <div
        role="tablist"
        aria-label="Key files"
        className="flex items-end gap-1.5 pl-4.5"
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
              onClick={() => setOpenPath(sheet.file.path)}
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
        id={panelId}
        role="tabpanel"
        aria-label={open.file.path}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a sheet that scrolls takes focus so the keys scroll it.
        tabIndex={0}
        className={`${paperScroll} rounded-paper bg-paper px-9.5 pt-7 pb-8.5 text-paper-ink shadow-paper focus-visible:outline-2 focus-visible:outline-ink-accent`}
      >
        {open.markdown === null ? (
          <p className="m-0 text-[14px] text-paper-quiet">
            <code className="font-mono">{open.file.path}</code> could not be
            read.
          </p>
        ) : (
          <MarkdownPaper markdown={open.markdown} />
        )}
      </div>
    </div>
  );
}
