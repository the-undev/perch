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
- The polled path is two stages. Gathering writes raw observed facts, one
  file per source, with no thresholds, ages or judgements, and every absent
  value carrying an explicit reason rather than a bare null. Aggregation
  reads those files and is the only place derived values (drift days,
  health levels, activity states) are computed, with the rules written
  down. Raw files are reviewable on their own, and a derivation rule can
  change without re-reading the machine. Decided 21 October 2026.
- The first live source: the server page fetches the Docker container list
  with names and states from a Docker socket proxy already running on
  Silo, read only over HTTP.
- Container controls (stop, restart, the server's update) are parked with the
  other mutations in the roadmap. The named route when they unpark: SSH to
  Silo for stop and restart, the server's own API for update, with its
  actual capabilities verified then.

- Not everything refreshes at one cadence. Archived forge repos change
  rarely, so they sit in a slower lane with their own interval; the config
  carries both intervals. Decided 21 October 2026.
- The periodic scan runs inside the Electron main process on a timer while
  the app runs in the tray. There is no separate service or systemd unit to
  install. Wiring it is a later build phase. Decided 22 October 2026.

## Open

- The scan interval defaults for both lanes, and measuring the cost of a
  full scan before choosing them.
- Whether scan-on-window-focus stays from the old spec (likely yes, it is
  cheap and makes the glance current when summoned).
