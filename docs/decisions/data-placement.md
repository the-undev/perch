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

### The bubble's two surfaces

The speech is the bird's voice and carries only 1, 2 and 6, in words:
how it feels and why. The chips beneath are the facts it is carrying:
the numbers for 3, 4 and 5 (last session, open PRs and CI state, open
item counts). Anything that needs a list or names, which PRs, which
items, belongs to the detail page.
