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

/** One bird's detail; the rest of the path is its id, which holds slashes ("dev/perch"). */
const birdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "bird/$",
});

/** The settings page, in the camera's place. */
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings",
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
