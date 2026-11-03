// The window: the camera over the aviary, bound to the router, or the settings page. The URL holds
// where the camera points; the main process's state holds what it shows.

import type { Aviary, Bird } from "@perch/core/viewmodel.ts";
import { type CameraPlace, CameraView } from "@perch/ui/camera.tsx";
import type { EntryControls } from "@perch/ui/detail-view.tsx";
import { SettingsView } from "@perch/ui/settings-view.tsx";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import type { PerchApi } from "../../shared/ipc.ts";
import {
  useEntryForm,
  useKeyFiles,
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

function findBird(aviary: Aviary, id: string): Bird | undefined {
  return [
    ...aviary.wires.flatMap((wire) => wire.birds),
    ...aviary.fence.birds,
  ].find((bird) => bird.id === id);
}

/**
 * When the open bird's entry is read again: after every scan, and as soon as a reread config
 * moves the bird or renames it, before the scan that follows. Null until there is an aviary.
 */
function entryVersion(aviary: Aviary | null, birdId: string | null) {
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
  const atSettings = useLocation({
    select: (location) => location.pathname === "/settings",
  });
  const settings = useSettingsForm(api, atSettings);
  const place: CameraPlace =
    birdId === null ? { at: "aviary" } : { at: "detail", birdId, papers, chip };
  const sheets = useKeyFiles(api, birdId, state?.aviary?.scannedAt ?? null);
  const queryClient = useQueryClient();
  const entryForm = useEntryForm(
    api,
    birdId,
    entryVersion(state?.aviary ?? null, birdId),
  );
  const entry = useMemo((): EntryControls => {
    // A write settles once its scan has, which reads the entry again whatever changed.
    const reread = () =>
      void queryClient.invalidateQueries({ queryKey: ["entryForm"] });
    return {
      form: entryForm,
      onSave: (id, values) => void api.saveEntry(id, values).finally(reread),
      onRemove: (id) => void api.removeEntry(id).finally(reread),
    };
  }, [api, entryForm, queryClient]);
  const aviary = useMemo(
    () =>
      state?.aviary ? withProblems(state.aviary, state.problems) : undefined,
    [state],
  );
  const home = useCallback(() => void navigate({ to: "/" }), [navigate]);
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
      sheets={sheets}
      scanning={state.scanning}
      onRescan={() => void api.rescan()}
      onSettings={() => void navigate({ to: "/settings" })}
      onLocalSources={() =>
        void navigate({ to: "/settings", search: { unfold: "local" } })
      }
      onCopy={(text) => navigator.clipboard.writeText(text)}
      entry={entry}
      problems={state.problems}
    />
  );
}
