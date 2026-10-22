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
  a project shows nothing. Expectations (this project should have CI, a
  ticket source) are the owner's, asserted in config; an unmet one is
  itself a fact and shows as one.
- **Gather everything, display what is earned.** The scanner collects
  all it can from day one; what surfaces, and at which level, is decided
  deliberately in [decisions/data-placement.md](decisions/data-placement.md),
  never by default.
- **Almost no history.** Only the latest scan is kept, cached to disk so
  the window opens with content. One exception: a small first-seen
  record lets unmet expectations age, and losing it is harmless, the
  clock restarts at the next scan.
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

- **A. The bird**: health worn as colour and behaviour, size from
  importance, plumpness from outstanding work, song while being edited.
- **B. The bubble**: click a bird and it speaks. The speech carries how
  it feels and why, in the first person; the chips beneath carry real
  numbers (CI, PRs, tickets, open items). Tier B is a strict subset of
  what tier C knows.
- **C. The detail**: everything, see below.

Navigation is the camera. The aviary is the zoomed-in view; opening a
project pulls the camera back, the bird's wire-mates flying into a slim
tab row at the top while the detail rises beneath. The header tabs are
the whole navigation, in the scene's own order: The Aviary, one tab per
wire, On the fence. Each wire tab remembers its last-open bird. The
Aviary tab, the brand and Escape ride the camera home. Large state
changes between scans re-run the arrival: birds fly in, never crossfade.

The detail is a strict superset of tiers A and B: the bird's mood and
speech continue onto the page, then a ledger of facts in full words
(clean zeros as a quiet green "none", counts toned by severity),
branches, the default branch's newest commits on the forge, flags,
launch actions as verbs, links out, and a configurable list of key
files rendered as paper, the bubble's material, with folder tabs.
Concrete nouns link wherever a page exists for them. Headings name the
actual thing ("main on GitHub"), never a concept.

The visual language is specified on the board: the field guide
(`design/anatomy.html`) annotates every trait with its rule, and the
app page (`design/perch.html`) is the working structure. The palette is
ink: warm dark, crisp edges, red rare enough to mean something.

## Health

Health is the fact; mood is how the bird wears it: green content, amber
restless, red distressed. Speech tone, animation intensity and breast
colour all read from the one derivation. Activity (editing, in flight,
settled) is behaviour, not feeling, and is a separate axis.

Inputs, worst wins, every threshold a config default with per-bird
overrides:

- Failing CI, open bugs: red.
- Unsafe work, uncommitted changes and unpushed commits alike: green
  under 24 hours, amber to 72, red beyond. The age anchor is the oldest
  unsafe change, so editing does not reset the clock on a backlog.
- Stalled flight: parked on a non-default branch with no movement, amber
  at 7 days, red at 30, even with everything pushed.
- Unmet expectations from config: amber at 7 days, red at 30, aged from
  first observation.
- The one-disk-only accelerant (shorter windows when no copy exists
  anywhere) is `TBD`.

A bird whose config loosens the windows can be made never to redden
from work alone, leaving red to CI and bugs.

## The scanner

The scanner is the `@perch/core` package in `packages/core`, and the
paths below are inside it. Two stages, both writing under the gitignored
`.scan/` at the repository root:

- `pnpm gather` reads this machine and the forge accounts in rounds
  (root collectors, then enrichers) and writes raw facts, one JSON file
  per source, to `.scan/raw/`. Types in `src/raw.ts`. Nothing judged;
  every absent value states why.
- `pnpm aggregate` reads only those files and the config, joins
  presences into projects (`src/join.ts`), and writes
  `.scan/snapshot.json`. Types in `src/snapshot.ts`; every derivation
  rule lives in `src/derivations.ts`.

`pnpm scan` runs both; `pnpm check` runs Biome, tsc and vitest.
Scanners are tested against fixtures under `tests/fixtures/`, never the
live machine. The scan feeds the glance unattended: no prompting
routes, no SSH. Detail views may use live sources; the window never
blocks on aggregation and renders from the cached snapshot.

Sources today: local repositories and vaults (git state, Obsidian
markers), the GitHub and Forgejo account listings and per-repository
detail (PRs, CI, newest default-branch commits), roadmap files, Claude
Code session times. Uptime Kuma exists and stays disabled in config
until server monitoring is picked up. Forge tickets are a wanted
source, see the roadmap. The field inventory, with declared types
beside live values, is the atlas (`design/atlas.html`).

## Projects, joining and adoption

A project is a joined entity over presences: a local clone, forge
repositories, vault state. Observation joins what remote URLs prove;
config asserts what they cannot, and on conflict the observation wins,
flagged. Everything found starts on the fence; adopting a bird means
adding it to config, which puts it on a wire and may assert further
ties, importance, thresholds and expectations. Forks are ignored by
default; archived repositories are gathered but never on the main view.
Details and open questions (composite multi-repo projects among them):
[decisions/project-model.md](decisions/project-model.md).

## Configuration

`~/.config/perch/config.toml`, stowed from the dotfiles so backup is a
dotfiles push. It holds: the wires as an ordered named list, include
and ignore paths, forge accounts and addresses, per-project assertions
(joins, importance, display names, thresholds, expectations, key file
lists, zellij session names). No secrets, ever.

## Secrets

Tokens live in the desktop keyring, read at run time with
`secret-tool lookup`, service `perch`: `github-finch`,
`github-the-undev`, `github-skiff-app`, `forgejo-finch`,
`forgejo-the-undev`. All read-only. `gh` is not used at run time; its
tokens carry write scopes and its account state is shared with
interactive use. A password manager holds the human backups only and is never
read at run time, its CLI prompts. Creation and replacement runbook:
[tokens.md](tokens.md).

## Behaviour

- Starts at login, window hidden, icon in the tray. Tray menu: show,
  rescan, quit.
- One instance. A second launch hands its arguments to the running one:
  `--toggle` shows and focuses, or hides when already in front;
  `--show` only shows; `--scan` rescans.
- The global shortcut is a Plasma custom shortcut bound to
  `perch --toggle`. In-app global shortcuts on Wayland are parked, see
  the roadmap.
- Scans run on a timer, on window focus, on `--scan` and from the tray.
  Archived data refreshes in a slower lane. Intervals are config; the
  defaults wait on measuring a full scan's cost.
- The latest snapshot is cached on disk; the window renders from it at
  start and replaces it when a scan finishes. A failing source keeps
  its previous result and shows the error and its age.

## Standing decisions

- **A desktop app rather than a browser page**: the app buys the tray,
  the shortcut, a chromeless window and a process that owns the scan
  timer.
- **Electron rather than Tauri**: decided with reasons in
  [decisions/tech-stack.md](decisions/tech-stack.md); TypeScript end to
  end with the house frontend stack.
- **No database**: see Principles; the first-seen record is a file, not
  a store.
- **Not hosted on the server**: the state the owner loses track of
  lives in working copies this machine holds. The phone view hybrid is
  parked.

## Tooling

A pnpm workspace: the scanner in `packages/core`, the Electron app in
`apps/desktop` with electron-vite, React, TypeScript strict, Tailwind
v4, TanStack Router and Query, shadcn for basics, Biome and vitest.
`pnpm check` covers lint, types and tests, and CI runs it on every push
and pull request. electron-builder packages a Linux AppImage; a `v*` tag
releases it on GitHub. The autostart mechanism is `TBD`: a desktop entry
or a systemd user unit from the dotfiles, decided once tray behaviour
under session restore is known.

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
