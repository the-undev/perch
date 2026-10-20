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

Replace the Plasma custom shortcut with the Tauri global shortcut plugin once
it supports Wayland through the GlobalShortcuts portal. The pull request to
watch is tauri-apps/global-hotkey#162.

## Other sources

Candidates that fit the derived-only rule: the vault roadmaps as tiles of their
own, the family PC's setup runbook progress if it is a checklist in the
vault, browser reading list.
