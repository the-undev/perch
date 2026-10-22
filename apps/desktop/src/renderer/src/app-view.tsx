// The window: the camera over the aviary, bound to the router. The URL holds where the camera
// points; the main process's state holds what it shows.

import type { Aviary } from "@perch/core/viewmodel.ts";
import { type CameraPlace, CameraView } from "@perch/ui/camera.tsx";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import type { PerchApi } from "../../shared/ipc.ts";
import { useKeyFiles, usePerchState } from "./queries.ts";
import { useNow } from "./use-now.ts";

/** How often the clock is read again: the sky changes on the hour, ages by the hour. */
const clockTickMs = 60_000;

/** Before the first scan has finished there is nothing to perch: the brand and what is going on. */
function FirstScan({
  scanning,
  problems,
}: {
  scanning: boolean;
  problems: string[];
}) {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2 bg-bg text-ink">
      <h1 className="m-0 font-bold font-display text-[19px]">perch</h1>
      <p role="status" className="m-0 text-[12px] text-ink-faint">
        {scanning ? "First scan running" : "No scan yet"}
      </p>
      {problems.map((problem) => (
        <p key={problem} className="m-0 max-w-[90ch] text-[12px] text-amber">
          {problem}
        </p>
      ))}
    </main>
  );
}

/** The aviary with the main process's problems ahead of the scan's own warnings. */
function withProblems(aviary: Aviary, problems: string[]): Aviary {
  return { ...aviary, warnings: [...problems, ...aviary.warnings] };
}

export function AppView({ api }: { api: PerchApi }) {
  const state = usePerchState(api);
  const now = useNow(clockTickMs);
  const navigate = useNavigate();
  const birdId = useParams({ strict: false })._splat || null;
  const place: CameraPlace =
    birdId === null ? { at: "aviary" } : { at: "detail", birdId };
  const sheets = useKeyFiles(api, birdId, state?.aviary?.scannedAt ?? null);
  const aviary = useMemo(
    () =>
      state?.aviary ? withProblems(state.aviary, state.problems) : undefined,
    [state],
  );
  const onNavigate = useCallback(
    (next: CameraPlace) => {
      if (next.at === "aviary") {
        void navigate({ to: "/" });
        return;
      }
      void navigate({ to: "/bird/$", params: { _splat: next.birdId } });
    },
    [navigate],
  );

  if (state === undefined) return null;
  if (aviary === undefined) {
    return <FirstScan scanning={state.scanning} problems={state.problems} />;
  }
  return (
    <CameraView
      aviary={aviary}
      now={now}
      place={place}
      onNavigate={onNavigate}
      onLaunch={(action) => void api.launch(action)}
      sheets={sheets}
      scanning={state.scanning}
      onRescan={() => void api.rescan()}
    />
  );
}
