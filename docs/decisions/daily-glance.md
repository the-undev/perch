# Daily glance

What the top-level view answers in a ten-second look each morning.

Status: open

## Decided so far

Decided 20 October 2026.

- The glance is high-level status of everything, not detail.
- Each project shows one derived work-state from git, roughly three tiers:
  - Settled: everything on main and pushed to the remote.
  - In progress: local branches or unpushed local commits exist.
  - Active edits: uncommitted changes in the working copy.
  The tier names above are placeholders, not chosen.
- The home server (Silo) shows one aggregate light derived from
  Uptime Kuma: all green or not. Not per service.
- Start simple and add, rather than building every source out first.
- Each project aggregates everything known about it into one overall status
  (green, amber, red), with specific sub-statuses beneath it: work-item
  counts by kind (bugs coloured when nonzero), the git work-state, CI. The
  tile shows the overall status and the sub-statuses that are nonzero; the
  full work-item list lives in drill-down.

- Health and activity are separate axes, both on the tile. Decided
  20 October 2026. Health is the green, amber, red status: red for something
  wrong (failing CI, open bugs), amber for drift (changes or unpushed work
  older than a threshold), green for settled or healthily active. Activity is
  the git work-state, shown neutrally. Edits from yesterday are normal;
  untouched changes from weeks ago are a health problem, so drift is judged
  by age, not existence.
- How a tile shows two axes at once without muddle is a mockup question, not
  decided here. Candidates to try: two colour areas per tile.

- Drift thresholds are config-driven: global defaults of 7 days for amber and
  30 for red, overridable per project. Starting values, expected to be tuned
  against real tiles. Decided 20 October 2026. Refined 22 October 2026 in
  [data-placement](data-placement.md): unsafe work ages on 24 and 72 hour
  windows, stalled flight and unmet expectations on 7 and 30 days.

## Open

Nothing. The tile layout itself is a mockup question, tracked above.
- Whether an LLM-derived summary ever joins the glance. Parked; needs the
  base to exist first.
