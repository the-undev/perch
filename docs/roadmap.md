# Roadmap

Work identified and not done. Each item has its own heading. Remove items as
they land.

## Crowding at very narrow widths

Below about 500px wide, nine birds share about 200 units of room, on a
wire and in the detail strip alike. The whole-step row rule keeps rows
apart but nothing widens the room; the fix is a minimum window width or
a narrower bird at the floor.

## Reintroducing importance

An importance tier per item would set the bird's size and its place
among birds of one mood on a wire. Config refuses the `[importance]`
table and an entry's `importance` key by name. Bringing it back needs an
effect the wires, which carry the owner's priority, do not already give,
and tier names that read as degrees.

## Critical roadmap items drive health

An open roadmap item under a heading the owner marks critical would
distress the bird. A goal such as setting up CI then carries its urgency
from a file the scanner already reads, for any goal on any kind of bird.
The marking convention is `TBD`, to be designed with the work items
parse rules, see [decisions/work-items.md](decisions/work-items.md).
Config refuses `expect` and the `expectation_*` threshold keys by name;
perch adds no assertion machinery of its own.

## The papers as a view of their own

The adoption papers unfold above the project detail and push it down.
Opening the papers should change the view, the papers taking the page
with an animated transition, and closing them returning to the detail.
Part of a detail page design round.

## A flyer across the strip during the pan

The chosen bird's flyer would cross the strip overhead while the ground
pans, from the open bird's place to the chosen one's, which the strip's
layout already gives. A bird on another tab, whose strip replaces the
one drawn, needs its own answer.

## Session restore beside autostart

Plasma's session restore may relaunch perch at login as well as the
autostart entry, and a plain launch would then show the window. Not
observed yet; if it happens, exclude perch in Plasma's session settings
or have the restored launch pass `--hidden`.

## Archived scan lane

Gather reads every forge repository, archived or not, on the one
interval. A slow lane needs gather to split the forge enricher by
archived state and keep the archived half's raw file between its own
runs. Config refuses `[scan] archived_interval_hours` until the lane
brings it back.

## Raising the zellij window

The zellij tab action selects or opens the tab but does not raise the
terminal window attached to the session. Raising another app's window on
Plasma Wayland needs a KWin script or `kdotool` (not installed on 22
October 2026). A session that is not running opens in the terminal on
its default tab, not one named after the project.

## TUI tiles

The TUIs in `~/undev` (oxbow, spool) run in tagged alacritty windows,
`alacritty --class perch-<name> -e <name>`: a running one is focused,
else it is launched. The view model has no TUI action yet; it needs a
config marker for which items are TUIs and the window raising above.

## Claude Code integration

Routes in rising cost. Session times from the transcripts are already
read.

- Show the last few user messages of the newest session on the project
  detail, so the tile says what was being discussed, not only when.
- Launch from a tile: open a terminal in the project directory running
  `claude --resume` on the newest session, or an editor.
- Hooks: a session end hook writes a one-line "where this stopped" into
  the project, a session start hook reads it back. The hook calls Claude
  headless for the summary, once per session.
- An MCP server inside perch, so any Claude Code session can ask for the
  state of everything or of one project.
- Headless Claude in the scanner to summarise a dirty diff into a
  sentence, only on change.
- A Claude Code status line entry showing perch's flag for the current
  repo.

## Actions from tiles

Push the branch, commit and push an Obsidian vault, open in the editor.
Each changes something the scanner reads, so each needs a rescan after
and an undo story. Parked until the read-only app has proved itself.

## Tray icon status

The tray icon could carry an aggregate signal, such as the worst health
colour across everything. Parked until a mapping from many statuses to
one icon proves useful.

## Nudges

Rules over a scan, such as an Obsidian vault unpushed for more than
three days, shown as a flag on the tile or as a desktop notification.
Start with the flag.

## Phone view

This machine pushes the latest scan as JSON to the server, which serves
a read-only page. Nothing in the current design has to change to add it.
Not wanted yet.

## Server monitoring

The Uptime Kuma aggregate, the live container list and the server tile,
as one feature with its own prototype and sources. The scanner's kuma
source runs only for a `[[sources.kuma]]` table, which config leaves out
until this is picked up. The sources picker leaves Uptime Kuma out until
then; a kuma table already in the config keeps its card.

## Server container controls

Stop, restart and update a container from the server detail page,
parked with the other mutations. Routes: SSH to Silo for stop and
restart, the server's own API for update, capabilities verified then.
The container list is a live read from a Docker socket proxy on Silo
over HTTP, a typed stub today.

