import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  type RouterHistory,
} from "@tanstack/react-router";
import { IndexPage } from "./index-page.tsx";
import { type DesignPage, groups, pageBySlug, pagesIn } from "./registry.ts";
import { Shell } from "./shell.tsx";

/** A page's head: its group, its siblings as tabs, its title and summary; then the page. */
function PageFrame({ page }: { page: DesignPage }) {
  const group = groups.find((candidate) => candidate.id === page.group);
  const Page = page.component;
  return (
    <main className="mx-auto max-w-[2200px] px-6 pt-6 pb-20">
      <nav
        aria-label={group?.title ?? page.group}
        className="flex flex-wrap gap-1"
      >
        {pagesIn(page.group).map((sibling) => (
          <Link
            key={sibling.slug}
            to="/$slug"
            params={{ slug: sibling.slug }}
            className={
              sibling === page
                ? "rounded-full bg-panel-hi px-3.5 py-1.25 font-semibold text-[12.5px] text-ink no-underline"
                : "rounded-full px-3.5 py-1.25 font-semibold text-[12.5px] text-ink-faint no-underline hover:text-ink"
            }
          >
            {sibling.title}
          </Link>
        ))}
      </nav>
      <h1 className="mt-6 mb-0 font-bold font-display text-[34px] tracking-[-0.01em]">
        {page.title}
      </h1>
      <p className="mt-1.5 mb-0 max-w-[72ch] text-[15px] text-ink-muted">
        {page.summary}
      </p>
      <Page />
    </main>
  );
}

const rootRoute = createRootRoute({ component: Shell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexPage,
});

const pageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$slug",
  component: function PageRoute() {
    const { slug } = pageRoute.useParams();
    const page = pageBySlug(slug);
    if (page === undefined) {
      return (
        <main className="mx-auto max-w-[72ch] px-6 pt-10">
          <h1 className="font-bold font-display text-[28px]">
            No page called {slug}
          </h1>
          <Link to="/" className="text-ink-muted">
            Back to the index
          </Link>
        </main>
      );
    }
    return <PageFrame page={page} />;
  },
});

const routeTree = rootRoute.addChildren([indexRoute, pageRoute]);

/** Builds the router; the browser passes its history, tests pass memory history. */
export function createDesignRouter(history: RouterHistory) {
  return createRouter({ routeTree, history, scrollRestoration: true });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createDesignRouter>;
  }
}
