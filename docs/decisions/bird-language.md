# Bird language

How a bird's look and behaviour carry a project's state. The aviary is the
overview, so every trait must derive from scanned facts, see
[scan-model](scan-model.md); the axes themselves are defined in
[daily-glance](daily-glance.md).

Status: open

## Decided, 21 October 2026

- Health is the fact, mood is its expression: red is distressed, amber is
  restless, green is content. Speech tone, animation intensity and breast
  colour all read from that one derivation; there is no second state
  machine for happiness.
- Activity is behaviour, not feeling, and maps to what the bird does:
  singing while being edited, energy level, a flutter on arrival.
- A trait without a derivable fact behind it is not a trait.
- What counts as bad is per bird: the thresholds in config, with
  per-project overrides as decided in [daily-glance](daily-glance.md),
  drive each bird's reactions. Introduced slowly; some facts will be hard
  to judge well.
- The app starts by gathering all the data but aggregating and displaying
  little. Surfacing decisions follow a deliberate audit of everything
  gathered, never the other way round.

## Wanted, 21 October 2026

- Speech varies with mood. A content bird and a distressed bird say
  different kinds of things, not the same template with different numbers.
- Unhappy birds move more: jumping, fidgeting, demanding attention. The
  owner's goal state is an aviary with no unhappy birds.
- The real states need defining: what the happiness levels are, what tips
  a bird from one to the next, and how they relate to the health and
  activity axes already decided.
- Each state axis should map to a distinct trait, and further traits are
  wanted if they can carry real signal.
- If the bird language works, perch moves to undev as a public project
  rather than staying personal. Config-driven, nothing hard-coded to this
  machine, becomes a requirement rather than a preference.

## Trait mapping as prototyped

The fifth aviary and the combined prototype use:

| Trait | Fact |
| --- | --- |
| Breast colour | health (red, amber, green) |
| Plumpness | outstanding work items, capped |
| Wire height and body size | importance tier |
| Position on the wire | leftmost needs attention first |
| Restlessness (bob, tail flick) | health |
| ♪ singing | being edited now |
| Eyes closed, no song | night |
| Dimmed, on the fence | not adopted |
| Speech bubble | first-person status summary |

## Open questions

- Unadopted projects: dimmed birds on the fence, or unhatched eggs that
  hatch on adoption. Undecided; worth a look in a future round.
- Candidate extra traits, each needing a fact to earn its place: ruffled
  or scruffy feathers for drift, a drooping posture for long neglect, a
  just-landed flutter after a fresh push, a precarious perch for
  one-disk-only projects.
- Out of all gathered data, what belongs on the bird, what in the bubble,
  and what only in the detail view. Needs the data audit, see the
  roadmap.
