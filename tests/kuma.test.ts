import { describe, expect, it } from "vitest";
import type { FetchJson } from "../src/http.ts";
import type { Item } from "../src/snapshot.ts";
import { createKumaSource } from "../src/sources/kuma.ts";

const base = "http://kuma.test";
const server: Item = {
  id: "server",
  name: "Silo",
  kind: "server",
  path: null,
  importance: "projects",
  liveSources: [],
  sources: {},
};

function fetchFrom(responses: Record<string, unknown>): FetchJson {
  return async (url) => {
    if (!(url in responses)) throw new Error(`request to ${url} failed`);
    return responses[url];
  };
}

const page = {
  publicGroupList: [
    {
      name: "Media",
      monitorList: [
        { id: 1, name: "Plex" },
        { id: 2, name: "Downloads" },
      ],
    },
    { name: "Infra", monitorList: [{ id: 3, name: "Forgejo" }] },
  ],
};

describe("kuma source", () => {
  it("aggregates the newest heartbeat of every monitor on the status page", async () => {
    const source = createKumaSource({
      baseUrl: base,
      statusPage: "perch",
      fetchJson: fetchFrom({
        [`${base}/api/status-page/perch`]: page,
        [`${base}/api/status-page/heartbeat/perch`]: {
          heartbeatList: {
            "1": [
              { status: 0, time: "2026-10-21 08:00:00.000" },
              { status: 1, time: "2026-10-21 08:01:00.000" },
            ],
            "2": [{ status: 0, time: "2026-10-21 08:01:00.000" }],
          },
        },
      }),
    });

    const results = await source.scan([server]);

    expect(results.get("server")).toEqual({
      allUp: false,
      monitors: [
        {
          id: 1,
          name: "Plex",
          status: "up",
          lastHeartbeatAt: "2026-10-21 08:01:00.000",
        },
        {
          id: 2,
          name: "Downloads",
          status: "down",
          lastHeartbeatAt: "2026-10-21 08:01:00.000",
        },
        { id: 3, name: "Forgejo", status: "unknown", lastHeartbeatAt: null },
      ],
    });
  });

  it("is all up only when every monitor is up", async () => {
    const source = createKumaSource({
      baseUrl: base,
      statusPage: "perch",
      fetchJson: fetchFrom({
        [`${base}/api/status-page/perch`]: {
          publicGroupList: [page.publicGroupList[1]],
        },
        [`${base}/api/status-page/heartbeat/perch`]: {
          heartbeatList: {
            "3": [{ status: 1, time: "2026-10-21 08:01:00.000" }],
          },
        },
      }),
    });

    expect((await source.scan([server])).get("server")).toMatchObject({
      allUp: true,
    });
  });

  it("fails as a whole when the status page cannot be read", async () => {
    const source = createKumaSource({
      baseUrl: base,
      statusPage: "missing",
      fetchJson: fetchFrom({}),
    });

    await expect(source.scan([server])).rejects.toThrow(/request to .* failed/);
  });
});
