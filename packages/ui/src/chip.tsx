// A number the bird carries, on the bubble's paper, toned by the severity of the fact behind it.

import type { Chip as ChipModel } from "@perch/core/viewmodel.ts";

const tone: Record<NonNullable<ChipModel["severity"]> | "none", string> = {
  none: "bg-chip text-chip-ink",
  amber: "bg-chip-amber text-chip-amber-ink",
  red: "bg-chip-red text-chip-red-ink",
};

/** One chip: its label, plain when the fact is not judged, amber or red when it is. */
export function Chip({ chip }: { chip: ChipModel }) {
  return (
    <span
      data-kind={chip.kind}
      data-severity={chip.severity ?? "none"}
      className={`rounded-full px-2.5 py-0.75 font-semibold text-[11.5px] tabular-nums ${tone[chip.severity ?? "none"]}`}
    >
      {chip.label}
    </span>
  );
}

/** The chips row beneath the speech; nothing at all when the bird carries no numbers. */
export function Chips({ chips }: { chips: ChipModel[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="mt-2.75 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <Chip key={chip.kind + chip.label} chip={chip} />
      ))}
    </div>
  );
}
