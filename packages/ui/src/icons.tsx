// The board's line icons for launch actions, links out and the config entry's verbs, stroked in
// the accent.

import type { LaunchAction } from "@perch/core/viewmodel.ts";
import type { ReactNode } from "react";

export type IconName =
  | "terminal"
  | "code"
  | "folder"
  | "forge"
  | "obsidian"
  | "adopt"
  | "edit";

const paths: Record<IconName, ReactNode> = {
  terminal: (
    <>
      <path d="M4 17l6-5-6-5" />
      <path d="M12 19h8" />
    </>
  ),
  code: (
    <>
      <path d="M8 6l-6 6 6 6" />
      <path d="M16 6l6 6-6 6" />
    </>
  ),
  folder: (
    <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  ),
  forge: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </>
  ),
  obsidian: (
    <>
      <path d="M12 2l7 6-3 13H8L5 8z" />
      <path d="M12 2l-2 9 6 10M10 11l-5-3" />
    </>
  ),
  adopt: (
    <>
      <path d="M3 17h18" />
      <path d="M12 5v8M8 9h8" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13 7l4 4" />
    </>
  ),
};

/** The icon each launch action wears. */
export const actionIcon: Record<LaunchAction["kind"], IconName> = {
  zellij: "terminal",
  command: "folder",
  obsidian: "obsidian",
};

/** One line icon at the given size in pixels; decorative, so hidden from assistive technology. */
export function Icon({ name, size }: { name: IconName; size: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="var(--color-ink-accent)"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {paths[name]}
    </svg>
  );
}
