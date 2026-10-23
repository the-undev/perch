// The settings page: the camera's header voice with the brand riding home, the main process's
// problems, and the settings editor. Escape rides home, as it does from a bird's page.

import type {
  SettingsForm,
  SettingsValues,
} from "@perch/core/settings-form.ts";
import { useEffect } from "react";
import { SettingsEditor } from "./settings-forms.tsx";

export interface SettingsViewProps {
  /** The settings as the config file holds them; null until read. */
  form: SettingsForm | null;
  /** What went wrong outside any one source, a refused save among them. */
  problems: string[];
  onSave: (values: SettingsValues) => void;
  /** The brand, the way back or Escape was pressed. */
  onHome: () => void;
}

/** The whole settings page, its header and its editor. */
export function SettingsView({
  form,
  problems,
  onSave,
  onHome,
}: SettingsViewProps) {
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
        <div className="ml-auto flex items-baseline gap-3 text-[12px] text-ink-faint">
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
      <main className="min-h-0 flex-1 overflow-y-auto bg-ground px-7.5 pt-5.5">
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
          <SettingsEditor form={form} onSave={onSave} />
        )}
      </main>
    </div>
  );
}
