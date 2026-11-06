import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { type FetchJson, HttpStatusError, NoAnswerError } from "../src/http.ts";
import {
  checkGapMs,
  createReleaseChecker,
  latestReleaseUrl,
  newerVersion,
  type ReleaseCheck,
  readLatestRelease,
} from "../src/update.ts";

const fixturePath = join(
  import.meta.dirname,
  "fixtures",
  "releases",
  "latest.json",
);

async function latestFixture(): Promise<unknown> {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

/** A fetch that answers the latest release with the fixture, the tag replaced when given. */
function releaseFetch(tag?: string): FetchJson & { urls: string[] } {
  const urls: string[] = [];
  const fetch = async (url: string) => {
    urls.push(url);
    const body = (await latestFixture()) as Record<string, unknown>;
    return tag === undefined ? body : { ...body, tag_name: tag };
  };
  return Object.assign(fetch, { urls });
}

/** A clock the test moves by hand. */
function fakeClock(start: string) {
  let at = Date.parse(start);
  return {
    now: () => new Date(at),
    pass: (ms: number) => {
      at += ms;
    },
  };
}

describe("comparing the latest release with the running version", () => {
  it("names a newer tag's version without its v", () => {
    expect(newerVersion("v0.3.0", "0.2.0")).toBe("0.3.0");
    expect(newerVersion("0.3.0", "0.2.9")).toBe("0.3.0");
    expect(newerVersion("v1.0.0", "0.10.4")).toBe("1.0.0");
  });

  it("finds nothing newer in an equal or older tag", () => {
    expect(newerVersion("v0.2.0", "0.2.0")).toBeNull();
    expect(newerVersion("v0.1.9", "0.2.0")).toBeNull();
    expect(newerVersion("v0.2.0", "0.10.0")).toBeNull();
  });

  it("puts a prerelease running version before its release and after the one before", () => {
    expect(newerVersion("v0.3.0", "0.3.0-dev")).toBe("0.3.0");
    expect(newerVersion("v0.2.0", "0.3.0-dev")).toBeNull();
  });

  it("refuses a tag or a running version that is not a version", () => {
    expect(() => newerVersion("nightly", "0.2.0")).toThrow(
      "the latest release's tag nightly is not a version",
    );
    expect(() => newerVersion("v0.3.0", "dev")).toThrow(
      "the running version dev is not a version",
    );
  });
});

describe("reading the latest release", () => {
  it("asks GitHub for the-undev/perch's latest release without a token", async () => {
    const headers: Record<string, string>[] = [];
    const fetch: FetchJson = async (_url, sent) => {
      headers.push(sent);
      return latestFixture();
    };

    await readLatestRelease(fetch, "0.2.0");

    expect(latestReleaseUrl).toBe(
      "https://api.github.com/repos/the-undev/perch/releases/latest",
    );
    expect(headers[0]).not.toHaveProperty("Authorization");
  });

  it("returns a newer release's version and page, and null when it is not newer", async () => {
    expect(await readLatestRelease(releaseFetch(), "0.2.0")).toEqual({
      version: "0.3.0",
      url: "https://github.com/the-undev/perch/releases/tag/v0.3.0",
    });
    expect(await readLatestRelease(releaseFetch(), "0.3.0")).toBeNull();
  });
});

describe("the release checker", () => {
  function checker(
    fetchJson: FetchJson,
    clock = fakeClock("2026-11-06T09:00:00Z"),
  ) {
    const changes: ReleaseCheck[] = [];
    const made = createReleaseChecker({
      fetchJson,
      running: "0.2.0",
      now: clock.now,
      onChange: (check) => changes.push(check),
    });
    return { checker: made, changes, clock };
  }

  it("starts knowing nothing", () => {
    expect(checker(releaseFetch()).checker.state()).toEqual({
      release: null,
      checkedAt: null,
      failure: null,
      checking: false,
    });
  });

  it("says it is checking, then what the answer named and when", async () => {
    const { checker: made, changes } = checker(releaseFetch());

    await made.checkIfDue();

    expect(changes[0]?.checking).toBe(true);
    expect(made.state()).toEqual({
      release: {
        version: "0.3.0",
        url: "https://github.com/the-undev/perch/releases/tag/v0.3.0",
      },
      checkedAt: "2026-11-06T09:00:00.000Z",
      failure: null,
      checking: false,
    });
  });

  it("checks at most hourly on the scan cycle, whatever the interval", async () => {
    const fetch = releaseFetch();
    const { checker: made, clock } = checker(fetch);

    await made.checkIfDue();
    clock.pass(15 * 60_000);
    await made.checkIfDue();
    clock.pass(checkGapMs - 15 * 60_000 - 1);
    await made.checkIfDue();
    expect(fetch.urls).toHaveLength(1);

    clock.pass(1);
    await made.checkIfDue();
    expect(fetch.urls).toHaveLength(2);
  });

  it("checks now whatever the hour, and joins a check already running", async () => {
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          answer = resolve;
        }),
    );
    const { checker: made } = checker(fetch);

    const first = made.checkNow();
    const joined = made.checkNow();
    const due = made.checkIfDue();
    answer(await latestFixture());
    await Promise.all([first, joined, due]);
    expect(fetch).toHaveBeenCalledOnce();

    const again = made.checkNow();
    answer(await latestFixture());
    await again;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the last answer through a failed check and says why it failed", async () => {
    let failWith: Error | null = null;
    const fetch: FetchJson = async (url) => {
      if (failWith !== null) throw failWith;
      return releaseFetch()(url, {});
    };
    const { checker: made, clock } = checker(fetch);
    await made.checkNow();
    const answered = made.state();

    clock.pass(checkGapMs);
    failWith = new NoAnswerError(latestReleaseUrl, {
      cause: new Error("ECONNREFUSED"),
    });
    await made.checkIfDue();

    expect(made.state()).toEqual({
      ...answered,
      failure: "api.github.com did not answer",
    });

    failWith = new HttpStatusError(latestReleaseUrl, 403);
    await made.checkNow();
    expect(made.state().failure).toBe("api.github.com answered HTTP 403");
    expect(made.state().release).toEqual(answered.release);

    failWith = null;
    await made.checkNow();
    expect(made.state().failure).toBeNull();
  });

  it("waits the hour after a failed check too, rather than retrying each scan", async () => {
    let calls = 0;
    const fetch: FetchJson = async () => {
      calls += 1;
      throw new HttpStatusError(latestReleaseUrl, 500);
    };
    const { checker: made, clock } = checker(fetch);

    await made.checkIfDue();
    clock.pass(checkGapMs - 1);
    await made.checkIfDue();

    expect(calls).toBe(1);
  });

  it("fails a tag that is not a version, naming it", async () => {
    const { checker: made } = checker(releaseFetch("nightly"));

    await made.checkNow();

    expect(made.state().failure).toBe(
      "the latest release's tag nightly is not a version",
    );
  });
});
