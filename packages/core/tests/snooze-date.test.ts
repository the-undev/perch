import { beforeAll, describe, expect, it } from "vitest";
import {
  hasSnoozeEnded,
  type SnoozeDuration,
  snoozeEndDate,
  snoozeWords,
} from "../src/snooze-date.ts";

beforeAll(() => {
  process.env.TZ = "Europe/London";
});

const local = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
) => new Date(year, month - 1, day, hour, minute);

describe("snoozeEndDate", () => {
  const cases: [SnoozeDuration, string][] = [
    ["1 day", "2026-03-11"],
    ["3 days", "2026-03-13"],
    ["1 week", "2026-03-17"],
    ["2 weeks", "2026-03-24"],
    ["1 month", "2026-04-10"],
  ];
  it.each(cases)("%s from 10 March 2026 ends on %s", (duration, expected) => {
    expect(snoozeEndDate(duration, local(2026, 3, 10, 15, 30))).toBe(expected);
  });

  it("gives a valid date for a month added to the 31st", () => {
    expect(snoozeEndDate("1 month", local(2026, 1, 31))).toBe("2026-02-28");
    expect(snoozeEndDate("1 month", local(2028, 1, 31))).toBe("2028-02-29");
  });
});

describe("hasSnoozeEnded", () => {
  it("has not ended the moment before the end date starts", () => {
    expect(hasSnoozeEnded("2026-03-12", local(2026, 3, 11, 23, 59))).toBe(
      false,
    );
  });

  it("has ended at the start of the end date", () => {
    expect(hasSnoozeEnded("2026-03-12", local(2026, 3, 12, 0, 0))).toBe(true);
  });

  it("has ended after the end date", () => {
    expect(hasSnoozeEnded("2026-03-12", local(2026, 3, 20, 9, 0))).toBe(true);
  });

  it("holds on the day the clocks go forward", () => {
    // 29 March 2026: 01:00 GMT becomes 02:00 BST.
    expect(hasSnoozeEnded("2026-03-29", local(2026, 3, 28, 23, 59))).toBe(
      false,
    );
    expect(hasSnoozeEnded("2026-03-29", local(2026, 3, 29, 0, 0))).toBe(true);
  });

  it("holds on the day the clocks go back", () => {
    // 25 October 2026: 02:00 BST becomes 01:00 GMT.
    expect(hasSnoozeEnded("2026-10-25", local(2026, 10, 24, 23, 59))).toBe(
      false,
    );
    expect(hasSnoozeEnded("2026-10-25", local(2026, 10, 25, 0, 0))).toBe(true);
  });

  it("never ends when indefinite", () => {
    expect(hasSnoozeEnded(null, local(2999, 1, 1))).toBe(false);
  });
});

describe("snoozeWords", () => {
  const today = local(2026, 11, 20, 10, 0); // a Friday

  it("names the weekday within six days", () => {
    expect(snoozeWords("2026-11-21", today)).toBe("until Saturday");
    expect(snoozeWords("2026-11-26", today)).toBe("until Thursday");
  });

  it("gives day and month from seven days", () => {
    expect(snoozeWords("2026-11-27", today)).toBe("until 27 November");
    expect(snoozeWords("2026-12-04", today)).toBe("until 4 December");
  });

  it("says until you wake it when indefinite", () => {
    expect(snoozeWords(null, today)).toBe("until you wake it");
  });
});
