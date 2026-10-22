# Roadmap

Work identified and not done. Each item has its own heading. Remove items as
they land.

## First build

Scaffold and the sources in the spec. The order is for the build session to
decide; the spec is the end state.

## Claude Code integration

Six routes were identified, in rising cost, and all are parked until the base
exists. Reading the session transcripts for last-touched time is in the spec
already.

- Show the last few user messages of the newest session on the project detail
  view, so the tile says what was being discussed, not only when.
- Launch from a tile: open a terminal in the project directory running
  `claude --resume` on the newest session, or an editor.
- Hooks: a session end hook writes a one-line "where this stopped" into the
  project, a session start hook reads it back. The hook calls Claude headless
  for the summary, once per session.
- An MCP server inside perch, so any Claude Code session can ask for the
  state of everything or of one project.
- Headless Claude in the scanner to summarise a dirty diff into a sentence,
  only on change.
- A Claude Code status line entry showing perch's flag for the current repo.

## Actions from tiles

Push the branch, commit and push a vault, open in the editor. Each one changes
something the scanner reads, so each needs a rescan after and an undo story.
Parked until the read-only app has proved itself.

## Roadmap items and branches

The scanner reads roadmap files from the working copy, so the items shown
are whatever branch is checked out, including a work-in-progress edit of the
roadmap itself. Decide whether that is acceptable or whether the stable read
should come from the default branch without touching the checkout, via
`git show main:docs/roadmap.md`, with the working-copy version shown as a
divergence when the two differ. Vaults are unaffected; they live on one
branch.

## Tray icon status

The StatusNotifier icon could carry an aggregate signal, for example the
worst health colour across everything. Parked because no mapping from many
statuses to one icon has proved itself useful yet. Decide after living with
the glance view.

## Nudges

Rules over a scan, such as a vault unpushed for more than three days, shown as
a flag on the tile or as a desktop notification. Worth having, easy to overdo;
start with the flag.

## Phone view

The hybrid design: this machine pushes the latest scan as JSON to the server,
which serves a read-only page. Nothing in the current design has to change to
add it. Not wanted yet.

## Server monitoring

Deferred as a whole: the Uptime Kuma aggregate, the live container list and
the server tile. Projects come first; server and service monitoring is its
own feature with its own prototype and sources. The scanner's kuma source
exists and stays disabled in config until this is picked up.

## Server container controls

Stop, restart and update a container from the server detail page.
Parked with the other mutations until the read-only app proves itself.
Routes when unparked: SSH to Silo for stop and restart, the server's own
API for update, capabilities verified then. The container list itself is
already in, as a live read, see `docs/decisions/scan-model.md`.

## Server service tiles

The server runs other services. If a service's state is worth seeing
without clicking through, a source module reads that service's own API:
download queues and Plex watch history.

## In-app global shortcut

Replace the Plasma custom shortcut with an in-app one once Electron's
global shortcuts work under Wayland through the GlobalShortcuts portal.
Until then the Plasma route needs no portal code and works on the one
desktop this runs on.

## Data placement audit

Before the real app displays anything: decide what surfaces where. The
unit is not the raw field but the island: a derived, nicely formed piece
of data (a count, an outline, a judgement) built from raw fields by a
named transformation. The audit walks the islands, one at a time: what
raw inputs feed it, what the transform is, what shape comes out, and
which altitudes may show it (bird, bubble, detail, or none). Raw fields
are checked only for coverage: a field feeding no island is gathered but
unused, which is fine; an island wanting a field the scanner lacks is a
gap. The app gathers everything from day one but displays only what an
island earns, so the temptation to surface too much is resisted
structurally. See `docs/decisions/bird-language.md`.

## Forge issues source

Tickets from GitHub and Forgejo as a work source beside the in-repo
roadmap, feeding the bubble's chips and the detail page. Forgejo's API
serves them and the tokens already carry read:issue. GitHub fine-grained
tokens need the Issues read permission added, a regenerate per
docs/tokens.md. GitHub's issues listing includes pull requests; the
gatherer filters them out. Not in use today on any repo, gathered
anyway once built.

## Visual roadmap view

The detail page renders roadmap files as plain markdown first. Later:
a structured view where sections become epics and features with their
task lists and progress, per the vault-tasks parse rules. Parked until
plain rendering has lived a while.

## Docs tree browsing

The detail page renders a configured list of key files. Later: a docs
tree to pick any file from, a drill-down below the configured list.

## Design site on real components

Once the app exists, the design board grows into a design site built
from the app's actual assets and components, a visual explorer for each
piece in isolation. The board's pages (app demo, field guide, atlas)
migrate onto real components rather than hand-drawn copies.

## Public undev release

If the bird language proves itself, perch moves to undev as a public
project. Requirements that become hard at that point: everything
machine-specific lives in config, no personal names or paths in the
repository, and the aviary works with any project set. See
`docs/decisions/bird-language.md`.

## Other sources

Candidates that fit the derived-only rule: the vault roadmaps as tiles of their
own, the family PC's setup runbook progress if it is a checklist in the
vault, browser reading list.
