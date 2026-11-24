// The window: the camera over the aviary, bound to the router, or the settings page. The URL holds
// where the camera points; the main process's state holds what it shows.

import type { Aviary, Bird } from "@perch/core/viewmodel.ts";
import type { PapersControls } from "@perch/ui/bird-page-view.tsx";
import { type CameraPlace, CameraView } from "@perch/ui/camera.tsx";
import { SettingsView } from "@perch/ui/settings-view.tsx";
import type { SnoozeCalls } from "@perch/ui/snooze-action.tsx";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import type { PerchApi } from "../../shared/ipc.ts";
import {
  useKeyFiles,
  usePapersForm,
  usePerchState,
  useSettingsForm,
} from "./queries.ts";
import { useNow } from "./use-now.ts";
import { Welcome } from "./welcome.tsx";

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
      <h1 className="m-0 font-bold font-display text-[19px]">Perch</h1>
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

function findBird(aviary: Aviary, id: string): Bird | undefined {
  return [
    ...aviary.wires.flatMap((wire) => wire.birds),
    ...aviary.fence.birds,
  ].find((bird) => bird.id === id);
}

/**
 * When the open bird's papers are read again: after every scan, and as soon as a reread config
 * moves the bird or renames it, before the scan that follows. Null until there is an aviary.
 */
function papersVersion(aviary: Aviary | null, birdId: string | null) {
  if (aviary === null) return null;
  const bird = birdId === null ? undefined : findBird(aviary, birdId);
  return [aviary.scannedAt, bird?.wire ?? "fence", bird?.name ?? ""].join("\n");
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
  const search = useSearch({ strict: false });
  const papers = search.papers === true;
  const chip = search.chip ?? null;
  const unfold = search.unfold ?? null;
  const settingsPage = search.page ?? "sources";
  const atSettings = useLocation({
    select: (location) => location.pathname === "/settings",
  });
  const settings = useSettingsForm(api, atSettings);
  const place: CameraPlace =
    birdId === null
      ? { at: "aviary" }
      : { at: "birdPage", birdId, papers, chip };
  const sheets = useKeyFiles(api, birdId, state?.aviary?.scannedAt ?? null);
  const queryClient = useQueryClient();
  const papersForm = usePapersForm(
    api,
    birdId,
    papersVersion(state?.aviary ?? null, birdId),
  );
  const papersControls = useMemo((): PapersControls => {
    // A write settles once its scan has, which reads the papers again whatever changed.
    const reread = () =>
      void queryClient.invalidateQueries({ queryKey: ["papersForm"] });
    return {
      form: papersForm,
      onSave: (id, values) => void api.savePapers(id, values).finally(reread),
      onRemove: (id) => void api.removePapers(id).finally(reread),
    };
  }, [api, papersForm, queryClient]);
  const snooze = useMemo(
    (): SnoozeCalls => ({
      pickedAt: () => new Date(),
      onSnooze: (id, until) => void api.snooze(id, until),
      onWake: (id) => void api.wake(id),
    }),
    [api],
  );
  const aviary = useMemo(
    () =>
      state?.aviary ? withProblems(state.aviary, state.problems) : undefined,
    [state],
  );
  const home = useCallback(() => void navigate({ to: "/" }), [navigate]);
  // The tray's update entry asks for the Updates page.
  useEffect(
    () =>
      api.onOpenUpdates(
        () => void navigate({ to: "/settings", search: { page: "updates" } }),
      ),
    [api, navigate],
  );
  const onNavigate = useCallback(
    (next: CameraPlace) => {
      if (next.at === "aviary") {
        void navigate({ to: "/" });
        return;
      }
      void navigate({
        to: "/bird/$",
        params: { _splat: next.birdId },
        search: {
          ...(next.papers ? { papers: true } : {}),
          ...(next.chip === null ? {} : { chip: next.chip }),
        },
      });
    },
    [navigate],
  );

  if (state === undefined) return null;
  if (state.noConfig) {
    return (
      <Welcome
        problems={state.problems}
        onCreateConfig={() =>
          void api.writeStarterConfig().then((written) => {
            // The settings page opens on Sources, where the first source is added.
            if (written) void navigate({ to: "/settings" });
          })
        }
        onCheckAgain={() => void api.rescan()}
      />
    );
  }
  if (atSettings) {
    return (
      <SettingsView
        form={settings}
        cards={state.sourceCards}
        now={now}
        aviary={state.aviary}
        scanning={state.scanning}
        onRescan={() => void api.rescan()}
        onOpenConfig={() => void api.openConfig()}
        problems={state.problems}
        keyring={{ storeToken: api.storeToken, testSource: api.testSource }}
        unfold={unfold}
        page={settingsPage}
        onPage={(page) => void navigate({ to: "/settings", search: { page } })}
        update={state.update}
        updateCalls={{
          onCheck: () => void api.checkForUpdate(),
          onInstall: () => void api.installUpdate(),
          onRestart: () => void api.restartIntoUpdate(),
        }}
        onSave={(values) =>
          void api
            .saveSettings(values)
            .finally(
              () =>
                void queryClient.invalidateQueries({ queryKey: ["settings"] }),
            )
        }
        onHome={home}
      />
    );
  }
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
      snooze={snooze}
      sheets={sheets}
      scanning={state.scanning}
      onRescan={() => void api.rescan()}
      onSettings={() => void navigate({ to: "/settings" })}
      onLocalSources={() =>
        void navigate({ to: "/settings", search: { unfold: "local" } })
      }
      onCopy={(text) => navigator.clipboard.writeText(text)}
      papers={papersControls}
      problems={state.problems}
    />
  );
}
