// The board's line icons for launch actions, links out, the config entry's verbs and the snooze
// control, stroked in the accent.

import type { IconName } from "@perch/core/launch-kinds.ts";
import type { ReactNode } from "react";

export type { IconName };

/** The snooze control's icons, which config cannot give a launch action. */
type ControlIconName = "moon" | "sun";

const paths: Record<IconName | ControlIconName, ReactNode> = {
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
  moon: (
    <path d="M18.75 15.3A8.25 8.25 0 0 1 8.7 5.25a8.25 8.25 0 1 0 10.05 10.05z" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.25v2.7M12 19.05v2.7M2.25 12h2.7M19.05 12h2.7M5.1 5.1l1.95 1.95M16.95 16.95l1.95 1.95M5.1 18.9l1.95-1.95M16.95 7.05l1.95-1.95" />
    </>
  ),
};

/** One line icon at the given size in pixels; decorative, so hidden from assistive technology. */
export function Icon({
  name,
  size,
}: {
  name: IconName | ControlIconName;
  size: number;
}) {
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
