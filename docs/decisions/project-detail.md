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
- Local versus finalised is the organising idea for a repo's state. Local
  facts come from the working copy: dirty files, branches, unpushed
  commits. Finalised facts come from the forge API: the last N commits on
  the remote's default branch (N is config), pull requests, CI. The forge
  is asked rather than the local `origin/main` ref, which goes stale
  without a fetch. GitHub and Forgejo are peers; whatever one source
  gathers, the other does too. Decided 21 October 2026.
- Markdown browsing for a configured include list per project: README, the
  roadmap file, and nominated folders such as `docs/`. Rendered, read only.
- Launch actions are available from this page as well as the tile's
  context menu.

- Roadmap items get a structured list, grouped by the file's headings with
  kind badges, and the rendered markdown one click away. No ticket-style UI:
  perch is read only, so editing belongs in the editor. Decided
  20 October 2026. Parsing rule in [work-items](work-items.md).

## Open

- How the tile-to-page expansion animates. Mockup territory.
