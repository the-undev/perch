import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
} from "@tanstack/react-router";
import type { PerchApi } from "../../shared/ipc.ts";
import { HomePage } from "./home-page.tsx";

/** What every route can reach: the main-process calls and the query cache. */
export interface RouterContext {
  api: PerchApi;
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: function IndexRoute() {
    const { api } = indexRoute.useRouteContext();
    return <HomePage api={api} />;
  },
});

const routeTree = rootRoute.addChildren([indexRoute]);

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
