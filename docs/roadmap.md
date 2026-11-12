# Roadmap

Work identified and not done. Remove items as they land.

## Bird Positions

Move to a fixed layout for the birds so they're always in the same spots.

## Bird Types

More types of bird, perhaps per project.

## Work sources drive health

Roadmap files and forge tickets are separate source types with their own data.
Each exposes the same per-source counts of open bugs and open critical bugs,
and health judges those without knowing the source.

- Config: `key_files` becomes `documents`, a list of paths shown on the paper.
  `roadmaps` becomes an array of tables, each with a `path`, and holds parse
  rules if any are added later. A roadmap is shown on the paper too. The old
  forms are rejected with an error naming the new key. With neither set, the
  README is a document and the first standard roadmap name is a roadmap.
- Roadmap parse, bottom up and without config: bullets and checkboxes under a
  heading are its tasks, a bare heading is one task with its prose as the
  body, and higher headings group what is below them.
- Each task or ticket is a task, a bug or a critical bug. Tasks have no
  priority; their order in the file is shown and Perch does not read it.
- Two word lists set the kind, matched as whole words in any case against
  headings, task titles, `#tags`, ticket titles and forge labels. A word from
  `bug_words` makes a bug, and one from `critical_bug_words` makes a critical
  bug on its own. A task inherits from the headings above it.
- The lists are built in, and set in a global `[work]` table or directly in
  an item's entry. A set list replaces the one below it: item over global over
  built in. Built-in `bug_words`: bug, bugs, issue, issues, problem, problems,
  broken, regression, crash, crashes, p2, p3, p4. Built-in
  `critical_bug_words`: critical, urgent, severe, blocker, p0, p1.
- Only bugs affect the bird. Tasks are shown and change nothing.
- Thresholds, global in `[thresholds]` and overridable per item:
  `bugs_amber_count` 5, `bugs_red_count` 20, `critical_bugs_amber_count` 1,
  `critical_bugs_red_count` 3. The bird takes the worse of the two levels.
  Done bugs are not counted.
- Each source is judged on its own and gives its own cause, so a bug written
  in the roadmap and filed as a ticket is not counted twice.
- Done tasks show struck through on the parsed sheet.
- The UI is agreed on the work sources mockup round.

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

Tickets from GitHub and Forgejo as a work source beside the in-repo roadmap,
following "Work sources drive health". Kind and priority come from labels.
Whether GitHub issue types can set kind is TBD.

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
