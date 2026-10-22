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

The config is `~/.config/perch/config.toml`; without it the app reads
`config.example.toml`, which shows every field. Forge tokens come from the
desktop keyring, see [docs/tokens.md](docs/tokens.md).

## Releases

Versions are semver, set in `apps/desktop/package.json`. Pushing a tag
`v<version>` that matches it builds the AppImage in CI and attaches it to a
GitHub release.

## More

What it shows and why: [docs/spec.md](docs/spec.md). The design site
(`pnpm design`) shows the real components; the approved board pages it
grew from are in [design/index.html](design/index.html), opened in a
browser.
