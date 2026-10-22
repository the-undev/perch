import { describe, expect, it } from "vitest";
import { deriveKuma } from "../src/derivations.ts";
import { SourceFailure } from "../src/failure.ts";
import type { FetchJson } from "../src/http.ts";
import type { RawKuma } from "../src/raw.ts";
import { createKumaSource } from "../src/sources/kuma.ts";

const base = "http://kuma.test";

function fetchFrom(responses: Record<string, unknown>): FetchJson {
  return async (url) => {
    if (!(url in responses)) throw new Error(`request to ${url} failed`);
    return responses[url];
  };
}

describe("gathering the kuma status page", () => {
  it("records each monitor with its group and heartbeats as returned", async () => {
    const source = createKumaSource({
      baseUrl: base,
      statusPage: "perch",
      fetchJson: fetchFrom({
        [`${base}/api/status-page/perch`]: {
          publicGroupList: [
            { name: "Media", monitorList: [{ id: 1, name: "Plex" }] },
            { name: "Infra", monitorList: [{ id: 3, name: "Forgejo" }] },
          ],
        },
        [`${base}/api/status-page/heartbeat/perch`]: {
          heartbeatList: {
            "1": [{ status: 1, time: "2026-10-21 08:01:00.000", msg: "" }],
          },
        },
      }),
    });

    const data = await source.gather({});

    expect(data).toEqual({
      statusPage: "perch",
      monitors: [
        {
          id: 1,
          name: "Plex",
          group: "Media",
          heartbeats: [
            { status: 1, time: "2026-10-21 08:01:00.000", message: "" },
          ],
        },
        { id: 3, name: "Forgejo", group: "Infra", heartbeats: [] },
      ],
    });
  });

  it("fails as a whole with request-failed when the page cannot be read", async () => {
    const source = createKumaSource({
      baseUrl: base,
      statusPage: "missing",
      fetchJson: fetchFrom({}),
    });

    const failure = await source.gather({}).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SourceFailure);
    expect((failure as SourceFailure).reason).toBe("request-failed");
  });
});

describe("deriving the server aggregate", () => {
  const monitor = (
    id: number,
    heartbeats: RawKuma["monitors"][number]["heartbeats"],
  ) => ({
    id,
    name: `m${id}`,
    group: "g",
    heartbeats,
  });

  it("uses each monitor's newest heartbeat and is all up only when every monitor is up", () => {
    const raw: RawKuma = {
      statusPage: "perch",
      monitors: [
        monitor(1, [
          { status: 1, time: "2026-10-21 08:01:00.000", message: "" },
          { status: 0, time: "2026-10-21 08:00:00.000", message: "" },
        ]),
        monitor(2, [
          { status: 0, time: "2026-10-21 08:01:00.000", message: "" },
        ]),
        monitor(3, []),
      ],
    };

    expect(deriveKuma(raw)).toEqual({
      allUp: false,
      monitors: [
        {
          id: 1,
          name: "m1",
          status: "up",
          lastHeartbeatAt: "2026-10-21 08:01:00.000",
        },
        {
          id: 2,
          name: "m2",
          status: "down",
          lastHeartbeatAt: "2026-10-21 08:01:00.000",
        },
        { id: 3, name: "m3", status: "unknown", lastHeartbeatAt: null },
      ],
    });
    expect(
      deriveKuma({
        statusPage: "perch",
        monitors: [raw.monitors[0] ?? monitor(9, [])],
      }).allUp,
    ).toBe(true);
    expect(deriveKuma({ statusPage: "perch", monitors: [] }).allUp).toBe(false);
  });
});
