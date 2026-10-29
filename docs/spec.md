# Specification

What perch is, what each level shows, and how it behaves. The reasons
behind each decision live in [decisions/](decisions/), one file per
topic; this document says how things are now. The settled designs are
working pages on the design board, `design/index.html`.

## Purpose

The owner has many projects in flight: personal repositories, undev
repositories, dotfiles, two Obsidian vaults, home IT. Work moves between
them in short bursts, and the cost is working out, each time, what state
a project was left in and what was meant to happen next.

perch answers that from one window. It is a dashboard of the owner, not
of a server: projects first, with the other things the owner does on
this machine alongside.

## Principles

- **Derived, never entered.** Every value on screen comes from a file, a
  repository or an API that changes as a side effect of normal work. If
  a value would need typing in, it is not shown. A visual trait without
  a derivable fact behind it is not a trait.
- **Read only.** The scanner changes nothing it reads. Launch actions
  open things (a terminal, an editor, a forge page) and mutate nothing;
  actions that change state are parked, see the roadmap.
- **Facts, not suggestions.** The app exposes facts and never tells the
  owner how a project ought to be run. A source that does not exist for
  a project shows nothing. A goal such as setting up CI belongs on the
  project's roadmap, not in perch's config.
- **Gather everything, display what is earned.** The scanner collects
  all it can from day one; what surfaces, and at which level, is decided
  deliberately in [decisions/data-placement.md](decisions/data-placement.md),
  never by default.
- **Almost no history.** Only the latest scan is kept, cached to disk so
  the window opens with content. One exception: a failing source card
  carries when it last read from the previous snapshot, and losing that
  is harmless, the card only stops saying when it last read.
- **One machine, config-shaped.** One Linux machine, Plasma 6, Wayland; no
  portability requirement, so platform-specific routes are taken when
  simpler. Everything machine-specific lives in config, because perch
  may one day become a public undev project, see the roadmap.

## The shape of the app

Projects are birds. The aviary is the home view: birds perched on
wires under a sky that follows the real clock, the unadopted dimmed on
a fence beneath. A wire is the owner's priority band, an ordered named
list in config; a bird never changes wire by itself, only its position
along the wire, leftmost needing attention first.

Perch deals in three tiers above the project itself, each answering a
share of the glance questions (which thing needs me first; is anything
at risk of loss; is the rest quietly fine):

- **A. The bird**: health worn as colour and behaviour, plumpness from
  outstanding work, song while being edited.
- **B. The bubble**: click a bird and it speaks. The speech carries how
  it feels and why, in the first person; the chips beneath carry real
  numbers (CI, PRs, tickets, open items). Each chip leads to the bird's
  page, landing on the ledger row that holds its working. Tier B is a
  strict subset of what tier C knows. A fence bird's bubble has one key, Adopt, beside
  "Tell me the full story": it leads to the bird's page with its
  adoption papers unfolded.
- **C. The detail**: everything, see below.

Navigation is the camera. The aviary is the zoomed-in view; opening a
project pulls the camera back, the bird's wire-mates flying into a slim
tab row at the top while the detail rises beneath. In the tab row the
wire's name rests on the line at its left end, the tally beneath it, at
every width. The birds keep their size and centre in the width right of
the label, the open one bright and the rest dimmed; a crowded wire's
birds bunch closer and never cross the label. The header tabs are
the whole navigation, in the scene's own order: The Aviary, one tab per
wire, On the fence. Each wire tab remembers its last-open bird. Moving
from one bird's page to another, from the tab row, a header tab or the
URL, pans the ground beneath the still tab row: the page left slides
out as the chosen bird's slides in, from the right for a bird further
along the row or on a later tab, the fence last, and from the left
otherwise. The bright bird in the tab row moves at once. The new page
opens at the top of its panes with its papers folded, and a chip the
move carries lands once the pan settles. With reduced motion the page
is replaced at once. The
Aviary tab, the brand and Escape ride the camera home. Large state
changes between scans re-run the arrival: birds fly in, never crossfade.

