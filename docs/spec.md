# Specification

What perch shows, how it behaves, and the decisions behind it. Written before
any code, on 20 October 2026, from a design conversation. The code follows this
document; when the two differ, this one is wrong or the code is.

## Purpose

The owner has many projects in flight: personal repositories, undev
repositories, dotfiles, two Obsidian vaults, media organising, and a family
PC. Work moves between them in short bursts, and the cost is working out,
each time, what state a project was left in and what was meant to happen next.

perch answers that from one window. It is a dashboard of the owner, not of a
server: projects first, with other things the owner does on this machine
alongside.

## Principles

- **Derived, never entered.** Every value on screen comes from a file, a
  repository or an API that changes as a side effect of normal work. If a
  value would need typing in, it is not shown. "What is next" comes from each
  project's roadmap file, which is already where parked work goes.
- **Read only.** The scanner changes nothing it reads. Actions from the app are
  parked, see the roadmap.
- **No history.** Only the latest scan is kept. Git, the forge APIs and the
  Claude Code session files already hold history, and nothing on screen needs
  a record of the scanner's own past observations. The latest scan is cached
  to disk only so the window opens with content after a restart.
- **One machine.** One Linux machine, Plasma 6, Wayland. There is no portability
  requirement, so platform-specific routes are taken when they are simpler.

## What it shows

### Overview

One tile per item, grouped by source, ordered so the thing most likely to need
attention is first: uncommitted or unpushed work, then a failing CI run, then
by time since the item was last touched. Each tile carries the item's name,
its last-touched time and the one or two numbers that matter for its source.
Clicking a tile opens its detail view.

### Projects source

A project is a git repository found under a configured root. Roots for this
machine: `~/dev`, `~/undev`, `~/.dotfiles`, `~/obsidian/Hothouse`,
`~/obsidian/Pocket`. Repositories nested under `archived`, `all` and
`third-party` folders are still found; whether they get a tile is a config
choice, default on.

Tile: name, current branch, uncommitted file count, unpushed commit count,
time since last commit, time since the last Claude Code session in that
directory.

Detail, all read from the working copy:

- Branch, uncommitted files, commits ahead of and behind the tracking branch.
- Local branches with their last commit date and subject, newest first, so an
  in-progress branch is visible even when `main` is clean.
- Recent commits on `main`.
- Remotes, with the address and the identity it resolves to.
- Open items from the project's roadmap file. The file is whichever of
  `docs/roadmap.md`, `ROADMAP.md`, `Roadmap.md` or `TODO.md` exists, and for
  a vault the area roadmaps such as `Tech/Tech Plans.md`. Open items are the
  unchecked checkboxes, or the headings when the file has none.
- The last Claude Code session's date for the directory, read from
  `~/.claude/projects/<encoded path>/*.jsonl`. The encoding replaces `/` with
  `-`. What else to read from a session is parked, see the roadmap.

### Remotes source

For each project with a GitHub or Forgejo remote: open pull requests, and the
latest CI run on the default branch with its state. The GitHub account is
chosen by the owner in the remote address, `finch` or `the-undev`, and the
matching token comes from `gh auth token --user <owner>`. Forgejo is reached
at its home address with a read-only token from the desktop keyring, see
Secrets.

### Steam source

Recently played games with last-played time and total playtime, read from the
Steam client's own files: `~/.local/share/Steam/userdata/<account>/config/localconfig.vdf`
holds per-app `LastPlayed` and playtime, and the app manifests under the
library folders hold the names. One account exists on this machine, so the
account id is discovered rather than configured. No API key, no network, no
change to profile privacy.

### Server tile

The home server already runs the dashboard with tiles for every service. perch
links to it rather than repeating it. A service worth seeing without clicking
through becomes a source module later, see the roadmap.

## Behaviour

- Starts at login, window hidden, icon in the tray. Tray menu: show, rescan,
  quit.
- One instance. A second launch hands its arguments to the running one and
  exits. `--toggle` shows and focuses the window, or hides it if it is already
  in front. `--show` only shows. `--scan` triggers a rescan.
- The global shortcut is a Plasma custom shortcut bound to `perch --toggle`,
  set in System Settings. The README documents the binding once it exists.
- Scans run on a timer, on the window gaining focus, on `--scan` and from the
  tray. The timer interval is a config value; the default is `TBD` until the
  cost of a full scan is measured.
- The latest scan is held in memory and written to one JSON file under
  `~/.cache/perch/`. The window renders from that file at start and replaces
  it when a scan finishes. A source that fails keeps its previous result and
  shows the error and its age.
- Config lives in `~/.config/perch/config.toml`: roots, folders to exclude,
  the Forgejo address, the scan interval. No secrets.

## Secrets

- GitHub: both accounts are logged in to `gh`, which keeps their tokens in the
  desktop keyring. perch runs `gh auth token --user <owner>` and never sees
  the keyring directly.
- Forgejo: a read-only token created in the web interface under Settings then
  Applications, stored once with `secret-tool store` and read with
  `secret-tool lookup`, both backed by the same keyring `gh` uses. The exact
  scope set is chosen when the token is created and recorded here.
