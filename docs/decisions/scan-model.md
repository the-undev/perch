# Scan model

How data reaches the screen. Two paths with one rule.

Status: open

## Decided so far

Decided 20 October 2026.

- **The scan feeds the glance.** Anything behind a tile's colour or counts
  runs in the periodic, unattended scan: git state, roadmap parsing, forge
  PRs and CI, the Uptime Kuma aggregate, Claude session times. The latest
  scan is cached to disk so the window opens with content; a failing source
  keeps its last result and shows the error and its age. Unattended means no
  route that can prompt, which keeps SSH out of the scanner.
- **Detail views may fetch live.** Data only ever read inside a detail view
  needs no cache or timer; the view fetches it when opened and shows it
  fresh. The owner is present, so a prompt or a moment's wait is
  acceptable.
- Opening the window never blocks on aggregation. The glance renders
  instantly from the cached snapshot; live data loads inside its own panel
  after, never as a whole-view spinner. Live suits services and running
  things; everything aggregated stays polled. Polled and live are two
  source kinds in the code, an abstraction the scanner PoC and mockups are
  expected to prove or reshape. Decided 20 October 2026.
- The first live source: the server page fetches the Docker container list
  with names and states from a Docker socket proxy already running on
  Silo, read only over HTTP.
- Container controls (stop, restart, the server's update) are parked with the
  other mutations in the roadmap. The named route when they unpark: SSH to
  Silo for stop and restart, the server's own API for update, with its
  actual capabilities verified then.

## Open

- The scan interval default, and measuring the cost of a full scan before
  choosing it.
- Whether scan-on-window-focus stays from the old spec (likely yes, it is
  cheap and makes the glance current when summoned).
