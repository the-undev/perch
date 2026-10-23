// When scans run: once at start, then on the config's interval after each one finishes, on window
// focus and on request. One scan at a time; a request while one runs joins it. Without a config
// file nothing scans and no timer runs; a request or a focus reads the config path again instead,
// and scans once it finds the file.

export interface ScanSchedulerDeps {
  /** One whole scan; it records its own failures. */
  scan: () => Promise<void>;
  /** Whether the config file exists, as last read. */
  hasConfig: () => boolean;
  /** Reads the config path again, without scanning. */
  recheck: () => Promise<void>;
  /** The wait after a scan before the next timed one, read afresh after every scan. */
  intervalMs: () => number;
  /** A focus asks for a scan only once this long has passed since the last one finished. */
  focusGapMs: number;
  now: () => number;
  /** Told when a scan starts and when it finishes. */
  onScanning: (scanning: boolean) => void;
}

export interface ScanScheduler {
  /** Scans now and starts the timer; without config it waits for a request or a focus. */
  start(): void;
  /**
   * Scans now, or joins the scan already running; resolves when that scan finishes. Without
   * config it reads the config path again first, and scans only if the file is there.
   */
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
    if (stopped || !deps.hasConfig()) return;
    timer = setTimeout(() => void request(), deps.intervalMs());
  }

  function scanNow(): Promise<void> {
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

  async function request(): Promise<void> {
    if (running !== null) return running;
    if (deps.hasConfig()) return scanNow();
    await deps.recheck();
    if (!deps.hasConfig()) return;
    return running ?? scanNow();
  }

  return {
    start() {
      stopped = false;
      if (deps.hasConfig()) void scanNow();
    },
    request,
    focused() {
      if (running !== null) return;
      // Without config a focus always rechecks: reading one file costs nothing.
      if (
        deps.hasConfig() &&
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
