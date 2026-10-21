import { SourceFailure } from "../failure.ts";
import { errorMessage } from "../fs.ts";
import type { FetchJson } from "../http.ts";
import { asArray, asRecord, numberField, stringField } from "../json.ts";
import type { RawEntries, RawHeartbeat, RawKuma, RawMonitor } from "../raw.ts";
import type { PolledSource } from "./source.ts";

export interface KumaSourceDeps {
  fetchJson: FetchJson;
  baseUrl: string;
  statusPage: string;
}

function readHeartbeats(value: unknown): RawHeartbeat[] {
  if (value === undefined) return [];
  return asArray(value, "heartbeats").map((beat) => {
    const record = asRecord(beat, "heartbeat");
    return {
      status: numberField(record, "status"),
      time: stringField(record, "time"),
      message: typeof record.msg === "string" ? record.msg : "",
    };
  });
}

/** Reads the monitors on an Uptime Kuma status page with their heartbeats. */
export async function readStatusPage(deps: KumaSourceDeps): Promise<RawKuma> {
  const slug = encodeURIComponent(deps.statusPage);
  const headers = { Accept: "application/json" };
  const [page, heartbeat] = await Promise.all([
    deps.fetchJson(`${deps.baseUrl}/api/status-page/${slug}`, headers),
    deps.fetchJson(
      `${deps.baseUrl}/api/status-page/heartbeat/${slug}`,
      headers,
    ),
  ]);
  const heartbeatList = asRecord(
    asRecord(heartbeat, "heartbeat").heartbeatList,
    "heartbeatList",
  );
  const groups = asArray(
    asRecord(page, "status page").publicGroupList,
    "publicGroupList",
  );
  const monitors: RawMonitor[] = groups.flatMap((group) => {
    const groupRecord = asRecord(group, "group");
    const groupName =
      typeof groupRecord.name === "string" ? groupRecord.name : "";
    return asArray(groupRecord.monitorList, "monitorList").map((monitor) => {
      const record = asRecord(monitor, "monitor");
      const id = numberField(record, "id");
      return {
        id,
        name: stringField(record, "name"),
        group: groupName,
        heartbeats: readHeartbeats(heartbeatList[String(id)]),
      };
    });
  });
  return { statusPage: deps.statusPage, monitors };
}

/** Reads the configured Uptime Kuma status page for the server item. */
export function createKumaSource(deps: KumaSourceDeps): PolledSource<"kuma"> {
  return {
    name: "kuma",
    async gather(items) {
      const servers = items.filter((item) => item.kind === "server");
      if (servers.length === 0) return {};
      const page = await readStatusPage(deps).catch((error: unknown) => {
        throw new SourceFailure("request-failed", errorMessage(error));
      });
      const entries: Record<string, RawEntries["kuma"]> = {};
      for (const server of servers)
        entries[server.id] = { state: "observed", value: page };
      return entries;
    },
  };
}
