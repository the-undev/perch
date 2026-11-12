# Roadmap

Work identified and not done. Remove items as they land.

## Bird Positions

Move to a fixed layout for the birds so they're always in the same spots.

## Bird Types

More types of bird, perhaps per project.

## Project config in the repository

A `.perch.toml` at a repository's root, meant to be checked in, holds what is
true of the project on any machine: `key_files`, `roadmaps`, `bug_words`,
`critical_bug_words` and the bug thresholds, with the same keys as an item
entry. Precedence, each set value replacing the one below: the item entry in
the owner's config, then `.perch.toml`, then `[work]` and `[thresholds]`, then
built in. Wires, names, sessions, launch actions and sources stay in the
owner's config. A bird known only from a forge has no clone to read it from;
reading it through the forge API is a later step. Perch cannot migrate a file
in another repository, so the schema and its versioning are settled before
anything else.

## Side by side sheets on wide windows

The detail page is capped at 1920px. A wide window could show two sheets side
by side. What decides the pairing is TBD: by family (documents beside work) or
chosen per bird, which needs remembered state.

## Display choices as config

How the work sheets show things, such as hiding done tasks, could be set in
config. It waits until real roadmap files show which choices need it.

## The papers as an overlay

Opening the adoption papers should show above everything else and centered rather than within the project view

## Archived scan lane

Archived forge repositories are scanned on the same interval as the rest. A
slower lane needs gather to split the forge enricher by archived state.

## Raising the zellij window

The zellij action selects or opens the tab but does not raise the terminal
window. Raising another app's window on Plasma Wayland needs a KWin script or
`kdotool`.

## Tray icon status

The tray icon could show the worst health colour across everything.

## Server monitoring

- Integrate with Uptime Kuma for status monitor.
- Investigate other monitoring integrations

## In-app global shortcut

Replace the Plasma custom shortcut with an in-app one, once Electron's global
shortcuts work under Wayland through the GlobalShortcuts portal.

## AppImage embedded update information

AppImage update tools read update information embedded in the image, which
electron-builder does not write. CI could repack the AppImage with
appimagetool, but the repack must keep the block map and checksum in
`latest-linux.yml` valid.

## Forge issues source

Open tickets from GitHub and Forgejo as a work source beside the in-repo
roadmap. Pull requests are left out.

- Each ticket is a task, a bug or a critical bug by the same `bug_words` and
  `critical_bug_words` the roadmap uses, matched as whole words in any case
  against its title and its labels. Whether GitHub issue types can set the
  kind is TBD.
- Each forge's tickets are judged on their own against the bug thresholds and
  give their own cause, as each roadmap file does, so a bug written in the
  roadmap and filed as a ticket is not counted twice. The ledger gets a bug
  row per forge and a critical bug row when there are any.
- The ticket sheet is drawn in `mockups/work-sources.html`: a tab per forge
  after the roadmaps, carrying its open count and shown even with none open.
  Each row has the number, title, labels as the forge spells them and last
  update, with the roadmap's margin marks. Critical bugs come first, then
  bugs, then tasks, each most recently updated first. A row opens the ticket
  in the browser.

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
