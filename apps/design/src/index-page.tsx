// The index: a card per page, grouped, with the next phase's pages as placeholders.

import { Link } from "@tanstack/react-router";
import { groups, pagesIn } from "./registry.ts";

const cardGrid =
  "mt-4 grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))]";

export function IndexPage() {
  return (
    <main className="mx-auto max-w-[2200px] px-6 pt-10 pb-16">
      <h1 className="m-0 font-bold font-display text-[32px]">Perch Design</h1>
      <p className="max-w-[72ch] text-ink-muted leading-relaxed">
        The real components of the perch design, rendered from the mock dataset
        in every state the view model allows. Each page labels a state with the
        rule behind it and ends with a usage note. Design and theming are
        reviewed here; the board pages in{" "}
        <code className="font-mono text-[13px]">design/</code> stay as the
        approved record.
      </p>
      {groups.map((group) => {
        const groupPages = pagesIn(group.id);
        return (
          <section key={group.id} id={group.id} className="mt-10 scroll-mt-20">
            <h2 className="m-0 font-bold font-display text-[22px]">
              {group.title}{" "}
              {groupPages.length === 0 && (
                <span className="ml-3 font-body font-semibold text-[12px] text-ink-faint">
                  next phase
                </span>
              )}
            </h2>
            <p className="mt-1 mb-0 max-w-[72ch] text-[13.5px] text-ink-faint">
              {group.blurb}
            </p>
            <div className={cardGrid}>
              {groupPages.map((page) => (
                <Link
                  key={page.slug}
                  to="/$slug"
                  params={{ slug: page.slug }}
                  className="flex flex-col gap-2 rounded-xl border border-edge bg-linear-[172deg] from-panel to-band px-5 pt-4.5 pb-4 text-ink no-underline transition-colors hover:border-edge-hi hover:bg-panel-hi"
                >
                  <h3 className="m-0 font-bold font-display text-[20px]">
                    {page.title}
                  </h3>
                  <span className="text-[13px] text-ink-muted leading-normal">
                    {page.summary}
                  </span>
                </Link>
              ))}
              {group.planned.map((title) => (
                <div
                  key={title}
                  className="flex flex-col gap-2 rounded-xl border border-edge border-dashed px-5 pt-4.5 pb-4 text-ink-faint"
                >
                  <h3 className="m-0 font-bold font-display text-[20px]">
                    {title}
                  </h3>
                  <span className="text-[13px]">Next phase.</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
