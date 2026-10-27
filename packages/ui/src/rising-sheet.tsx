// The rising sheet: a layer that slides up over whatever shares its grid and folds away when
// dismissed. It owns the whole contract: the slide, the leave, and the three ways out. The layer is
// transparent and spans every row of the caller's grid; the children are the surface, which rises
// in the last row and sets its own width, centred.
//
// Presentational: the caller says whether the sheet is `shown` and what a dismissal does. What the
// sheet covers, and how that dims, is the caller's.

import { type ReactNode, useEffect, useRef, useState } from "react";

/** How long a closing sheet stays mounted, a little over its 260ms exit. */
const leaveMs = 300;

export interface RisingSheetProps {
  /** Whether the sheet is risen; false slides it away, inert, and then unmounts it. */
  shown: boolean;
  /** A press on the background, or Escape inside the sheet, asked to fold it; nothing is written. */
  onDismiss: () => void;
  /** The surface that rises, which sets its own width. */
  children: ReactNode;
}

/**
 * A transparent layer over every row of the caller's grid, its rows a subgrid of them. A press
 * anywhere on it off the surface dismisses, so what it covers rests while it is up. It mounts shut
 * and rises once painted, decelerating over 420ms; on closing it falls faster, accelerating over
 * 260ms, inert and hidden from assistive technology, before it unmounts. A reduced-motion reader
 * gets no transition, only the same timing. Escape pressed inside it is
 * contained, so the page beneath never hears it; a child that handles Escape itself stops the key
 * first and the sheet defers. Focus is part of the contract: rising moves it into the sheet unless
 * a child already holds it, and dismissing returns it to the element that held it, so the page's
 * own Escape still works from there. Neither focus call scrolls, since the surface starts below
 * its row. In a row of fixed height the surface stops at the row's foot and scrolls its own
 * contents; in a row of open height the row grows to the taller of the sheet and what it covers.
 */
export function RisingSheet({ shown, onDismiss, children }: RisingSheetProps) {
  const [mounted, setMounted] = useState(shown);
  const [up, setUp] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  if (shown && !mounted) setMounted(true);
  useEffect(() => {
    if (!shown) {
      openerRef.current?.focus({ preventScroll: true });
      openerRef.current = null;
      setUp(false);
      const timer = setTimeout(() => setMounted(false), leaveMs);
      return () => clearTimeout(timer);
    }
    surfaceRef.current?.getBoundingClientRect();
    const held = document.activeElement;
    if (held instanceof HTMLElement && held !== document.body) {
      openerRef.current = held;
    }
    if (!surfaceRef.current?.contains(held)) {
      surfaceRef.current?.focus({ preventScroll: true });
    }
    setUp(true);
  }, [shown]);
  if (!mounted) return null;
  return (
    <div
      data-part="rising-sheet"
      inert={!shown}
      aria-hidden={!shown}
      className="z-10 col-start-1 row-span-full grid min-h-0 grid-cols-1 grid-rows-subgrid items-start"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onDismiss();
      }}
    >
      <div
        data-part="rising-sheet-background"
        aria-hidden="true"
        className="col-start-1 row-span-full h-full"
        onClick={onDismiss}
      />
      <div
        ref={surfaceRef}
        data-part="rising-sheet-surface"
        tabIndex={-1}
        className={`pane-scroll col-start-1 row-[-2/-1] max-h-full w-full max-w-155 justify-self-center overflow-y-auto rounded-[10px] shadow-papers-rise outline-none motion-safe:transition-transform ${up ? "translate-y-0 motion-safe:duration-420 motion-safe:ease-[cubic-bezier(0.3,1,0.4,1)]" : "translate-y-[103%] motion-safe:duration-260 motion-safe:ease-[cubic-bezier(0.55,0,0.8,0.4)]"}`}
      >
        {children}
      </div>
    </div>
  );
}
