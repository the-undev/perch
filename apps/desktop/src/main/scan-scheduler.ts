// When scans run: once at start, then on the config's interval after each one finishes, on window
// focus and on request. One scan at a time; a request while one runs joins it.

export interface ScanSchedulerDeps {
  /** One whole scan; it records its own failures. */
  scan: () => Promise<void>;
  /** The wait after a scan before the next timed one, read afresh after every scan. */
  intervalMs: () => number;
  /** A focus asks for a scan only once this long has passed since the last one finished. */
  focusGapMs: number;
  now: () => number;
  /** Told when a scan starts and when it finishes. */
  onScanning: (scanning: boolean) => void;
}

export interface ScanScheduler {
  /** Scans now and starts the timer. */
  start(): void;
  /** Scans now, or joins the scan already running; resolves when that scan finishes. */
  request(): Promise<void>;
  /** The window gained focus. */
  focused(): void;
  /** Stops the timer; a running scan finishes. */
  stop(): void;
}

export function createScanScheduler(deps: ScanSchedulerDeps): ScanScheduler {
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastFinishedAt: number | null = null;
  let stopped = false;

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function schedule(): void {
    clearTimer();
    if (stopped) return;
    timer = setTimeout(() => void request(), deps.intervalMs());
  }

  function request(): Promise<void> {
    if (running !== null) return running;
    clearTimer();
    deps.onScanning(true);
    running = deps
      .scan()
      // The scan records its own failures; this keeps a stray rejection from ending the timer.
      .catch(() => {})
      .finally(() => {
        running = null;
        lastFinishedAt = deps.now();
        deps.onScanning(false);
        schedule();
      });
    return running;
  }

  return {
    start() {
      stopped = false;
      void request();
    },
    request,
    focused() {
      if (running !== null) return;
      if (
        lastFinishedAt !== null &&
        deps.now() - lastFinishedAt < deps.focusGapMs
      ) {
        return;
      }
      void request();
    },
    stop() {
      stopped = true;
      clearTimer();
    },
  };
}
