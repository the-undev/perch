import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createScanScheduler,
  type ScanSchedulerDeps,
} from "./scan-scheduler.ts";

const minute = 60_000;

/** A scan that finishes only when the test says so. */
function stubScan() {
  const finishers: (() => void)[] = [];
  const failers: ((error: Error) => void)[] = [];
  const scan = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        finishers.push(resolve);
        failers.push(reject);
      }),
  );
  return {
    scan,
    async finish() {
      finishers.shift()?.();
      failers.shift();
      await vi.advanceTimersByTimeAsync(0);
    },
    async fail() {
      finishers.shift();
      failers.shift()?.(new Error("disk gone"));
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

function scheduler(
  stub: ReturnType<typeof stubScan>,
  overrides: Partial<ScanSchedulerDeps> = {},
) {
  const scanning: boolean[] = [];
  const schedule = createScanScheduler({
    scan: stub.scan,
    hasConfig: () => true,
    recheck: vi.fn(async () => {}),
    intervalMs: () => 15 * minute,
    focusGapMs: minute,
    now: () => Date.now(),
    onScanning: (value) => scanning.push(value),
    ...overrides,
  });
  return { schedule, scanning };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the scan scheduler", () => {
  it("scans at start, then on the interval after each scan finishes", async () => {
    const stub = stubScan();
    const { schedule, scanning } = scheduler(stub);

    schedule.start();
    expect(stub.scan).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30 * minute);
    expect(stub.scan).toHaveBeenCalledTimes(1);

    await stub.finish();
    await vi.advanceTimersByTimeAsync(15 * minute - 1);
    expect(stub.scan).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(stub.scan).toHaveBeenCalledTimes(2);
    expect(scanning).toEqual([true, false, true]);
  });

  it("reads the interval afresh after every scan", async () => {
    const stub = stubScan();
    let interval = 15 * minute;
    const { schedule } = scheduler(stub, { intervalMs: () => interval });

    schedule.start();
    interval = 5 * minute;
    await stub.finish();
    await vi.advanceTimersByTimeAsync(5 * minute);

    expect(stub.scan).toHaveBeenCalledTimes(2);
  });

  it("coalesces requests made while a scan runs into that scan", async () => {
    const stub = stubScan();
    const { schedule } = scheduler(stub);
    schedule.start();

    const first = schedule.request();
    const second = schedule.request();
    schedule.focused();
    await stub.finish();
    await Promise.all([first, second]);

    expect(stub.scan).toHaveBeenCalledTimes(1);
  });

  it("restarts the interval from a requested scan", async () => {
    const stub = stubScan();
    const { schedule } = scheduler(stub);
    schedule.start();
    await stub.finish();

    await vi.advanceTimersByTimeAsync(10 * minute);
    void schedule.request();
    await stub.finish();
    await vi.advanceTimersByTimeAsync(10 * minute);
    expect(stub.scan).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5 * minute);
    expect(stub.scan).toHaveBeenCalledTimes(3);
  });

  it("scans on focus only once the gap since the last scan has passed", async () => {
    const stub = stubScan();
    const { schedule } = scheduler(stub);
    schedule.start();
    await stub.finish();

    schedule.focused();
    expect(stub.scan).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(minute);
    schedule.focused();
    expect(stub.scan).toHaveBeenCalledTimes(2);
  });

  it("keeps the timer running after a scan fails", async () => {
    const stub = stubScan();
    const { schedule, scanning } = scheduler(stub);
    schedule.start();

    await stub.fail();
    await vi.advanceTimersByTimeAsync(15 * minute);

    expect(stub.scan).toHaveBeenCalledTimes(2);
    expect(scanning).toEqual([true, false, true]);
  });

  it("stays idle in the no-config state", async () => {
    const stub = stubScan();
    const recheck = vi.fn(async () => {});
    const { schedule, scanning } = scheduler(stub, {
      hasConfig: () => false,
      recheck,
    });

    schedule.start();
    await vi.advanceTimersByTimeAsync(60 * minute);

    expect(stub.scan).not.toHaveBeenCalled();
    expect(recheck).not.toHaveBeenCalled();
    expect(scanning).toEqual([]);
  });

  it("rechecks the config on request and on every focus without config, and scans once it appears", async () => {
    const stub = stubScan();
    let exists = false;
    const recheck = vi.fn(async () => {});
    const { schedule } = scheduler(stub, { hasConfig: () => exists, recheck });
    schedule.start();

    await schedule.request();
    schedule.focused();
    schedule.focused();
    await vi.advanceTimersByTimeAsync(0);
    expect(recheck).toHaveBeenCalledTimes(3);
    expect(stub.scan).not.toHaveBeenCalled();

    recheck.mockImplementation(async () => {
      exists = true;
    });
    schedule.focused();
    await vi.advanceTimersByTimeAsync(0);
    expect(stub.scan).toHaveBeenCalledTimes(1);
    await stub.finish();
    await vi.advanceTimersByTimeAsync(15 * minute);
    expect(stub.scan).toHaveBeenCalledTimes(2);
  });

  it("stops the timer when a scan finds the config gone", async () => {
    const stub = stubScan();
    let exists = true;
    const { schedule } = scheduler(stub, { hasConfig: () => exists });
    schedule.start();

    exists = false;
    await stub.finish();
    await vi.advanceTimersByTimeAsync(60 * minute);

    expect(stub.scan).toHaveBeenCalledTimes(1);
  });

  it("stops the timer", async () => {
    const stub = stubScan();
    const { schedule } = scheduler(stub);
    schedule.start();
    await stub.finish();

    schedule.stop();
    await vi.advanceTimersByTimeAsync(60 * minute);

    expect(stub.scan).toHaveBeenCalledTimes(1);
  });
});
