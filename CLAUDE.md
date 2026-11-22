# Perch

A desktop app for one machine. It shows the state of everything its owner
works on as birds on wires: git repositories, their remotes and CI, and
roadmaps. It lives in the tray.

## Principles

- Everything shown is derived from files, repositories or APIs. Nothing is typed in
  but the owner's config and local state, such as snoozes.
- The scanner is read only. Launch actions open things and change nothing.
- Perch shows facts, not advice.
- Only the latest scan is kept.
- Everything machine-specific lives in config, or in local state in the app's data
  directory, which is never written to config.

Parked work is in [docs/roadmap.md](docs/roadmap.md).

## Packages

A pnpm workspace. The code is the reference; this is a map.

- `packages/core`: the read-only scanner, pure Node. `src/scan.ts` composes
  gather and aggregate, `src/viewmodel.ts` derives what the renderer shows,
  `src/mock.ts` is the snapshot and config pair covering every state.
- `packages/ui`: presentational React components typed against the view
  model, and `src/theme.css`, the one theme. Add shadcn primitives with
  `pnpm dlx shadcn add <name>` from `packages/ui`, then make its `@/`
  imports relative.
- `apps/design`: the design site, a local tool, never deployed. It is the
  living design reference.
- `apps/desktop`: the Electron app, split into `src/main`, `src/renderer`
  and the sandboxed `src/preload`.

## Commands

Run from the root.

| What | Command |
| --- | --- |
| Full check: Biome, tsc, vitest and the build | `make check` |
| Dev instance: data in `~/.local/share/perch-dev`, config in `~/.config/perch-dev/config.toml` | `make dev` |
| Isolated run: data and config in a temp directory deleted on exit; opens a window, no URL | `make isolated` |
| Design site | `pnpm design` |
| A scan into `.scan/` | `pnpm scan` |
| The AppImage | `pnpm dist` |

The installed AppImage is the owner's live app, on `~/.local/share/perch`
and `~/.config/perch/config.toml`. Nothing touches it.

## Ports

| What | Port |
| --- | --- |
| Dev instance renderer | 5175 |
| Isolated run renderer | 5176 |
| Design site | 5174 |

## Workflow

A change goes into `main` by a pull request on GitHub, merged once
approved. `origin` fetches from GitHub.

## Conventions

- Scanners are tested against fixtures under `tests/fixtures/`.
- A feature the scanner cannot derive goes in the roadmap, with a note on
  what would have to change first.
- Design is agreed visually on a mockup page: one new file in `mockups/`
  per round, agreed before implementation, deleted once the round is
  implemented.
