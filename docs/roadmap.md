# Roadmap

Work identified and not done. Each item has its own heading. Remove items as
they land.

## Reintroducing importance

Config held an importance tier per item: an `[importance]` table of
`tiers` and a `default`, and an entry's `importance` key, edited on a
Tiers settings page and a tier row on the adoption papers. Its one
effect was the bird's size, first tier largest, and its place among
birds of one mood on a wire. It was removed on 26 October 2026. The
starter names (server, machine, projects) described the owner's setup
rather than degrees of importance, and the axis overlapped the wires,
which already carry the owner's priority. Config now refuses the keys
by name. Bringing it back needs an effect the wires do not already give,
and names that read as degrees.

## Every chip spelled out on the detail page

A bubble chip states a conclusion without its working: "ci pending"
names the worst state across the forges, and finding which forge and
which run meant reading the raw scan file. Hit when Forgejo Actions
queued the mirrored workflows with no runner and sat pending forever
while GitHub was green. Everything the bubble says should appear on
the detail page with its sources spelled out: the CI line naming each
forge's newest run, its state and its link, and the same for any chip
that summarises more than one fact. Tooltips on the chips could carry
the short form of the same detail.

## A hand edit and the scan

An edit to the config file by hand is read and shown at once, but scans
only on the next interval or focus, so a new include path finds its
birds then. A save from the settings page scans at once.

## Session restore beside autostart

Plasma's session restore may relaunch perch at login as well as the
autostart entry. A plain launch would then hand over to the autostarted
instance and show the window. Not observed yet; if it happens, exclude
perch in Plasma's session settings or have the restored launch pass
`--hidden`.

## Focus on show under Wayland

`--toggle` hides the window only when it is in front, which needs KWin
to give it focus when shown. Whether KWin's focus stealing prevention
lets a window shown from the tray or a second launch take focus is not
checked yet. If it does not, a second toggle shows the window again
instead of hiding it, and the show would need the launch's activation
token.

## Archived scan lane

Gather reads every forge repository, archived or not, on the one interval.
The slow lane needs gather to split the forge enricher by archived state and
keep the archived half's raw file between its own runs. Its config key,
`[scan] archived_interval_hours`, was removed while nothing read it and
config refuses it; it returns with the lane.

## Raising the zellij window

The zellij tab action selects or opens the tab but does not raise the
terminal attached to the session, the fallback in
`docs/decisions/launch-actions.md`. Raising another app's window on Plasma
Wayland needs a KWin script or `kdotool` (not installed on 22 October 2026).
A session that is not running opens in the terminal on its default tab,
not one named after the project.

## TUI tiles

`docs/decisions/launch-actions.md` decides run or focus for the TUIs in
`~/undev` (oxbow, spool) in tagged alacritty windows. The view model has
no TUI action yet; it needs a config marker for which items are TUIs and the
window raising above.

## Main-process problems on the detail page

A failed launch, or a config entry write that failed, shows in the sky's
notices until the next scan, which the detail page hides. The detail has
no place for them yet, so an adoption that wrote nothing looks like a
press that did nothing.

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
exists and runs only for a `[[sources.kuma]]` table, which config leaves
out until this is picked up. The settings page's sources picker leaves
Uptime Kuma out until then; a kuma table already in the config keeps its
card.

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

## AppImage auto-update

electron-updater can replace the running AppImage with the latest one from
the GitHub releases that CI publishes. Parked until updating by hand becomes
a chore.

## Forge issues source

Tickets from GitHub and Forgejo as a work source beside the in-repo
roadmap, feeding the bubble's chips, the bird's plumpness and the detail
page. The `tickets` expectation name, removed while nothing could meet
it and refused by config, returns with this source. Forgejo's API
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

`apps/design` renders every component, the composed scenes and the
reference pages that run the real code. What remains is the field guide:
`design/anatomy.html`'s annotated plates of the bird and the bubble,
rebuilt on the real components. The component pages carry each trait's
rule beside its states, but not the plates themselves.

## Atlas live values

The Spec pages show each source's raw and snapshot types as declared,
with the mock snapshot's derived values. The board's atlas showed raw
values from a live scan beside every field, and let fields be tagged
with a category and a destination. Live values would need the design
site to read `.scan/`; the tagging was for the data placement audit,
which was dropped.

## Scene details from the board

What `design/perch.html` draws that the composed views do not yet:

- The ledger's "Roadmap headings" section, each heading with its item
  count or progress. `Detail` carries no roadmap groups; it needs a field
  first.
- The hover tip's summary of where a fence bird lives ("only on GitHub",
  "one disk only"). The view model says so only in the speech, so a fence
  bird's tip shows its name, its word and, when it has one, its last
  commit.
- The top wire drawn thicker than the rest.
- A bubble with no room above its bird keeps to the scene's top edge and
  its tail no longer meets the beak, as on the board. Opening it beside
  or below the bird is undesigned.
