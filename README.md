# perch

[![CI](https://github.com/finch/perch/actions/workflows/ci.yml/badge.svg)](https://github.com/finch/perch/actions/workflows/ci.yml)

A tray app for one PC that shows the state of everything its owner is
working on as birds on wires: git repositories, their remotes and CI,
roadmaps, Claude Code sessions. Everything it shows is read from the machine
or the forges. Electron, built for Arch Linux on KDE Plasma 6.

## Running

Needs Node 26 and pnpm 11. Run `pnpm install` once, then from the root:

| Command | Does |
| --- | --- |
| `pnpm dev` | Runs the desktop app: it scans this machine and the forges and shows the aviary. Its data lives in `~/.local/share/perch`. |
| `pnpm design` | Serves the design site at http://localhost:5174, every component in every state. |
| `pnpm check` | Runs Biome, tsc and vitest across the workspace. |
| `pnpm scan` | Runs the same scan from the command line, into `.scan/raw/` and `.scan/snapshot.json` in the repository. |
| `pnpm dist` | Builds the Linux AppImage into `apps/desktop/dist/`. |
| `pnpm icons` | Renders the app and tray icons from their SVGs in `apps/desktop/resources/`. |

The config is `~/.config/perch/config.toml`. Without it the app offers to
create it: one wire, the standard windows, no sources. Sources
are added on the settings page. `config.example.toml` shows every field
with placeholder values.
Forge tokens come from the desktop keyring, see
[docs/tokens.md](docs/tokens.md).

## Installing

perch is one AppImage on the PATH as `perch`. From the repository root:

```sh
pnpm dist
cp apps/desktop/dist/perch-*-x86_64.AppImage ~/.local/bin/perch
ln -s "$PWD/apps/desktop/resources/perch.desktop" ~/.local/share/applications/perch.desktop
ln -s "$PWD/apps/desktop/resources/perch-autostart.desktop" ~/.config/autostart/perch.desktop
mkdir -p ~/.local/share/icons/hicolor/256x256/apps
ln -s "$PWD/apps/desktop/resources/icons/256x256.png" ~/.local/share/icons/hicolor/256x256/apps/perch.png
```

The first link puts perch in the launcher. The second starts it at login
with the window hidden and its icon in the tray; systemd runs it as the
user unit `app-perch@autostart.service`. The third gives both entries the
icon.

The shortcut is a Plasma custom shortcut: System Settings, Keyboard,
Shortcuts, Add New, Command or Script, with the command `perch --toggle`,
then a key.

A second launch hands its arguments to the running perch and quits:

| Argument | Does |
| --- | --- |
| `--toggle` | Shows and focuses the window, or hides it when it is already in front. |
| `--show` | Shows and focuses the window. A launch with no arguments does the same. |
| `--scan` | Scans now. |
| `--hidden` | On the first launch, starts with the window hidden. |

Closing the window hides it. The tray menu shows it, rescans and quits;
clicking the tray icon toggles the window.

## Releases

Versions are semver, set in `apps/desktop/package.json`. Pushing a tag
`v<version>` that matches it builds the AppImage in CI and attaches it to a
GitHub release.

## More

What it shows and why: [docs/spec.md](docs/spec.md). The design site
(`pnpm design`) shows the real components; the approved board pages it
grew from are in [design/index.html](design/index.html), opened in a
browser.
