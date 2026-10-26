// A number the bird carries, on the bubble's paper, toned by the severity of the fact behind it.
// In a bubble a chip is a handle that lands on the ledger row holding its working.

import type { ChipKind, Chip as ChipModel } from "@perch/core/viewmodel.ts";

const tone: Record<NonNullable<ChipModel["severity"]> | "none", string> = {
  none: "bg-chip text-chip-ink",
  amber: "bg-chip-amber text-chip-amber-ink",
  red: "bg-chip-red text-chip-red-ink",
};

/** A chip's paper and ink, by its severity. */
function chipClass(chip: ChipModel): string {
  return `rounded-full px-2.5 py-0.75 font-semibold text-[11.5px] tabular-nums ${tone[chip.severity ?? "none"]}`;
}

/** One chip: its label, plain when the fact is not judged, amber or red when it is. */
export function Chip({ chip }: { chip: ChipModel }) {
  return (
    <span
      data-kind={chip.kind}
      data-severity={chip.severity ?? "none"}
      className={chipClass(chip)}
    >
      {chip.label}
    </span>
  );
}

/** The chips row beneath the speech, as handles: pressing a chip hands back its kind; nothing at all when the bird carries no numbers. */
export function ChipHandles({
  chips,
  onPress,
}: {
  chips: ChipModel[];
  onPress: (chip: ChipKind) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="mt-2.75 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.kind + chip.label}
          type="button"
          data-kind={chip.kind}
          data-severity={chip.severity ?? "none"}
          onClick={() => onPress(chip.kind)}
          className={`${chipClass(chip)} cursor-pointer hover:ring-1 hover:ring-paper-quiet focus-visible:outline-2 focus-visible:outline-paper-strong focus-visible:outline-offset-1`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
