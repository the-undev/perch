import type { FetchJson } from "../http.ts";
import {
  asArray,
  asRecord,
  numberField,
  optionalString,
  stringField,
} from "../json.ts";
import type { KumaData, Monitor, MonitorStatus } from "../snapshot.ts";
import type { PolledSource } from "./source.ts";

export interface KumaSourceDeps {
  fetchJson: FetchJson;
  baseUrl: string;
  statusPage: string;
}

const statusNames: Record<number, MonitorStatus> = {
  0: "down",
  1: "up",
  2: "pending",
  3: "maintenance",
};

function monitorsOnPage(page: unknown): { id: number; name: string }[] {
  const groups = asArray(
    asRecord(page, "status page").publicGroupList,
    "publicGroupList",
  );
  return groups.flatMap((group) =>
    asArray(asRecord(group, "group").monitorList, "monitorList").map(
      (monitor) => {
        const record = asRecord(monitor, "monitor");
        return {
          id: numberField(record, "id"),
          name: stringField(record, "name"),
        };
      },
    ),
  );
}

/** The newest heartbeat for a monitor; Kuma's time strings sort in time order. */
function newestHeartbeat(heartbeats: unknown): {
  status: MonitorStatus;
  time: string | null;
} {
  const beats = Array.isArray(heartbeats)
    ? heartbeats.map((beat) => asRecord(beat, "heartbeat"))
    : [];
  const newest = beats
    .slice()
    .sort((a, b) =>
      (optionalString(b, "time") ?? "").localeCompare(
        optionalString(a, "time") ?? "",
      ),
    )[0];
  if (newest === undefined) return { status: "unknown", time: null };
  const status = newest.status;
  return {
    status:
      typeof status === "number"
        ? (statusNames[status] ?? "unknown")
        : "unknown",
    time: optionalString(newest, "time"),
  };
}

/** Reads the Uptime Kuma status page into one aggregate for the server item. */
export async function readStatusPage(deps: KumaSourceDeps): Promise<KumaData> {
  const pageUrl = `${deps.baseUrl}/api/status-page/${encodeURIComponent(deps.statusPage)}`;
  const heartbeatUrl = `${deps.baseUrl}/api/status-page/heartbeat/${encodeURIComponent(deps.statusPage)}`;
  const headers = { Accept: "application/json" };
  const [page, heartbeat] = await Promise.all([
    deps.fetchJson(pageUrl, headers),
    deps.fetchJson(heartbeatUrl, headers),
  ]);
  const heartbeatList = asRecord(
    asRecord(heartbeat, "heartbeat").heartbeatList,
    "heartbeatList",
  );
  const monitors: Monitor[] = monitorsOnPage(page).map((monitor) => {
    const newest = newestHeartbeat(heartbeatList[String(monitor.id)]);
    return { ...monitor, status: newest.status, lastHeartbeatAt: newest.time };
  });
  return {
    allUp:
      monitors.length > 0 &&
      monitors.every((monitor) => monitor.status === "up"),
    monitors,
  };
}

/** The server aggregate: all monitors on the configured status page up, or not. */
export function createKumaSource(deps: KumaSourceDeps): PolledSource<"kuma"> {
  return {
    name: "kuma",
    async scan(items) {
      const servers = items.filter((item) => item.kind === "server");
      if (servers.length === 0) return new Map();
      const data = await readStatusPage(deps);
      return new Map(servers.map((server) => [server.id, data]));
    },
  };
}