## Server service tiles

The server runs other services. If a service's state is worth
seeing without clicking through, a source reads that service's
own API: download queues and Plex watch history.

## In-app global shortcut

Replace the Plasma custom shortcut with an in-app one once Electron's
global shortcuts work under Wayland through the GlobalShortcuts portal.

## AppImage auto-update

electron-updater can replace the running AppImage with the latest one
from the GitHub releases that CI publishes. Parked until updating by
hand becomes a chore. It also waits for the public undev release,
because a private repository needs a run-time token to read releases.

## Forge issues source

Tickets from GitHub and Forgejo as a work source beside the in-repo
roadmap, feeding the bubble's chips, the bird's plumpness and the detail
page. Forgejo's API serves them and the tokens already carry read:issue.
GitHub fine-grained tokens need the Issues read permission added, a
regenerate per docs/tokens.md. GitHub's issues listing includes pull
requests; the gatherer filters them out. No repository uses issues
today; they are gathered anyway once built.

## Visual roadmap view

A structured view of roadmap files where sections become epics and
features with their task lists and progress, per the work items parse
rules. Parked until plain rendering has lived a while.

## Docs tree browsing

A docs tree on the detail page to pick any file from, a drill-down
below the configured key files.

## Atlas live values

The design site's Spec pages show each source's raw and snapshot types
with the mock snapshot's derived values. Raw values from a live scan
beside every field would need the design site to read `.scan/`.

## Scene details from the board

Details the retired board pages drew that the composed views do not yet:

- The ledger's "Roadmap headings" section, each heading with its item
  count or progress. `Detail` carries no roadmap groups; it needs a field
  first.
- The top wire drawn thicker than the rest.
- A bubble with no room above its bird keeps to the scene's top edge and
  its tail no longer meets the beak. Opening it beside or below the bird
  is undesigned.

## Relative images on the key-file paper

Remote images render, since the window's policy allows `https:`. A
repository-relative image has nothing serving it, so the paper shows its
alt text. Showing it needs the main process to read the
file from the clone behind a custom protocol, with the paper resolving
the path against the key file's folder.

## Seeding a forge card from the clones

The sources page could offer the remotes no source reads and seed a
card from them: hosts from the hostnames and SSH aliases in use (aliases
resolved through ~/.ssh/config), the kind certain for github.com and
probed for self-hosted Forgejo (`/api/v1/version` answers
unauthenticated), and the account guessed from the owners in the URL
paths. The seeded card is a suggestion the owner confirms and gives a
key and token. Asked for at first setup.

## Picking paths and sessions from what the scan knows

Key files, roadmaps and the zellij session are typed into bare text
fields. perch could offer the files that exist in the clone and the
sessions zellij reports. The scan carries no file listing, so this needs
a raw field for each clone's candidate files or a main-process read when
the form opens. Launch integrations (the editor, the terminal) deserve
the same over bare command strings.

## Links inside key files

The key-file paper renders relative links as plain anchors, which go
nowhere. A link to another file in the same repository would open it on
the paper; external links would go to the browser through the main
process.

## Public undev release

perch becomes a public undev project if the bird language proves itself.
Requirements then: everything machine-specific lives in config, no
personal names or paths in the repository, and the aviary works with
any project set. See `docs/decisions/bird-language.md`.

## One repository name at two Forgejo instances

Each table has its own listing, and each listed repository is read
through the table that listed it. Forge repositories are keyed by
owner/name alone, in the raw file and in the presence reference
`forgejo:owner/name`. One repository name at two
instances is then one presence, and a clone's remote at one instance
joins the other's repository of that name. Keying them by instance puts
the instance in the presence reference, which config's items, joins and
ignore name, so it waits on how a reference names its instance and what
becomes of entries written without one.

## Other sources

Candidates that fit the derived-only rule: the Obsidian vault roadmaps
as tiles of their own, the family PC's setup runbook progress if it is a
checklist in an Obsidian vault, a browser reading list.

## Just pushed

The phrasebook's candidate "Everything's just gone up" needs the time
work was last made safe. Git does not record when a push happened; the
remote-tracking ref's reflog or the forge's push events might. Decide
the source before the line joins the speech.

## Calendar words in speech

The model speaks in durations measured at the scan, which needs no clock
or time zone. Calendar words ("since Monday", "yesterday") would need the
render time and the local zone, so they belong in the renderer if they
come back.
