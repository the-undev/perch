# Grouping

How items are organised on the single view.

Status: open

## Decided so far

Decided 20 October 2026.

- Grouping is by importance to the owner, not by directory root. The tiers
  named so far, most important first: server status, dotfiles and machine
  config, then projects.
- Importance is a fact about the owner, so it is assigned in config, not
  derived. Unassigned items get a default tier.
- Importance may drive visual weight (size, position), but no rendering
  treatment is chosen here. The mockups explore that; this file only fixes
  that the data model carries an importance tier per item.

## Open

- The exact tier list and which tier each item starts in. Do this alongside
  the `~/dev` review pass, see [sources-and-priority](sources-and-priority.md).
- Whether importance is a small enum or an ordering.
