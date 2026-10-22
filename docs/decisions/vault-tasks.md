# Work items

How "what is next" is derived, from roadmap files today and other trackers
later.

Status: open

## Decided so far

Decided 20 October 2026.

- Work items are an abstraction over their source. The data model holds items
  with a kind (bug, feature, and whatever else proves useful) and counts per
  kind; the source behind it is an adapter. The only adapter in v1 is roadmap
  markdown files. GitHub Projects or similar can join later without changing
  the model.
- Vault roadmaps are work items like any repo's: the vaults are projects.
- Item kind feeds priority: an open bug outranks a parked feature when
  deciding what needs attention.
- The roadmap file format may be changed to suit the scanner. Perch does not
  have to parse whatever happens to exist; a convention the owner adopts
  across roadmap files is on the table.

## Observed, 20 October 2026

- The vaults hold four roadmap files: `Tech/Tech Plans.md` and
  `Garden/Garden Plans.md` in Hothouse, `Code/Code Plans.md`
  and `Pocket Plans.md` in Pocket.
- Their format is plain bullets under `##` and `###` headings. Done items are
  removed, not ticked. There are no unchecked checkboxes anywhere in either
  vault, so the spec's checkbox rule reads nothing.
- Repo roadmaps (for example perch's own `docs/roadmap.md`) use one heading
  per item with prose, few or no bullets.

## Parsing rule

Decided 20 October 2026. Basic markdown extraction, no bespoke syntax:

- Headings are the groups, and the detail view's structured list groups by
  them, see [project-detail](project-detail.md).
- The rule is per heading, decided 21 October 2026 against the gathered
  structure of every real roadmap file. A heading with direct bullets is a
  group and its bullets are the items. A heading with no bullets and no
  sub-headings is itself one item, with its prose as the body. A heading
  with sub-headings and no direct bullets is structure. A heading with both
  is a group with nested sub-groups. No file-level mode, no special cases.
- Four files overcount under this rule because they hold done records or
  design prose in a roadmap (oxbow, prism, cobble, the Pocket
  vault's "Getting off one disk"). That is file hygiene against the owner's
  own convention (outstanding work only), not a parser concern; tidy them
  as they are next touched.
- Checkbox syntax is honoured where it exists: `- [ ]` open, `- [x]` done.
  No file uses it today; plain bullets with done items deleted is the
  observed convention, and both parse.
- An item is a bug when it sits under a heading whose text contains the
  word "bugs" (case-insensitive, so "Next Priority Bugs" counts) or carries
  a `#bug` tag on its line. Either signal counts; the heading is the
  primary convention, the tag covers a bug recorded inside a feature's
  section. Decided 20 October 2026, widened from exact `Bugs` on
  21 October 2026.

## Epic convention

Decided 20 October 2026, adopted file by file as the owner improves them.

A heading is an epic. Its tasks are checkbox bullets, ticked as they are
implemented. When every task is ticked the epic is removed from the roadmap
and recorded in the changelog. Where a file uses this shape, the parser
derives per-epic progress (checked against total), which the detail view
and possibly the tile can show. Files not yet in this shape still parse
under the general rule above; nothing forces a migration.

## Open

- The roadmap convention itself: how a bullet declares its kind (a Bugs
  section per file, a tag per line, or something else). Needs choosing
  before the parser is written.
- How much of the item list the drill-down shows: all, or the first few per
  area.
- Whether the glance level carries anything from roadmaps, see
  [daily-glance](daily-glance.md).