- A password manager is not used at run time. Its CLI prompts for unlock, and a scan on
  a timer cannot answer a prompt. A password manager keeps the human copy of the Forgejo
  token, `the password manager > Tech > Forgejo`, user `finch`.

## Decisions

Each one records the reason, because the configuration shows what was chosen
and nothing else shows why.

### A desktop app rather than a page in the browser

A local web page would show the same pixels. The app buys a tray icon, a
global shortcut, its own window with no browser chrome, and a process that
starts at login and owns the scan timer, so no separate service unit.

### Tauri rather than Electron

The existing desktop project, prism, is Electron, so Electron was the
known path. Tauri was chosen for a small binary and a system webview, with
two risks checked on this machine before deciding:

- Rendering. On 20 October 2026 a bare WebKitGTK 2.54.1 window on this
  machine (nvidia-open 615, Plasma 6.7.5, Wayland) crashed with
  `Error 71 (Protocol error) dispatching to Wayland display`, the failure the
  Tauri Linux graphics page describes. With `__NV_DISABLE_EXPLICIT_SYNC=1` set
  it rendered gradients, shadows, a CSS animation and a backdrop blur
  correctly. That variable keeps hardware rendering, so the app sets it in
  `main()` before creating the webview. `WEBKIT_DISABLE_DMABUF_RENDERER=1`
  also rendered correctly and is the fallback; it gives up the fast path.
- Tray. Tauri's tray uses libayatana-appindicator, installed here, and
  Plasma's StatusNotifier area shows it without configuration.

The cost is a Rust backend in a language the owner does not write today.
Accepted: Rust is statically typed, which was the requirement, and the
scanning code is small.

### Global shortcut through Plasma, not the Tauri plugin

Tauri's global shortcut plugin works on X11 only. The pull request adding
Wayland support through the desktop GlobalShortcuts portal was still open on
10 October 2026. A Plasma custom shortcut that runs `perch --toggle`, with
the single-instance plugin forwarding the argument, needs no portal code and
works on the one desktop this runs on. If the plugin gains Wayland support the
in-app route can replace it, see the roadmap.

### The frontend stack is the house convention

Vite, React, TypeScript strict, Tailwind v4, TanStack Router and Query,
shadcn, Biome, vitest and pnpm, because harbour and skiff use them and no
decision was needed. TypeScript throughout the UI was a requirement: earlier
projects that rendered HTML from templates became unmaintainable as they grew.

### No database

See Principles. The one thing a stored history would add is the scanner's own
past observations, and nothing on screen depends on them. "Uncommitted for
eleven days" is approximated from the dirty files' modification times against
the last commit.

### Not hosted on the server

A server-hosted dashboard could read GitHub and Forgejo but not the working
copies, which is where the state the owner loses track of lives: uncommitted
files, unpushed branches, roadmap edits, Claude Code sessions. A hybrid, with
this machine pushing a snapshot to the server for a phone view, was judged
more moving parts than the phone view is worth today. It is parked.

### Keyring, not a password manager, at run time

See Secrets. The decisive fact is that `gh auth token` already works
unattended on this machine because the keyring unlocks at login.

## Tooling

To be set up by the first build session.

- Rust via `rustup`, installed by the dotfiles: `rustup` is in
  `1-packages.sh` and `scripts/install-rust-toolchain.sh` sets the stable
  toolchain with rust-analyzer, clippy and rustfmt.
- Tauri 2 scaffold with the Vite React TypeScript template, pnpm. Tauri's
  other Linux build dependencies (webkit2gtk-4.1, openssl, librsvg,
  libayatana-appindicator, base-devel) were all present on 20 October 2026.
- Autostart mechanism: `TBD`. Candidates are Tauri's autostart plugin, which
  writes a desktop entry under `~/.config/autostart`, and a systemd user unit
  from the dotfiles. Decide at scaffold time, once it is known whether the
  tray survives a Plasma session restore either way.
- A `pnpm check` that runs Biome, typecheck, vitest, `cargo clippy` and
  `cargo test`.

## Environment, as of 20 October 2026

Facts the design relies on. Verify before relying on them later.

| Fact | Value |
| --- | --- |
| Desktop | KDE Plasma 6.7.5, Wayland |
| GPU | NVIDIA RTX 5070 Ti, nvidia-open 615, with Intel integrated graphics also present |
| WebKitGTK | 2.54.1 (`webkit2gtk-4.1`) |
| Node, pnpm | 26, 11 |
| `gh` accounts | `finch`, `the-undev`, both with `repo` and `workflow` scopes |
| Forgejo | `http://forge.example.lan:3000`, SSH alias `forgejo` on port 2222, documented in the Hothouse vault at `Tech/Server/Forgejo.md` |
| Steam account directories | one, under `~/.local/share/Steam/userdata/` |
| Claude Code sessions | `~/.claude/projects/`, one directory per working directory |
| Git identities | `~/dev` and `~/.dotfiles` are `finch`, `~/undev` is `the-undev`; see the Pocket vault, `Code/Git Identities.md` |
