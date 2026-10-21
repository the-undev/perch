# Visual design

What perch looks and feels like. Most of this is settled by mockups, not
prose; this file holds the constraints the mockups work within.

Status: open

## Decided so far

Decided 20 October 2026.

- Not another shadcn dashboard. shadcn is used for basics and form controls
  (settings, dialogs), but the dashboard itself, tiles, glance view,
  drill-down, has its own visual identity and is not tethered to shadcn's
  card-and-sidebar SaaS look.
- Fancy, smooth, tastefully animated, consistent. The owner looks at it
  every day; it should be exciting rather than corporate.
- Importance may drive visual weight, see [grouping](grouping.md), and a
  tile must show health and activity as separate axes, see
  [daily-glance](daily-glance.md). Both are mockup problems.

## Round one verdicts, 21 October 2026

Three divergent mockups (control room, shelf, briefing) ran on real scan
data. Verdicts from the owner's reactions:

- Dark theme, but warm and not harsh; the shelf's card materiality on a
  dark ground is the keeper. No glow or blur; crisp edges.
- The main dashboard view never scrolls. It summarises by priority band
  rather than enumerating: top tier large, projects compact, the rest
  collapsed.
- Priority grouping is central: machine and home IT (dotfiles, config,
  vaults, monitoring) outrank other projects.
- Red must be rare to mean anything. Not-set-up repos are triage, not ill
  health: one summary element, never twenty red tiles.
- Detail opens as a full takeover that morphs out of the clicked card; a
  side drawer is not enough.
- Two views with different jobs: the overview (everything at a glance,
  priority order, one screen) and a projects view (browse and drill down,
  agenda-like; the briefing's format lives on here).

## Round two verdicts, 21 October 2026

Overview (one-screen bands), Projects (master-detail rail) and Tabs ran in
one shared warm-dark language. Verdicts:

- The band separation and the one-screen rule hold. Subtle gradients and
  quiet colour dots are right; the whole thing is easy on the eyes.
- The brown base is not liked. Keep the softness, change the hue.
- The Projects master-detail shell won: the rail with dots and category
  groups, unadopted things present but dimmed, a full pane for detail.
- Tabs rejected: categories behind clicks means work to see everything.
  The rail shows the whole inventory at once; nothing should hide.
- Statuses are not yet clear or intuitive; the colours need visible words
  and a legend, and health must not share one dot with activity.
- The top band sized itself too tall; bands size to content.
- Detail type runs small; the detail view earns a larger scale.
- Target synthesis: the Projects shell with the one-screen Overview as its
  home entry, selected at launch. Glance without clicking, one click to
  any detail.

## Round three verdicts, 21 October 2026

The revised shell (ink palette, restored hierarchy, stat tiles, iconed
actions, tooltips, display names) and the aviary opposite (projects as
birds on wires: wire height priority, bird size tier, breast colour
health, the unadopted on the fence).

- Shell II approved as the working structure; ink palette chosen.
- The shell's overview page still reads cluttered, small and not high
  level enough. Next idea: aggregate per category rather than per project.
- The aviary landed ("holy shit lol i love that"): the wanted visual
  direction is exactly not a standard admin dashboard. Iterate on it and
  explore neighbouring ideas; size and position carry real meaning.
- Aviary defects: content renders off screen; the fixed-aspect viewBox
  crops. Layout must compute from the real window and redraw on resize.

## Open

- Aviary iteration: responsive layout, meaning for size and position,
  per-wire summaries. Explore whether the aviary becomes the overview
  with the shell's pane as the detail layer beneath it.
- The shell overview as per-category aggregates, next shell round.