The detail is a strict superset of tiers A and B. The bird leaves the
wire for the roost, a T-stand perch in the post's colour at the page's
top right. It sits on the crossbar, breast settled and no legs showing;
on the wires and in the tab row birds stand. It is drawn larger than on
any wire, idle, and always faces left toward its record. Its bubble sits
beside it as paper, the tail on the beak, with the speech and chips as
the aviary bubble says them but no name, state word or keys. Here each chip is a handle: pressing it
scrolls the ledger row holding its working to the middle of the record
pane and marks it briefly. A chip pressed in the aviary's bubble closes it
and rides the camera to the bird's page, which lands on that row the
same way as it opens. The band opens with the
heading, the one place on the page that carries the name and the state
word, with what the bird is doing. A meta line in mono beneath says
where the bird lives: the clone's path with `~`, the forges that hold
it, and its wire, "on the fence" for a fence bird. The launch actions as
verbs, the links out and the papers' verb share the meta line's row
where they fit and drop beneath it where not. Beneath them, for each
remote the clone pushes to that no card can read, one amber sentence
in the sky's notice voice says what perch knows and the fix: "The clone
pushes to skiff-app/skiff on github, which no GitHub card reads.
Add a card for skiff-app under Sources.", Sources opening the
settings page. The bubble's "can't read github" chip lands on it. The
main process's problems follow, only when there are any. Beneath the
band the record pane holds a ledger of facts in full words
(clean zeros as a quiet green "none", counts toned by severity),
branches, the commit river, flags, and beside it the paper pane holds
a configurable list of key files rendered as paper, the bubble's
material, with folder tabs. A long file keeps its full height; its pane
scrolls, the folder tabs held at the pane's top.
Each chip's number sits on one ledger row, marked with a dot, its
working spelled out beneath in mono, source by source: each forge's
newest CI run with its state, branch, name, link and age, under a CI
row that says the worst state as the chip does; open pull requests per
forge, linked to the forge's list; open items and bugs per roadmap
file; the age of the oldest uncommitted change or unpushed commit. A
source with nothing to say is silent. A forge that couldn't be read,
or the part of it a row spells out, says so in amber, naming the part:
"couldn't read pull requests" or "couldn't read CI"; a CI or pull
request row that no forge could fill says "couldn't read" itself. The
problems at the foot, "What couldn't be read", give the scanner's full
sentence per source. A failure always says "couldn't read", never "not
read", which would mean perch had not yet looked.
Concrete nouns link wherever a page exists for them. Headings name the
actual thing, never a concept.

