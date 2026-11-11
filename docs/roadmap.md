# Roadmap

Work identified and not done. Remove items as they land.

## Reintroducing importance

An importance tier per item would set the bird's size and its place among
birds of one mood on a wire. It needs an effect the wires do not already give.

## Critical roadmap items drive health

An open roadmap item under a heading marked critical would distress the bird.
The marking convention is TBD.

## The papers as a view of their own

Opening the adoption papers should replace the project detail with an animated
transition, and closing them should bring it back.

## Session restore beside autostart

Plasma's session restore may relaunch Perch at login as well as the autostart
entry, showing the window. Not observed yet. If it happens, exclude Perch in
Plasma's session settings or pass `--hidden` on the restored launch.

## Archived scan lane

Archived forge repositories are scanned on the same interval as the rest. A
slower lane needs gather to split the forge enricher by archived state.

## Raising the zellij window

The zellij action selects or opens the tab but does not raise the terminal
window. Raising another app's window on Plasma Wayland needs a KWin script or
`kdotool`.

## TUI tiles

A tile for a TUI such as oxbow or spool would focus its alacritty window, or
launch it. It needs a config marker for which items are TUIs, and window
raising.

## Actions from tiles

Push the branch, commit and push an Obsidian vault, open in the editor. Each
changes what the scanner reads, so each needs a rescan afterwards and a way to
undo it.

## Tray icon status

The tray icon could show the worst health colour across everything.

## Nudges

Rules over a scan, such as an Obsidian vault unpushed for three days, shown as
a flag on the tile or a desktop notification.

## Phone view

Push the latest scan as JSON to a server that serves a read-only page.

## Server monitoring

The Uptime Kuma aggregate, the live container list and the server tile. The
scanner's kuma source runs only for a `[[sources.kuma]]` table, which config
leaves out until this is picked up.

## Server container controls

Stop, restart and update a container from the server detail page. The
container list is a live read from a Docker socket proxy and is a typed stub
today.

## Integrations with other services

A source for another service on the server, read from that service's own API.

## In-app global shortcut

Replace the Plasma custom shortcut with an in-app one, once Electron's global
shortcuts work under Wayland through the GlobalShortcuts portal.

## AppImage embedded update information

AppImage update tools read update information embedded in the image, which
electron-builder does not write. CI could repack the AppImage with
appimagetool, but the repack must keep the block map and checksum in
`latest-linux.yml` valid.

## Forge issues source

Tickets from GitHub and Forgejo as a work source beside the in-repo roadmap.
GitHub tokens need the Issues read permission added, see
[forge-access.md](forge-access.md). GitHub's issues listing includes pull
requests, which the gatherer must filter out.

## Visual roadmap view

Roadmap sections shown as epics and features with task lists and progress.

## Docs tree browsing

A docs tree on the detail page to pick any file from, below the configured key
files.

## Relative images on the key-file paper

A repository-relative image shows its alt text, because nothing serves it. The
main process would need to read the file from the clone behind a custom
protocol.

## Seeding a forge card from the clones

The sources page could suggest a card from the remotes no source reads: the
host, the kind (probed for self-hosted Forgejo) and the account from the URL
paths. The owner confirms it and adds a token.

## Picking paths and sessions from what the scan knows

Key files, roadmaps and the zellij session are typed into text fields.
Perch could offer the files in the clone and the sessions zellij reports.
The scan carries no file listing, so this needs a new raw field or a
main-process read when the form opens.

## Links inside key files

Relative links on the key-file paper go nowhere. A link to another file in the
repository should open it on the paper, and external links should open in the
browser.

## One repository name at two Forgejo instances

Forge repositories are keyed by owner/name alone, so the same name at two
instances is one presence. Keying by instance changes the presence reference
that config names, and needs a rule for entries written without one.

## Other sources

Candidates: Obsidian vault roadmaps as tiles of their own, a setup runbook
checklist in an Obsidian vault, a browser reading list.
