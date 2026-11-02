import {
  type ChipKind,
  chipKinds,
  type SourceCardKind,
} from "@perch/core/viewmodel.ts";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import type { PerchApi } from "../../shared/ipc.ts";
import { AppView } from "./app-view.tsx";

/** What every route can reach: the main-process calls and the query cache. */
export interface RouterContext {
  api: PerchApi;
  queryClient: QueryClient;
}

// The camera is the root and stays mounted across the aviary and every bird, so moving between
// them flies rather than remounts. Those routes only say where it points; the settings route
// puts the settings page in its place.
const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: function Root() {
    const { api } = rootRoute.useRouteContext();
    return <AppView api={api} />;
  },
});

/** The whole aviary. */
const aviaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
});

/**
 * What a bird's URL can carry beyond its id: papers=true unfolds its adoption papers, and
 * chip=<kind> lands on the ledger row holding that chip's working.
 */
export interface BirdSearch {
  papers?: true;
  /** Undefined for a chip the URL names that is no chip kind, overriding the raw value the router keeps beneath. */
  chip?: ChipKind | undefined;
}

/** A bird's search as read from its URL: papers only when true, and chip only when a known kind. */
export function birdSearch(search: Record<string, unknown>): BirdSearch {
  return {
    ...(search.papers === true ? { papers: true } : {}),
    chip: chipKinds.find((kind) => kind === search.chip),
  };
}

/**
 * One bird's detail; the rest of the path is its id, which holds slashes ("dev/perch"). The
 * search says whether its papers unfold as the page opens, and which chip's row it lands on.
 */
const birdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "bird/$",
  validateSearch: birdSearch,
});

/** Every kind of source card, which the settings URL can ask to unfold. */
const sourceCardKinds: readonly SourceCardKind[] = [
  "local",
  "github",
  "forgejo",
  "kuma",
];

/** What the settings URL can carry: unfold=<kind> opens the Sources page with those cards unfolded. */
export interface SettingsSearch {
  /** Undefined for a kind the URL names that is no card kind. */
  unfold?: SourceCardKind | undefined;
}

/** The settings search as read from its URL: unfold only when a known kind. */
export function settingsSearch(
  search: Record<string, unknown>,
): SettingsSearch {
  return { unfold: sourceCardKinds.find((kind) => kind === search.unfold) };
}

/** The settings page, in the camera's place; the search says which Sources cards start unfolded. */
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings",
  validateSearch: settingsSearch,
});

const routeTree = rootRoute.addChildren([
  aviaryRoute,
  birdRoute,
  settingsRoute,
]);

/** Builds the router; the window passes hash history, tests pass memory history. */
export function createAppRouter(
  context: RouterContext,
  history: RouterHistory,
) {
  return createRouter({ routeTree, context, history });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
