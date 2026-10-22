import { useEffect, useState } from "react";

/** The clock, read again every tick, so the sky and every age follow it while the window is open. */
export function useNow(tickMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);
  return now;
}