The commit river answers what is on main and whether it has spread. Its
heading names the branch it judges, "Where each commit on main has
reached": the clone's default branch, else the first read forge's. It
tells the default branch's newest commits once each, joined by hash
across local main and each forge's list, newest first and capped at
`scan.finalised_commits`. One dot before each commit judges its spread
over the bird's forges whose commits were read, whatever their pull
requests and CI did; the clone only adds commits,
such as unpushed ones on main. Green: every forge read holds it, "on
github and forgejo". Amber: a forge read lacks it, "only on github", or
none holds it, "not pushed to a remote" ("on no remote that could be
read" while another forge couldn't be read). Amber too when the bird
has forges and none of their commits could be read: "no remote could
be read". The quiet dot, a faint speck, only when the bird has no
forge ("no remote"). The dot
speaks its words to a screen reader and on hover. A forge's list holds
only its newest commits, so a forge lacks a commit only when the commit
is no older than the list's oldest; an older one is beyond the list and
counts as held, so old history never turns amber. Local main being
behind a forge is not flagged. A forge whose commits couldn't be read
gets an amber line, "couldn't read github", with the short why when no
card covers it: "couldn't read github · no card covers skiff-app".
When a forge lacks a commit another forge holds
within its list, one amber sentence says so: "forgejo is 2 commits
behind github." when one forge lacks, "github and forgejo have
diverged: github lacks 1 commit, forgejo lacks 2 commits." when both
do, counted over every listed commit. Forges in agreement earn no
sentence. A commit links to the first forge holding it.

The bird's page is a fixed stage: the window never scrolls. The strip,
the heading with its notices, problems and actions, and the roost hold
still; beneath them the record pane and the paper pane each scroll
their own contents, and the wheel moves the pane under the pointer.
Scrollbars are thin and quiet, in the edge colours. The page centres
as one block up to 1920px. From 860px wide the band is one row: the
heading at the left, the bubble in the middle at its words' width up to
about 56 characters, and the bird at the right. The band is as tall as
the sitting bird on its stand, whose pole and shadow hang below it.
Narrower, the roost follows the heading in a centred 480px column,
bubble beside bird, and under 460px the bubble stacks above the bird.
The record and paper panes sit
side by side while the page is at least 960px wide; narrower, they join
into one pane, the key files at the record's end.

The visual language is specified on the board: the field guide
(`design/anatomy.html`) annotates every trait with its rule, and the
app page (`design/perch.html`) is the working structure. The palette is
ink: warm dark, crisp edges, red rare enough to mean something.
The design site (`apps/design`, served by `pnpm design`) is the board's
living successor: the real components from `packages/ui` in every state
the view model allows, each labelled with its rule. The board pages stay
as the approved record.

## Health

Health is the fact; mood is how the bird wears it: green content, amber
restless, red distressed. Speech tone, animation intensity and breast
colour all read from the one derivation. Activity (editing, in flight,
settled) is behaviour, not feeling, and is a separate axis.

Inputs, worst wins, every threshold a config default with per-bird
overrides:

- Failing CI, open bugs: red.
- A remote the clone pushes to that no card can read, because no card
  on its host covers the owner: amber, the bird saying "I push to
  skiff-app/skiff on github, but no card of yours can read it." A
  forge whose read failed this scan (a missing token, an HTTP error) is
  not an input; its ledger rows say "couldn't read".
- Unsafe work, uncommitted changes and unpushed commits alike: green
  under 24 hours, amber to 72, red beyond. The age anchor is the oldest
  unsafe change, so editing does not reset the clock on a backlog.
- Stalled flight: parked on a non-default branch with no movement, amber
  at 7 days, red at 30, even with everything pushed.
- The one-disk-only accelerant (shorter windows when no copy exists
  anywhere) is `TBD`.

A bird whose config loosens the windows can be made never to redden
from work alone, leaving red to CI and bugs.

## The scanner

The scanner is the `@perch/core` package in `packages/core`, and the
paths below are inside it. `src/scan.ts` composes it with its
directories and config path as parameters: the app scans into
`~/.local/share/perch/scan/`, the command line into the gitignored
`.scan/` at the repository root. Two stages:

- Gather (`pnpm gather`) reads this machine and the forge accounts in
  rounds (root collectors, then enrichers) and writes raw facts, one
  JSON file per source, to `raw/`. Types in `src/raw.ts`. Nothing
  judged; every absent value states why.
- Aggregate (`pnpm aggregate`) reads only those files and the config,
  joins presences into projects (`src/join.ts`), and writes
  `snapshot.json`. Types in `src/snapshot.ts`; every derivation rule
  lives in `src/derivations.ts`. It reads the previous snapshot first,
  for each source card's last read.

The snapshot holds one scan record per configured source table, in
config order, for the settings page's source cards. Each has an
identity (`local:~/dev`, `github:<account>`,
`forgejo:<account>@<host>`, `kuma:<name>`), a heading, and its last
scan: never scanned, ok with when it was read and what it counted
(repositories, or a kuma page's monitors, and a local table's include
paths that do not exist), or failed with the message and when it last
read. A table the raw files hold nothing for, such as one added since
the last gather, is never scanned. A source that fails as a whole fails
every table it holds. When a table last read is carried from the
previous snapshot. The coarse status per polled source stays beside
it for the sky's notices. The app pushes the records to the renderer
with the aviary.

`pnpm scan` runs both, with the default config when the owner has
none; `pnpm check` runs Biome, tsc and vitest. A full
scan of this machine took about 4 to 7 seconds on 22 October 2026.

The renderer consumes only the view model, never the raw or snapshot
types. `src/viewmodel.ts` derives it from a snapshot, the config and
the home directory by pure functions, in the design's words: the
aviary's wires and fence, each bird's mood, activity and plumpness, its
bubble (the speech from `src/speech.ts`, which follows the phrasebook,
and the chips) and its detail (the clone's path with `~` and the
forges, ledger, branches, commit river, pull requests, flags, launch
actions, links, key files). The sky follows the clock at render
and is not part of the model. `src/mock.ts` holds a hand-curated
snapshot and config pair covering every view model state, for the
design site and the app. Neither module imports Node, so the renderer
can import both.
Scanners are tested against fixtures under `tests/fixtures/`, never the
live machine. The scan feeds the glance unattended: no prompting
routes, no SSH. Detail views may use live sources; the window never
blocks on aggregation and renders from the cached snapshot.

Sources today: local repositories and vaults (git state with the
default branch's newest commits, Obsidian markers), the GitHub and
Forgejo account listings and per-repository detail (PRs, CI, newest
default-branch commits, each its own request, so a failed request fails
only its part; a missing token fails the whole detail), roadmap files,
Claude Code session times. A repository a clone's remote names that
could not be looked up is still a presence, carrying its error and
whether no card covers its owner. Uptime Kuma exists and runs only for a
`[[sources.kuma]]` table, which config leaves out until server
monitoring is picked up. Forge tickets are a wanted
source, see the roadmap. The field inventory, with declared types
beside live values, is the atlas (`design/atlas.html`).

## Projects, joining and adoption

A project is a joined entity over presences: a local clone, forge
repositories, vault state. Observation joins what remote URLs prove;
config asserts what they cannot, and on conflict the observation wins,
flagged. Everything found starts on the fence; adopting a bird means
adding it to config, which puts it on a wire and may assert further
ties and thresholds. Forks are ignored by
default; archived repositories are gathered but never on the main view.
Details and open questions (composite multi-repo projects among them):
[decisions/project-model.md](decisions/project-model.md).

Adopting and amending are one sheet of adoption papers, rising from
the foot of the bird's page over its record and paper panes, which dim
and go inert. The band above stays in view, the bird and heading
undimmed, but its controls rest while the papers are up: Adopt on a fence bird,
The papers on an adopted one, beside the meta line. Papers taller than the
ground stop at its foot and scroll themselves. The head carries the bird's name,
its portrait and its ring, the config key the entry sits under. "What
perch has seen" follows in mono and cannot be edited: where the clone
is, home as `~`, the forges that also hold it, and the last commit (the
checked-out one, else the newest on a forge's default branch). "What
you say" holds the wire, drawn as wire strokes with the bird sitting on
the chosen one, and the name. A fold, "More particulars", names
what it holds while closed: the key files, roadmaps, zellij session and
the bird's own thresholds. A choice left on its default is written as
nothing, so config holds only what differs. The signature button names
the destination ("Adopt onto Projects", or "Amend the papers"); Not now,
Escape pressed inside them, or a press anywhere off the papers, the
band included, folds them away without writing. A threshold that
cannot be written holds the signature and says why. "Return to the
fence" sits on an adopted bird's signature line and asks twice, the
second press saying "Every line of these papers is struck out." The app
writes the config file; signed papers stay open until the entry read
back shows the write, so a refused write leaves them open with the
main process's sentence in red above the signature line. The config's
vocabulary (entries, keys) stays in the config file and these docs.

## Configuration

`~/.config/perch/config.toml`, stowed from the dotfiles so backup is a
dotfiles push. It holds: the wires as an ordered named list, the
sources, the health windows, the scan interval and the finalised commit
count, the zellij session defaults, the launch commands (an action whose
command is left out is not offered), per-project assertions (joins,
wire, display names, thresholds, key file
lists, zellij session names). An entry for an item adopts it. No
secrets, ever. Every field is shown, with placeholder values, in
`config.example.toml`.

Sources are declared, never assumed: one `[[sources.<kind>]]` table per
connection. `local` holds include and exclude paths; `github` an
account, its keyring key, its hosts and its tracked forks; `forgejo`
the same and the instance's base URL; `kuma` a server's name and its
Uptime Kuma status page. Each GitHub account appears once, each Forgejo
account once per instance, each keyring key once among one kind's
tables, each kuma name once. A config with no sources is valid and
scans nothing.

The settings page, reached from the camera header, edits everything but
the item entries, which each bird's adoption papers edit. A rail names its
pages beside one reading-width column: Sources, with Joining up beneath
it, then Wires, Judgement, Scanning and Launching. It opens on
Sources and shows one page at a time. An edit is kept while another
page is open, and Save writes every page's edits. The page caps near
1400px and centres; below about 900px the rail folds to a row of words
above the column.

The Sources page holds one card per source table, in config order. A
card's head names the kind and its account, host or name, and says its
last scan in words: what it found or read and how long ago, why it
failed and when it last read, or never scanned yet. A local card also
names its include paths that do not exist. Opened, a card shows its
fields: a local card's folders searched and excluded, paths kept with
`~`; a forge card's account, keyring key with the `secret-tool store`
command beside it, hosts and tracked forks, and a Forgejo card's base
URL (a new GitHub card starts with `github.com` in its hosts, and a
Forgejo card's hosts follow its base URL's host while they are empty or
still what the previous address gave); a kuma card's name, base URL and status page. A GitHub or Forgejo
card also has a token field and two buttons. Store in the keyring writes
the pasted token under the card's keyring key, and the field empties
once it is stored. Test lists the account's repositories with the
stored token, as a scan does, and answers in a sentence on the card:
"someone: 18 repositories readable", or what failed (no token under the
key, no answer from the host, the HTTP status the forge answered). Both
are held while either runs and while the card has no keyring key, and
Test while it has no account or address. A kuma card has no token
field: its status pages are public reads. "Add a source" opens
a picker in place offering every kind but Uptime Kuma, which waits for
server monitoring, each with what it reads and what it needs; on a
config with no sources it is open from the start. A kuma table already
in the config keeps its card.
Picking a kind adds an empty card of it. Removing a card asks twice.
Save is held while any field has a problem, named beside the field: an
empty required field, a folder not starting with `/` or `~`, an address
without `http://` or `https://`, or a repeat the config parser refuses
(a GitHub account in any case, a Forgejo account at one base URL, a
keyring key within one kind, a kuma name).

The Wires page lists the wires top to bottom, each a text field edited
in place and moved up and down, and the default picked from them. A row
keeps the wire it started as through a move: renamed, it says what it
was, and saving moves the entries naming the old name to the new one,
the default staying on its row, so two names can be swapped. Removing a
wire takes a second press on its remove, after the row says how many
birds name it and that they move to the default. The default cannot be
removed until another wire is picked. Save is held while a wire has no
name or two wires share one.

The app writes the file without comments, paths under the home
directory with `~`. An edit to the file by hand is read as soon as it is
saved, and the open page or papers show it, and a scan follows; the last write wins.

## Secrets

Tokens live in the desktop keyring, read at run time with
`secret-tool lookup`, service `perch`: `github-finch`,
`github-the-undev`, `github-skiff-app`, `forgejo-finch`,
`forgejo-the-undev`. All read-only. perch writes a token into the
keyring only from a forge card's token field, with `secret-tool store`
and the token on its stdin; it never reads one back for display, and
neither the store nor the test answers, logs or writes the token. `gh`
is not used at run time; its
tokens carry write scopes and its account state is shared with
interactive use. A password manager holds the human backups only and is never
read at run time, its CLI prompts. Creation and replacement runbook:
[tokens.md](tokens.md).

## Behaviour

- A normal window and an icon in the tray. Closing the window hides it.
  The tray menu shows it, rescans and quits; activating the icon toggles
  the window.
- Starts at login from an XDG autostart entry running `perch --hidden`:
  the window hidden, the icon in the tray. See
  [decisions/window-presentation.md](decisions/window-presentation.md).
- One instance. A second launch hands its arguments to the running one
  and quits: `--toggle` shows and focuses, or hides when already in
  front; `--show` only shows; `--scan` rescans. With none of them it
  shows.
- The global shortcut is a Plasma custom shortcut bound to
  `perch --toggle`. In-app global shortcuts on Wayland are parked, see
  the roadmap.
- The scan runs in the Electron main process: at start, then
  `[scan] interval_minutes` after each scan finishes, on window focus
  once a minute has passed since the last scan, and on request: the
  header's scan line, Rescan in the tray, `perch --scan`. One scan at a
  time; a request during a scan joins it. The config is read again
  before every scan. Archived repositories are read on the same
  interval; a slower lane is parked, see the roadmap.
- The latest snapshot is cached in `~/.local/share/perch/scan/`; the
  window renders from it at start and the main process pushes the fresh
  aviary when a scan finishes. Before any snapshot exists the window
  says the first scan is running. Without a config file nothing scans:
  the window names the path and offers to create it with the default
  config of one wire, the standard windows and no sources,
  never over an existing file, then opens the settings page on Sources.
  Checking again, or focusing the window, reads the path again. A failing source keeps its previous
  result and shows the error and its age. A config that does not parse
  leaves the previous one in force, and a failed scan leaves the
  previous snapshot; either says so in the sky's notices, as does a
  failed launch until the next scan.
- The header's scan line says the sky's phase, the scan's time and its
  age ("just now", then by the minute, then by the hour), and "scanning" while a scan runs.
  Beside it, in amber, "couldn't read 1 source" when sources failed,
  each named on hover. The sky follows the clock,
  read again every minute.
- The URL holds where the camera points: `/` for the aviary,
  `/bird/<id>` for a bird's detail, `?papers=true` to unfold its papers
  and `?chip=<kind>` to land on a chip's ledger row, an unknown kind read
  as none. `/settings` is the settings page in
  the camera's place; Escape goes home from it as from a bird.
- Launch actions run their commands from config, detached, and only
  ones some bird offers. Links open in the browser; the window never
  navigates. Key files are read by the main process when a detail opens
  and again after every scan.
- The zellij tab action goes to the project's tab in its session, or
  opens one in the project's directory; a session that is not running
  opens in the configured terminal. It does not raise the terminal's
  window.

## Standing decisions

- **A desktop app rather than a browser page**: the app buys the tray,
  the shortcut, a chromeless window and a process that owns the scan
  timer.
- **Electron rather than Tauri**: decided with reasons in
  [decisions/tech-stack.md](decisions/tech-stack.md); TypeScript end to
  end with the house frontend stack.
- **No database**: see Principles; the previous snapshot is a file, not
  a store.
- **Not hosted on the server**: the state the owner loses track of
  lives in working copies this machine holds. The phone view hybrid is
  parked.

## Tooling

A pnpm workspace: the scanner in `packages/core`, the components and
theme in `packages/ui`, the design site in `apps/design`, the Electron app
in `apps/desktop` with electron-vite, React, TypeScript strict, Tailwind
v4, TanStack Router and Query, shadcn for basics, Biome and vitest.
`pnpm check` covers lint, types and tests, and CI runs it on every push
and pull request. electron-builder packages a Linux AppImage; a `v*` tag
releases it on GitHub. The app icon and the tray icon are drawn in
`apps/desktop/resources/icon.svg` and `tray.svg`; `pnpm icons` renders
their PNGs. The desktop entries for the launcher and autostart sit
beside them, and the README says how to link them.

## Environment, as of 22 October 2026

Facts the design relies on. Verify before relying on them later.

| Fact | Value |
| --- | --- |
| Desktop | KDE Plasma 6.7.5, Wayland |
| GPU | NVIDIA RTX 5070 Ti, nvidia-open 615 |
| Node, pnpm | 26, 11 |
| Forgejo | `http://forge.example.lan:3000`, SSH alias `forgejo` on port 2222, documented in the Hothouse vault at `Tech/Server/Forgejo.md` |
| Keyring tokens | service `perch`, the five keys under Secrets |
| Claude Code sessions | `~/.claude/projects/`, one directory per working directory, non-alphanumerics encoded as `-` |
| Git identities | `~/dev` and `~/.dotfiles` are `finch`, `~/undev` is `the-undev`; see the Pocket vault, `Code/Git Identities.md` |
