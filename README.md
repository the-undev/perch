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
| `pnpm dev` | Runs the desktop app. |
| `pnpm check` | Runs Biome, tsc and vitest across the workspace. |
| `pnpm scan` | Gathers raw facts into `.scan/raw/` and aggregates them into `.scan/snapshot.json`. |
| `pnpm dist` | Builds the Linux AppImage into `apps/desktop/dist/`. |

## Releases

Versions are semver, set in `apps/desktop/package.json`. Pushing a tag
`v<version>` that matches it builds the AppImage in CI and attaches it to a
GitHub release.

## More

What it shows and why: [docs/spec.md](docs/spec.md). The design board:
open [design/index.html](design/index.html) in a browser.
