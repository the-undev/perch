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

## Aviary II notes, 21 October 2026

Size variation too narrow; left-equals-trouble confirmed worth keeping and
naming; the fence row is illegible (cut text, overlap, low contrast); the
moon's crescent is misaligned; more stars wanted; a live time-of-day scene
is worth exploring; motion stays subtle, with bigger or unhealthier birds
allowed slightly more movement. The open question: how this scene
transitions into the Shell II detail world, tested next by zooming a bird
into a full shell-style detail view.

## Aviary III and IV notes, 21 October 2026

III landed the live scene but letterboxed: the viewBox height clamp broke
the window's aspect, cutting the top and floating the fence. IV replaced
the click-to-detail jump with a speech bubble from the beak, the project's
status in the first person with fact chips and launch actions, and a
button through to the zoomed detail. Verdicts:

- The speech bubbles are liked. A bird-click means "what's up with you?",
  so the bubble carries the high-level detail; the full page is a second,
  deliberate step.
- Possible structure: two centred tabs, the aviary as overview and the
  shell as the working view, with the bubble bridging them.
- Birds should look inwards: left half faces right, right half faces left.
- Arrival order should carry meaning: the reddest and plumpest land first.
- The sky-click phase preview surprised; a control must say what it does.
- The fence rail sits a fixed height from the bottom, posts short.
- The star field clustered into dashes: the weak string hash correlated
  sequential seeds. Scatter needs a real bit mixer.

## Open

- Aviary V carries the fixes above; verdict pending.
- Scene fixes from the field guide: the ♪ scales with the bird and
  rises just off the beak tip, not over the head; birds stand on the
  wire (the toes end 3 units below the origin, so the perch point is
  3 × scale above the wire line), where today the legs pass through
  it; legs end in little gripping toes; the bubble tail's tip meets
  the beak tip exactly.
- The two-tab structure (aviary overview, shell working view) is pending a
  proper test.
- The shell overview as per-category aggregates, if still needed once the
  aviary carries the overview.
