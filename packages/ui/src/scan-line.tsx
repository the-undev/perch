// The scan line, shared by the camera's header and the settings page's: the sky's phase, the
// scan's moment and age, "scanning" while one runs, and the sources the scan could not read.

import type { Aviary } from "@perch/core/viewmodel.ts";
import { sourceErrorWords } from "./aviary-view.tsx";
import { skyPhase } from "./sky.ts";
import { recentWords } from "./time.ts";

export interface ScanLineProps {
  /** The latest scan's aviary; null until the first scan has finished. */
  aviary: Aviary | null;
  /** The render's clock: the phase and the scan's age are read from it. */
  now: Date;
  /** A scan is running; the line says so quietly and holds the press. */
  scanning: boolean;
  /** The line was pressed: scan now. */
  onRescan: () => void;
}

/** The line's words: the phase with the scan's time and age, or that no scan has finished. */
function scanWords(aviary: Aviary | null, now: Date): string {
  const phase = skyPhase(now);
  if (aviary === null) return `${phase}, no scan yet`;
  const time = new Date(aviary.scannedAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${phase}, scanned ${time}, ${recentWords(aviary.scannedAt, now)}`;
}

/**
 * The phase and the scan's moment and age at a header's right, quietly saying when a scan is
 * running, with any sources the scan could not read. Pressing the scan line scans now.
 */
export function ScanLine({ aviary, now, scanning, onRescan }: ScanLineProps) {
  const errors = aviary?.sourceErrors ?? [];
  const failing = errors.length;
  return (
    <div className="ml-auto flex items-baseline gap-2 text-[12px] text-ink-faint">
      {scanning && (
        <span role="status" className="motion-safe:animate-pulse">
          scanning
        </span>
      )}
      <button
        type="button"
        title="Scan now"
        disabled={scanning}
        onClick={onRescan}
        className="cursor-pointer hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink-accent disabled:cursor-default disabled:hover:text-ink-faint"
      >
        {scanWords(aviary, now)}
      </button>
      {failing > 0 && (
        <span
          className="text-amber"
          title={errors.map((error) => sourceErrorWords(error, now)).join("\n")}
        >
          couldn't read {failing} {failing === 1 ? "source" : "sources"}
        </span>
      )}
    </div>
  );
}
