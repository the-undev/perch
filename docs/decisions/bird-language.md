# Bird language

How a bird's look and behaviour carry a project's state. The aviary is the
overview, so every trait must derive from scanned facts; the axes
themselves are defined in the spec's Health section.

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
  per-project overrides,
  drive each bird's reactions. Introduced slowly; some facts will be hard
  to judge well.
- The app starts by gathering all the data but aggregating and displaying
  little. Surfacing decisions follow a deliberate audit of everything
  gathered, never the other way round.
- The bird speaking as an entity is itself motivating: character and
  gentle gamification are part of the product, not decoration. The owner
  wants to keep coming back because something with a face is talking.
- Night is cosmetic and sleep is earned. The sky follows the clock, and
  at night a content bird that is not being edited sleeps: eyes closed,
  still, the waking prefix on its speech. Restless and distressed birds
  stay awake, and an edited bird sings whatever the hour. Nothing
  changes functionally: colours, positions and bubbles are identical by
  night, and no fact is ever hidden for atmosphere.

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

## The voice

The speech spec is the phrasebook, the design site's Phrasebook page:
the voice rules and every situation rendered as the bubble it would
show. Approved 22 October 2026.

## Trait mapping as prototyped

The fifth aviary and the combined prototype use:

| Trait | Fact |
| --- | --- |
| Breast colour | health (red, amber, green) |
| Plumpness | outstanding work items, capped |
| Wire height and body size | importance tier |
| Position on the wire | leftmost needs attention first |
| Restlessness (bob, tail flick) | health |
| ♪ singing | being edited now, whatever the hour |
| Asleep: eyes closed, still | night, and only earned: content birds not being edited, and the fence |
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
