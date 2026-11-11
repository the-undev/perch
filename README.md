# Perch

[![CI](https://github.com/the-undev/perch/actions/workflows/ci.yml/badge.svg)](https://github.com/the-undev/perch/actions/workflows/ci.yml)

A desktop app that shows each of your coding projects as a little bird. A
bird's mood reflects how its project is going, so you can see at a glance
which ones need your attention.

> **Early development:** expect large changes.

## Data sources

- **Local git repositories:** branches, uncommitted and unpushed work.
- **GitHub and Forgejo:** your repositories, their pull requests and CI runs.
- **Roadmaps:** Markdown files listing open items.

## Launch actions

A bird can open its project in VS Code, nvim, Obsidian (for a vault), the
file manager or a zellij tab, or run a custom command.

## Install

Download the AppImage from the
[releases page](https://github.com/the-undev/perch/releases), make it
executable and run it. The settings page says when a newer release is out,
and can replace the AppImage itself.

## Configuration

The config is `~/.config/perch/config.toml`. Without it, the app offers to
create one: one wire, the standard windows, no sources. Add sources on the
settings page. `config.example.toml` shows every field with placeholder
values. Forge tokens come from the desktop keyring, see
[docs/forge-access.md](docs/forge-access.md).

## Development

An Electron app. It needs Node 26 and pnpm 11. Run `pnpm install` once, then
from the root:

| Command       | Does                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`    | Runs the desktop app: it scans this machine and the forges and shows the aviary. Its data lives in `~/.local/share/perch`. |
| `pnpm design` | Serves the design site at http://localhost:5174, every component in every state.                                           |
| `pnpm check`  | Runs Biome, tsc and vitest across the workspace.                                                                           |
| `pnpm scan`   | Runs the same scan from the command line, into `.scan/raw/` and `.scan/snapshot.json`.                                     |
| `pnpm dist`   | Builds the Linux AppImage into `apps/desktop/dist/`.                                                                       |
| `pnpm icons`  | Renders the app and tray icons from their SVGs in `apps/desktop/resources/`.                                               |

### Making a release

From an up-to-date `main`, run:

```sh
pnpm release <version>
```

It bumps the version, merges, tags and pushes. CI then builds the AppImage
and publishes the GitHub release.