- Names in the scene scale with it, as on the board: a bird's name is
  about 9.5px in a 1400px window. Whether they keep a minimum size is
  undecided.

## Detail page meta line

The board's detail heading says where a bird lives: its path, its
forges, its wire. The view model carries the wire and the forge links
but not the path outside the launch actions; the line waits on a
`Detail` field for it.

## Ledger summary line

The board's ledger opens with a quiet sentence when nothing waits ("the
working tree is clean and everything is pushed"). Deriving it in the
renderer would mean matching ledger labels; it needs a view model field
first.

## Images on the key-file paper

A README's images arrive broken: the window's content security policy
is `img-src 'self' data:`, so a remote badge image is blocked, and a
repository-relative image has nothing serving it. Seen on Skiff's
status badges at first setup. Either render an image as its alt text
on the paper, or let the paper show real images: `https:` in the
policy for remote ones, and a main-process read behind a custom
protocol for relative ones.

## Empty hosts on a forge card

A forge card saved with no hosts gathers its listings but never joins
them to a clone, so every repository shows twice: the join only
recognises a remote whose host a card lists. Hit at first setup.
Decided 25 October 2026: a new GitHub card starts with `github.com` in
its hosts, a new Forgejo card with its base URL's host once the
address is typed; only a custom SSH setup adds aliases such as
`github-work`. The page should say what hosts are for: the remote
hosts and SSH aliases that reach the account.

## The add line in list editors

In the forms' shared list editor (`ListField` in `form-parts.tsx`) a
value row's input fills the row with "remove" hanging beside it, but
the add line fits its Add button inside the same `max-w-110` cap, so
its input ends a button's width short of the rows above. Seen on the
hosts and local folder lists. The add input should end flush with the
value inputs, its button in the gutter the remove labels use.

## Opening the config file from its path

The settings header names the config file but the path is plain text.
It should open: the file through the launch commands the config
already holds (`vscode` with the path, or `folder` on its directory as
the fallback), through the main process like every other launch.
Asked for at first setup.

## The scan line on the settings page

The settings header has only the path and the way back; the camera
header's scan line (when the last scan ran, scan now) is missing. A
save requests a scan, and watching that scan run and finish from the
settings page would show the save took. Reuse the camera's scan line
in the settings header. Asked for at first setup.

## Seeding a forge card from the clones

The scan already holds every clone's remote URLs, so the sources page
could offer the remotes no source reads and seed a card from them:
hosts from the hostnames and SSH aliases in use (aliases resolved
through ~/.ssh/config, a read-only look like every other), the kind
certain for github.com and probed for self-hosted Forgejo
(`/api/v1/version` answers unauthenticated), and the account guessed
from the owners in the URL paths. The seeded card is a suggestion the
owner confirms and gives a key and token; config keeps the assertion.
Asked for at first setup.

## The threshold fields

A threshold row is a pair of bare number inputs labelled amber and
red, one row per window. The form never says what the number counts,
what unit it is in, or what crossing it looks like on the bird. The
rows need their own design round: the unit and the consequence beside
the field, and the default shown as more than a placeholder. Raised at
the adoption round's review.

## Picking paths and sessions from what the scan knows

Key files, roadmaps and the zellij session are typed into bare text
fields, though perch could offer the real candidates: the files that
exist in the clone for the path lists, the sessions zellij reports for
the session field. The scan does not carry a file listing today, so
the suggestions need either a raw field for each clone's candidate
files or a main-process read when the form opens. Launch integrations
(the editor, the terminal) deserve the same treatment over bare
command strings. Raised at the adoption round's review.

## Links inside key files

Markdown on the key-file paper renders relative links as plain anchors,
which go nowhere. Following a link to another file in the same
repository would open it on the paper; external links would go to the
browser through the main process.

## Public undev release

If the bird language proves itself, perch moves to undev as a public
project. Requirements that become hard at that point: everything
machine-specific lives in config, no personal names or paths in the
repository, and the aviary works with any project set. See
`docs/decisions/bird-language.md`.

## One Forgejo account name at two instances

The account listings are keyed by account name, so two Forgejo tables
for one account at two instances share one listing entry: the later
table's listing replaces the earlier's, and both source cards show it.
The enricher also finds a repository's account by owner alone, so the
second instance's repositories would be read through the first's
client. Keying the listings by table and the repositories by instance
would fix both.

## Other sources

Candidates that fit the derived-only rule: the vault roadmaps as tiles of their
own, the family PC's setup runbook progress if it is a checklist in the
vault, browser reading list.

## Just pushed

The phrasebook's candidate "Everything's just gone up" needs the time
work was last made safe. Git does not record when a push happened; the
remote-tracking ref's reflog or the forge's push events might. Decide the
source before the line joins the speech.

## Calendar words in speech

The phrasebook's examples say "since Monday" and "yesterday". The model
speaks in durations measured at the scan, which needs no clock or time
zone. Calendar words would need the render time and the local zone, so
they belong in the renderer if they come back.
