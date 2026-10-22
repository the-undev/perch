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

/** A sheet of paper holding one rendered markdown file. */
export function MarkdownPaper({ markdown }: { markdown: string }) {
  return (
    <div className="perch-prose">
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
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
        className="rounded-paper bg-paper px-9.5 pt-7 pb-8.5 text-paper-ink shadow-paper"
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
