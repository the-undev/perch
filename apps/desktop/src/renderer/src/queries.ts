// What the renderer reads from the main process, through the query cache: the state, kept
// current by the main process's pushes, the open bird's key files and its config entry, and the
// settings.

import type { EntryForm } from "@perch/core/entry-form.ts";
import type { SettingsForm } from "@perch/core/settings-form.ts";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { KeyFileSheet, PerchApi, PerchState } from "../../shared/ipc.ts";

const stateKey = ["state"] as const;

/** The forms read from config, which every pushed state may have changed. */
const configFormKeys = [["entryForm"], ["settings"]] as const;

/**
 * The state: what the main process has at once, the cached snapshot's aviary at start, then
 * every state it pushes. Each push reads the open forms again, since the config they come from
 * may have changed on disk; an answer equal to the last keeps the same object.
 */
export function usePerchState(api: PerchApi): PerchState | undefined {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      api.onState((state) => {
        queryClient.setQueryData(stateKey, state);
        for (const queryKey of configFormKeys) {
          void queryClient.invalidateQueries({ queryKey });
        }
      }),
    [api, queryClient],
  );
  return useQuery({
    queryKey: stateKey,
    queryFn: () => api.state(),
    staleTime: Number.POSITIVE_INFINITY,
  }).data;
}

/**
 * The open bird's key files, read once the state is known, again after every scan and on window
 * focus. While a new read runs the same bird keeps its sheets; another bird's never show.
 */
export function useKeyFiles(
  api: PerchApi,
  birdId: string | null,
  scannedAt: string | null,
): KeyFileSheet[] {
  const query = useQuery({
    queryKey: ["keyFiles", birdId, scannedAt],
    queryFn:
      birdId === null || scannedAt === null
        ? skipToken
        : () => api.keyFiles(birdId),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === birdId ? previous : undefined,
  });
  return query.data ?? [];
}

/**
 * The open bird's config entry and its form's choices, read with the state known, again after
 * every scan and every change the bird shows; null until read.
 */
export function useEntryForm(
  api: PerchApi,
  birdId: string | null,
  version: string | null,
): EntryForm | null {
  const query = useQuery({
    queryKey: ["entryForm", birdId, version],
    queryFn:
      birdId === null || version === null
        ? skipToken
        : () => api.entryForm(birdId),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === birdId ? previous : undefined,
  });
  return query.data ?? null;
}

/** The settings form, read while the settings page is open and again with every pushed state. */
export function useSettingsForm(
  api: PerchApi,
  open: boolean,
): SettingsForm | null {
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: open ? () => api.settingsForm() : skipToken,
  });
  return query.data ?? null;
}
