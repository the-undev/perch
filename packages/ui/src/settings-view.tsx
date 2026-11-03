// The settings page: the camera's header voice with the brand riding home and the camera's scan
// line, a rail naming the pages beside one reading-width column, the main process's problems at
// the column's top, and the editor showing the page the rail has open. Escape rides home, as it
// does from a bird's page.

import type {
  SettingsForm,
  SettingsValues,
} from "@perch/core/settings-form.ts";
import type { KeyringCalls } from "@perch/core/sources-form.ts";
import type {
  Aviary,
  SourceCard,
  SourceCardKind,
} from "@perch/core/viewmodel.ts";
import { useEffect, useState } from "react";
import { ScanLine } from "./scan-line.tsx";
import {
  SettingsEditor,
  type SettingsPageName,
  settingsPages,
} from "./settings-forms.tsx";

export interface SettingsViewProps {
  /** The settings as the config file holds them; null until read. */
  form: SettingsForm | null;
  /** Each configured source card's last scan; null until a snapshot holds them. */
  cards: SourceCard[] | null;
  /** The render's clock: the scan line's phase and age and the source cards' scan times are read from it. */
  now: Date;
  /** The latest scan's aviary, which the header's scan line tells of; null until the first scan has finished. */
  aviary: Aviary | null;
  /** A scan is running; the header's scan line says so quietly. */
  scanning: boolean;
  /** The header's scan line was pressed: scan now. */
  onRescan: () => void;
  /** What went wrong outside any one source, a refused save among them. */
  problems: string[];
  /** Stores a forge card's pasted token and tests its connection. */
  keyring: KeyringCalls;
  /** The Sources page's cards of this kind start unfolded, as the link that opened the page asks; null for none. */
  unfold: SourceCardKind | null;
  onSave: (values: SettingsValues) => void;
  /** The brand, the way back or Escape was pressed. */
  onHome: () => void;
}

/** The rail: every page by name, the open one marked; a row of words on a narrow window. */
function SettingsRail({
  page,
  onPage,
}: {
  page: SettingsPageName;
  onPage: (page: SettingsPageName) => void;
}) {
  return (
    <nav
      aria-label="Settings pages"
      className="flex flex-wrap gap-1 border-edge border-b px-4 py-2.5 @min-[900px]:sticky @min-[900px]:top-0 @min-[900px]:flex-col @min-[900px]:gap-0 @min-[900px]:self-start @min-[900px]:border-r @min-[900px]:border-b-0 @min-[900px]:px-0 @min-[900px]:py-4.5"
    >
      {settingsPages.map((entry) => {
        const open = entry.page === page;
        return (
          <button
            key={entry.page}
            type="button"
            aria-current={open ? "page" : undefined}
            onClick={() => onPage(entry.page)}
            className={`cursor-pointer rounded-full px-2.5 py-1 text-left font-body text-[13px] focus-visible:outline-2 focus-visible:outline-ink-accent @min-[900px]:rounded-none @min-[900px]:border-l-2 @min-[900px]:py-1.5 ${entry.sub ? "@min-[900px]:pl-7 @min-[900px]:text-[12px]" : "@min-[900px]:pl-4"} ${open ? "bg-panel-hi text-ink @min-[900px]:border-ink-accent @min-[900px]:bg-band" : "text-ink-faint hover:text-ink-muted @min-[900px]:border-transparent"}`}
          >
            {entry.label}
          </button>
        );
      })}
    </nav>
  );
}

/** The whole settings page, its header, its rail and the open page. */
export function SettingsView({
  form,
  cards,
  now,
  aviary,
  scanning,
  onRescan,
  problems,
  keyring,
  unfold,
  onSave,
  onHome,
}: SettingsViewProps) {
  const [page, setPage] = useState<SettingsPageName>("sources");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onHome();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onHome]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg text-ink">
      <header className="relative z-40 flex h-13.5 flex-none items-center gap-4.5 border-edge border-b bg-rail px-5">
        <button
          type="button"
          onClick={onHome}
          className="cursor-pointer font-bold font-display text-[19px] text-ink hover:text-ink-accent"
        >
          perch
        </button>
        <h1 className="m-0 font-semibold text-[13.5px] text-ink-muted">
          Settings
        </h1>
        <ScanLine
          aviary={aviary}
          now={now}
          scanning={scanning}
          onRescan={onRescan}
        />
        <div className="flex items-baseline gap-3 text-[12px] text-ink-faint">
          <code className="font-mono">~/.config/perch/config.toml</code>
          <button
            type="button"
            onClick={onHome}
            className="cursor-pointer hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink-accent"
          >
            back to the aviary
          </button>
        </div>
      </header>
      <main className="@container min-h-0 flex-1 overflow-y-auto bg-ground">
        <div className="mx-auto grid min-h-full max-w-350 content-start @min-[900px]:grid-cols-[168px_minmax(0,1fr)]">
          <SettingsRail page={page} onPage={setPage} />
          <div className="flex min-w-0 max-w-190 flex-col px-4 pt-5.5 @min-[900px]:px-6.5">
            {problems.map((problem) => (
              <p key={problem} className="mt-0 mb-2 text-[12.5px] text-amber">
                {problem}
              </p>
            ))}
            {form === null ? (
              <p role="status" className="m-0 text-[12.5px] text-ink-faint">
                Reading the config
              </p>
            ) : (
              <SettingsEditor
                form={form}
                page={page}
                cards={cards}
                now={now}
                keyring={keyring}
                unfold={unfold}
                onSave={onSave}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
