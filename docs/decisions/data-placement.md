# Data placement

What each altitude of the app displays, decided top down: first what
each level exists to answer, then what aggregates serve those answers,
then how each aggregate computes from the raw data. The bottom-up field
inventory lives in the atlas (`mockups/atlas.html`) and serves as
reference, not as the decision list. See
[bird-language](bird-language.md) for how the bird wears what it is
given.

Status: open, walk in progress

## The altitudes

- The scene: the aviary as a whole, read without clicking.
- The bird: one project's at-a-glance presence in the scene.
- The bubble: a clicked bird's spoken summary and fact chips.
- The detail page: one project, full depth, in the shell.
- Hidden: gathered and used in derivations, never displayed.

## Decisions

Decided 22 October 2026.

### The tiers

Perch deals in exactly three tiers above the project itself:

- A. The bird: colour, look, animation, position.
- B. The bubble: what the bird says when listened to.
- C. The detail page: the project in full.

### The glance questions

The six candidate questions, numbered for reference below:

1. Does anything need me, and which thing first?
2. Is anything at risk of loss (unpushed, unbacked-up, one disk)?
3. Where did I leave off, what was I last working on?
4. What is in flight (open PRs, running CI, active session)?
5. How much outstanding work is piled up, and where?
6. Is everything else quietly fine?

- The bird answers 1, 2 and 6.
- The bubble answers 1, 2 and 6 in more detail: listening to what the
  bird is trying to say.
- Everything else is the detail page's job.

### Loss risk folds into health

Question 2 surfaces through the health colour, not a separate trait (a
dedicated visual stays a bird-language open idea). Principles for the
derivation:

- Unhappiness from unsafe work grows with quantity and age combined.
  Fresh edits never alarm: new uncommitted work on an active project is
  a happy bird. What alarms is volume that has sat unsafe for a long
  time.
- The age anchor is the oldest unsafe change, so continuing to edit
  does not reset the clock while the backlog stays unpushed.
- Safe but stalled work is its own health input: a repository parked on
  a non-default branch with no movement for a long time is mid-flight
  and abandoned, even with everything pushed. Found by the walk:
  skiff is fully clean and pushed yet sits on extension-popup-ia,
  last commit seven weeks old, and its bird should not look content.

### Unsafe work thresholds

Uncommitted changes should not exist for more than a day. Defaults:
under 24 hours green, under 72 hours amber, beyond that red. Unpushed
local commits use the same defaults; nothing stops them being pushed.
All of it per project: each bird is different, and a project's config
can loosen the windows to the point where changes never reach red and
red comes only from CI and bugs.

### Stalled flight escalates

Parked on a non-default branch with no movement: amber after the first
threshold, red after the second (defaults 7 and 30 days), because
half-baked in-flight changes are a state that needs tending, even when
the tending is a WIP commit and push, which returns the bird to amber
until the branch itself goes stale. Per-project thresholds as above.
The one-disk-only accelerant (shorter windows when no copy exists
anywhere) is TBD.

### The wires are yours

A wire is the owner's priority band, assigned in config ("wire" is the
term, never "lane"). A bird never changes wire by itself: the vertical
geography is stable so the glance builds muscle memory. What the bird
controls is its position along its wire, leftmost needing attention
first. Health moves a bird sideways, never between wires.

The wires themselves are dynamic: config defines an ordered, named list
of wires, top to bottom, and adding a wire is a config edit, not a code
change. The fence is not a wire; it is always present beneath as the
ground for the unadopted. The current "Machine & Home" and "Projects"
pair is just this machine's starting config.

### The detail page

Tier C answers "what exactly, and let me start". It is a strict
superset: everything tiers A and B show appears here too, plus:

- The stats: the facts behind the bubble's numbers, itemised and named
  (which branches, which dirty files, which PRs, which tickets).
- Links out: the GitHub repository, the Forgejo repository.
- Launch: VS Code, a zellij tab, the folder in the file manager. All
  non-mutating.
- Rendered views of key files, a configurable list per project; the
  README and the roadmap are the defaults. A docs tree with file
  choice is a deeper drill-down, wanted but later.
- The roadmap renders as the markdown file itself first. The visual
  roadmap (sections as epics and features with task lists) is parked
  on the roadmap until plain rendering has lived a while.

The detail page states facts plainly; the judgement is already carried
by the mood and the colour above it. Panel names follow the facts
("in-flight work", never "unsafe work" in the UI), and readers are
assumed to know what the facts mean. Headings name the actual thing,
never a concept: "main on GitHub, newest commits", not "finalised"
(which stays internal vocabulary for the derivation). Where lower is better, a clean
zero reads as a quiet word ("none", green) rather than a large zero,
and a real count takes the tone of how bad it is.

Three more rules from the second detail round:

- The stat ledger holds facts in full words ("uncommitted changes",
  "unpushed commits"), never derived judgement terms: "drift" is a
  derivation and lives with the bird, the mood word and the sentence on
  the top line, not in the stats.
- Only what exists appears, at every tier: no CI chip or stat without
  CI set up, no tickets without a source. The page exposes facts and
  never suggests how the project ought to be run.
- Config can assert expectations per project: this bird should have CI,
  should have a ticket source. An asserted expectation that reality
  does not meet is itself a fact and shows as one ("ci: not set up").
  Without an assertion, silence. The suggestions live in the owner's
  config, never in the page.

### Expectations age

An unmet expectation is a health input: the bird wants its CI, wants
its ticket source, and like every want it escalates with time rather
than instantly. Same shape as stalled flight: amber after the first
window, red after the second, defaults 7 and 30 days, per-bird
thresholds in config. The clock starts when the scan first observes
the assertion unmet, which means the aggregate carries a first-seen
time forward between scans: the one piece of state beyond the last
scan, and it needs designing at build time. Small state like this is
acceptable on one condition: losing it must be harmless. A lost
first-seen record restarts the clock at the next scan and nothing else
notices.
- Concrete nouns link where a page exists for them (the branch on the
  forge, the forge repositories, a PR), styled subtle: inherited colour
  with a dotted underline.

### The bubble's two surfaces

The speech is the bird's voice and carries only 1, 2 and 6, in words:
how it feels and why. The chips beneath are the facts it is carrying,
the numbers for 4 and 5, from real data rather than inference: CI
state, open pull requests, forge tickets (a wanted source, see the
roadmap), and roadmap open items with bugs called out. The Claude
session time is not a chip; it lives on the detail page. Anything that
needs a list or names, which PRs, which items, belongs to the detail
page.
