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
  bird is trying to say. Whether it also carries 3, 4 and 5 is open.
- Everything else is the detail page's job.
