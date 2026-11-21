// The snooze control, in a bubble or on a bird's page: the snooze key opening the durations, or a
// wake key in its place while the bird's look is snoozed, and neither on the fence. The durations
// live only here: a pick becomes an end date from today, which the caller hands on.

import {
  type SnoozeDuration,
  type SnoozeEnd,
  snoozeEndDate,
} from "@perch/core/snooze-date.ts";
import type { Bird } from "@perch/core/viewmodel.ts";
import { useEffect, useRef, useState } from "react";
import type { BirdLook } from "./bird.tsx";
import { Icon } from "./icons.tsx";

/** What the control asks of the main process. */
export interface SnoozeCalls {
  /** Snoozes a bird until an end date, or indefinitely with null. */
  onSnooze: (birdId: string, until: SnoozeEnd) => void;
  onWake: (birdId: string) => void;
}

/** Where the control sits, which sets its grain: dark keys on the bubble's paper, an outlined verb on the page. */
export type SnoozePlace = "bubble" | "page";

const durations: SnoozeDuration[] = [
  "1 day",
  "3 days",
  "1 week",
  "2 weeks",
  "1 month",
];

interface PlaceStyle {
  key: string;
  open: string;
  iconSize: number;
  card: string;
  item: string;
  rule: string;
}

const styles: Record<SnoozePlace, PlaceStyle> = {
  bubble: {
    key: "inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-key px-3 py-2 font-body font-semibold text-[12.5px] text-ink hover:bg-key-hi",
    open: "bg-key-hi",
    iconSize: 14,
    card: "border-key-hi bg-key-strong",
    item: "hover:bg-key-hi",
    rule: "bg-key-hi",
  },
  page: {
    key: "ml-1.5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-edge px-3.25 py-2.25 font-body font-medium text-[13.5px] text-ink-muted hover:bg-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-ink-accent focus-visible:outline-offset-1",
    open: "bg-panel text-ink",
    iconSize: 15,
    card: "border-edge-hi bg-panel",
    item: "hover:bg-panel-hi",
    rule: "bg-edge",
  },
};

export interface SnoozeKeyProps {
  bird: Bird;
  /** The bird's look now, which decides the key offered. */
  look: BirdLook;
  /** The render's clock: a duration's end date is counted from its day. */
  now: Date;
  place: SnoozePlace;
  calls: SnoozeCalls;
}

/** The snooze key and its durations, or the wake key, as the bird's look offers. */
export function SnoozeKey({ bird, look, now, place, calls }: SnoozeKeyProps) {
  const style = styles[place];
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPress = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPress);
    return () => document.removeEventListener("pointerdown", onPress);
  }, [open]);

  if (look.stateWord === "not adopted") return null;
  if (look.stateWord === "snoozed") {
    return (
      <button
        type="button"
        onClick={() => calls.onWake(bird.id)}
        className={style.key}
      >
        <Icon name="sun" size={style.iconSize} />
        Wake
      </button>
    );
  }
  const pick = (until: SnoozeEnd) => {
    setOpen(false);
    calls.onSnooze(bird.id, until);
  };
  const itemClass = `cursor-pointer rounded-md px-2.5 py-1.5 text-left font-body font-medium text-[13px] text-ink ${style.item}`;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape folds the durations before it reaches the scene, which would close the bubble.
    <div
      ref={ref}
      className="relative"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.stopPropagation();
        setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(!open)}
        className={`${style.key} ${open ? style.open : ""}`}
      >
        <Icon name="moon" size={style.iconSize} />
        Snooze
      </button>
      {open && (
        <div
          role="menu"
          aria-label={`Snooze ${bird.name} for`}
          className={`absolute top-[calc(100%+6px)] left-0 z-30 flex min-w-37.5 flex-col rounded-[10px] border p-1.25 shadow-bubble ${style.card}`}
        >
          {durations.map((duration) => (
            <button
              key={duration}
              type="button"
              role="menuitem"
              onClick={() => pick(snoozeEndDate(duration, now))}
              className={itemClass}
            >
              {duration}
            </button>
          ))}
          <div className={`mx-1.5 my-1 h-px ${style.rule}`} />
          <button
            type="button"
            role="menuitem"
            onClick={() => pick(null)}
            className={itemClass}
          >
            Indefinitely
          </button>
        </div>
      )}
    </div>
  );
}
