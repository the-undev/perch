// The frame around every page: the header with the brand and the groups, and the page beneath.

import { Link, Outlet } from "@tanstack/react-router";
import { groups } from "./registry.ts";

/** The board's mark: one content bird, drawn small. */
export function Mark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="-50 -62 94 70"
      width={40}
      height={30}
      className="overflow-visible"
    >
      <line
        x1={-6}
        y1={-8}
        x2={-7}
        y2={2}
        stroke="var(--color-leg)"
        strokeWidth={2.4}
      />
      <line
        x1={6}
        y1={-8}
        x2={7}
        y2={2}
        stroke="var(--color-leg)"
        strokeWidth={2.4}
      />
      <path
        d="M -16 -22 L -42 -10 L -38 -20 L -44 -26 L -20 -32 Z"
        fill="var(--color-plumage)"
      />
      <ellipse cx={0} cy={-26} rx={23} ry={19} fill="var(--color-plumage)" />
      <path
        d="M 10 -14 A 18 16 0 0 0 20 -34 A 23 19 0 0 1 2 -8 Z"
        fill="var(--color-green)"
      />
      <circle cx={16} cy={-44} r={11.5} fill="var(--color-plumage)" />
      <path d="M 26 -45 L 37 -42 L 26 -39 Z" fill="var(--color-ink-accent)" />
      <circle cx={19.5} cy={-46} r={1.8} fill="var(--color-eye)" />
    </svg>
  );
}

export function Shell() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex h-13.5 items-center gap-5 border-edge border-b bg-rail px-5">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-ink no-underline hover:text-ink-accent"
        >
          <Mark />
          <span className="font-bold font-display text-[19px]">
            Perch design
          </span>
        </Link>
        <nav
          aria-label="Groups"
          className="flex gap-1 rounded-full border border-edge bg-band p-0.75"
        >
          {groups.map((group) => (
            <Link
              key={group.id}
              to="/"
              hash={group.id}
              className="rounded-full px-4 py-1.5 font-semibold text-[12.5px] text-ink-muted no-underline hover:text-ink"
            >
              {group.title}
            </Link>
          ))}
        </nav>
        <span className="ml-auto text-[12px] text-ink-faint">
          mock scan, 22 October 2026 09:00
        </span>
      </header>
      <Outlet />
    </div>
  );
}
