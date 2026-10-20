# Project detail view

What clicking a tile opens.

Status: open

## Decided so far

Decided 20 October 2026.

- A tile expands to a full page for the project. High-level only: aggregated
  status, never source browsing.
- Contents: what the project is (derived from the README's first paragraph),
  the health and activity detail behind the tile's summary, CI status,
  release versions (git tags locally, forge releases where a remote exists),
  work-item counts by kind, branches, remotes.
- Markdown browsing for a configured include list per project: README, the
  roadmap file, and nominated folders such as `docs/`. Rendered, read only.
- Launch actions are available from this page as well as the tile's
  context menu.

- Roadmap items get a structured list, grouped by the file's headings with
  kind badges, and the rendered markdown one click away. No ticket-style UI:
  perch is read only, so editing belongs in the editor. Decided
  20 October 2026. Parsing rule in [vault-tasks](vault-tasks.md).

## Open

- How the tile-to-page expansion animates. Mockup territory.
