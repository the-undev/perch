import type { KumaSourceConfig } from "../config.ts";
import { errorMessage } from "../fs.ts";
import type { FetchJson } from "../http.ts";
import { asArray, asRecord, numberField, stringField } from "../json.ts";
import type { Entry, RawHeartbeat, RawKuma, RawMonitor } from "../raw.ts";
import type { PolledSource } from "./source.ts";

export interface KumaSourceDeps {
  fetchJson: FetchJson;
  /** The configured status pages, at least one: with none the source does not run. */
  cards: KumaSourceConfig[];
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
export async function readStatusPage(
  fetchJson: FetchJson,
  card: KumaSourceConfig,
): Promise<RawKuma> {
  const slug = encodeURIComponent(card.statusPage);
  const headers = { Accept: "application/json" };
  const [page, heartbeat] = await Promise.all([
    fetchJson(`${card.baseUrl}/api/status-page/${slug}`, headers),
    fetchJson(`${card.baseUrl}/api/status-page/heartbeat/${slug}`, headers),
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
  return { statusPage: card.statusPage, monitors };
}

/** Root collector: reads each configured status page, keyed by its name; a page unread is its error. */
export function createKumaSource(deps: KumaSourceDeps): PolledSource<"kuma"> {
  return {
    name: "kuma",
    async gather() {
      const entries: Record<string, Entry<RawKuma, never>> = {};
      for (const card of deps.cards) {
        try {
          entries[card.name] = {
            state: "observed",
            value: await readStatusPage(deps.fetchJson, card),
          };
        } catch (error) {
          entries[card.name] = { state: "error", error: errorMessage(error) };
        }
      }
      return entries;
    },
  };
}
