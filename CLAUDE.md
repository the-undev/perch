# perch

Desktop app for one machine, showing the state of everything its
owner is working on as birds on wires: git repositories, their remotes and
CI and roadmaps. It lives in the tray and derives
everything it shows from things that already change.

## Read first

- [docs/spec.md](docs/spec.md): what it shows and how it behaves. Read it
  before proposing anything.
- [docs/roadmap.md](docs/roadmap.md): parked work.

## Packages

A pnpm workspace. The code is the reference; this is only a map.

- `packages/core`: the read-only scanner, pure Node. `src/scan.ts` composes
  gather and aggregate, `src/viewmodel.ts` derives what the renderer shows,
  `src/mock.ts` is the snapshot and config pair covering every state.
- `packages/ui`: presentational React components typed against the view
  model, and `src/theme.css`, the one theme. Add shadcn primitives with
  `pnpm dlx shadcn add <name>` from `packages/ui`, then make its `@/`
  imports relative.
- `apps/design`: the design site, a local tool, never deployed.
- `apps/desktop`: the Electron app, split into `src/main`, `src/renderer`
  and the sandboxed `src/preload`.

`apps/design` is the living design site.

## Commands

Run from the root: `pnpm dev` runs the app, `pnpm design` the design site,
`pnpm check` Biome, tsc and vitest, `pnpm scan` a scan into `.scan/`, and
`pnpm dist` builds the AppImage.

## Conventions

- Every behaviour change ships with a test in the same commit. Scanners are
  tested against fixtures under `tests/fixtures/`, never the live machine.
- Dependencies are required parameters, never optional with a null guard.
- A feature the scanner cannot derive goes in the roadmap, with a note on
  what would have to change first.
- Secrets never touch the repository or the disk.
- Work on a branch. `main` moves only on an approved merge.
- Commit messages: imperative subject, a body only when the why is not
  obvious. No attribution trailers.
- British English. No em dashes.
- Design is agreed visually on a mockup page: one new file in `mockups/`
  per round, agreed before implementation, deleted once the round is
  implemented.
- A decision worth keeping goes into the spec or a decision doc when it is
  made. The rest is git history.
- Docs are the minimum a user or a potential dev needs. The code documents
  the code.
