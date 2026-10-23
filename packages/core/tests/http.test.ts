import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFetchJson,
  HttpStatusError,
  NoAnswerError,
} from "../src/http.ts";

afterEach(() => vi.unstubAllGlobals());

const url = "https://forge.example.lan/api/v1/user/repos";

/** What a fetch rejected with; fails the test when it resolved. */
async function rejection(fetching: Promise<unknown>): Promise<Error> {
  try {
    await fetching;
  } catch (error) {
    return error as Error;
  }
  throw new Error("the fetch resolved");
}

describe("fetching JSON", () => {
  it("resolves with the parsed body of a 2xx answer", async () => {
    vi.stubGlobal("fetch", async () => Response.json([{ id: 1 }]));

    expect(await createFetchJson(1000)(url, {})).toEqual([{ id: 1 }]);
  });

  it("rejects a status outside 2xx with the status it answered", async () => {
    vi.stubGlobal("fetch", async () => new Response("no", { status: 401 }));

    const error = await rejection(createFetchJson(1000)(url, {}));

    expect(error).toBeInstanceOf(HttpStatusError);
    expect(error).toMatchObject({ status: 401, url });
    expect(error.message).toBe(`HTTP 401 from ${url}`);
  });

  it("rejects a request with no answer as such", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    const error = await rejection(createFetchJson(1000)(url, {}));

    expect(error).toBeInstanceOf(NoAnswerError);
    expect(error.message).toBe(`request to ${url} failed`);
  });
});
