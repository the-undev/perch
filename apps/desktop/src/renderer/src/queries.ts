// What the renderer reads from the main process, through the query cache: the state, kept
// current by the main process's pushes, and the open bird's key files.

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { KeyFileSheet, PerchApi, PerchState } from "../../shared/ipc.ts";

const stateKey = ["state"] as const;

/**
 * The state: what the main process has at once, the cached snapshot's aviary at start, then
 * every state it pushes. Undefined only until the first answer.
 */
export function usePerchState(api: PerchApi): PerchState | undefined {
  const queryClient = useQueryClient();
  useEffect(
    () => api.onState((state) => queryClient.setQueryData(stateKey, state)),
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
