# Sources and priority

Which sources perch reads, and which items within them get a tile.

Status: open

## Decided so far

- Repositories under `archived`, `third-party` and `delete` folders are
  excluded entirely: not scanned, no tile, no config toggle. Decided
  20 October 2026. This reverses the spec's default-on choice.

- The home server (Silo) is a source: one aggregate status derived
  from Uptime Kuma, see [daily-glance](daily-glance.md). This replaces the
  spec's link-to-dashboard tile.

- The v1 sources, decided 20 October 2026: projects with git state, work
  items from roadmap files, GitHub and Forgejo pull requests and CI, the
  Uptime Kuma aggregate, and the last Claude Code session time per project.
- Steam and gaming are parked. Cheap to add later (local files, no network)
  but they contribute nothing to health or work state.

## Open

- The top-level `~/dev` repositories need a review pass with the owner: many
  are not wanted. Do this before the first real scan config is written.
- How the scanner reads Uptime Kuma: its API, a status page, or its
  Prometheus endpoint. `TBD`, check what the instance exposes.
