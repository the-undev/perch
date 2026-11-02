// Builders for snapshot-shaped data, for view model tests that never run a scan.

import type {
  AgedWork,
  ForgeData,
  GitData,
  HealthLevel,
  Item,
  Snapshot,
} from "../../src/snapshot.ts";

export const scannedAt = "2026-10-22T09:00:00.000Z";

/** A timestamp a number of hours before the scan. */
export function hoursBefore(hours: number): string {
  return new Date(Date.parse(scannedAt) - hours * 3_600_000).toISOString();
}

export function aged(hours: number, level: HealthLevel): AgedWork {
  return { since: hoursBefore(hours), hours, level };
}

export function gitData(overrides: Partial<GitData>): GitData {
  return {
    backup: "joined",
    branch: "main",
    defaultBranch: "main",
    upstream: "origin/main",
    uncommittedCount: 0,
    ahead: 0,
    behind: 0,
    unpushedCount: 0,
    lastCommitAt: hoursBefore(72),
    oldestUncommittedAt: null,
    oldestUnpushedAt: null,
    branches: [
      {
        name: "main",
        lastCommitAt: hoursBefore(72),
        subject: "Initial",
        upstream: "origin/main",
      },
    ],
    remotes: [
      {
        name: "origin",
        fetchUrl: "git@github.com:finch/perch.git",
        pushUrls: ["git@github.com:finch/perch.git"],
      },
    ],
    activity: "settled",
    drift: {
      uncommitted: null,
      unpushed: null,
      level: "green",
      thresholds: { amberHours: 24, redHours: 72 },
    },
    stall: null,
    ...overrides,
  };
}

export function forgeData(overrides: Partial<ForgeData>): ForgeData {
  return {
    fullName: "finch/perch",
    url: "https://github.com/finch/perch",
    defaultBranch: "main",
    openPullRequests: [],
    latestCi: null,
    finalisedCommits: [],
    ...overrides,
  };
}

/** An item with a local clone at /home/test/<id> and no sources unless given. */
export function item(id: string, overrides: Partial<Item> = {}): Item {
  const path = `/home/test/${id}`;
  return {
    id,
    name: id.slice(id.lastIndexOf("/") + 1),
    kind: "git",
    path,
    liveSources: [],
    presences: { local: { ref: `local:${id}`, path }, forges: [] },
    flags: [],
    sources: {},
    ...overrides,
  };
}

export function snapshotOf(items: Item[]): Snapshot {
  const ok = {
    state: "ok" as const,
    reason: null,
    error: null,
    lastSucceededAt: scannedAt,
    durationMs: 1,
  };
  return {
    scannedAt,
    durationMs: 1,
    aggregatedAt: scannedAt,
    configPath: "config.toml",
    warnings: [],
    conflicts: [],
    forges: {
      github: { active: [], archived: [] },
      forgejo: { active: [], archived: [] },
    },
    sources: {
      local: ok,
      githubAccounts: ok,
      forgejoAccounts: ok,
      roadmap: ok,
      claudeSessions: ok,
      github: ok,
      forgejo: ok,
      kuma: ok,
    },
    sourceCards: [],
    items,
  };
}
