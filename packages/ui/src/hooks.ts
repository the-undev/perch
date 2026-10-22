// Small browser hooks the composed views share: an element's measured size and the owner's
// reduced-motion preference.

import { type RefObject, useLayoutEffect, useState } from "react";

/** A size in CSS pixels. */
export interface PixelSize {
  width: number;
  height: number;
}

/**
 * The element's size, kept current as it resizes. Until the first measurement, and while the
 * element is hidden and measures nothing, it holds the last size it had, starting at `initial`.
 */
export function useElementSize(
  ref: RefObject<HTMLElement | null>,
  initial: PixelSize,
): PixelSize {
  const [size, setSize] = useState(initial);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

/** Whether the owner asks for reduced motion; the flights stay grounded when they do. */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () => window.matchMedia(reducedMotionQuery).matches,
  );
  useLayoutEffect(() => {
    const query = window.matchMedia(reducedMotionQuery);
    const update = () => setReduce(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduce;
}
