# Bird language

How a bird's look and behaviour carry a project's state. The aviary is the
overview, so every trait must derive from scanned facts, see
[scan-model](scan-model.md); the axes themselves are defined in
[daily-glance](daily-glance.md).

Status: open

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

- Whether happiness is its own state or health worn behaviourally. The
  working assumption: health is the fact, mood is its expression, so no
  second state machine.
- Candidate extra traits, each needing a fact to earn its place: ruffled
  or scruffy feathers for drift, a drooping posture for long neglect, a
  just-landed flutter after a fresh push, a precarious perch for
  one-disk-only projects.
- Whether activity (editing, in flight, settled) maps to energy: how
  animated the bird is, separate from how worried it is.
