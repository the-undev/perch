# perch

Desktop app for one machine, showing the current state of everything
its owner is working on as birds on wires: git repositories, their remotes
and CI, roadmaps, Claude Code sessions. It lives in the tray and derives
everything it shows from things that already change. Nothing in it is typed
in by hand.

## Read first

- [docs/spec.md](docs/spec.md): what it shows, how it behaves, and every
  decision with the reason behind it. Read before proposing anything.
- [docs/roadmap.md](docs/roadmap.md): parked work. Anything worth returning to
  goes there, in a commit, never in chat.
- [docs/build-log.md](docs/build-log.md): dated record of the build-time
  calls Claude made. Append a line whenever a decision is taken that the
  decision docs do not carry.
- [design/index.html](design/index.html): the design board, the approved
  living design pages, opened in a browser. mockups/ holds the retired
  prototype rounds, never edited once their verdicts are recorded.

## State of the repository

A pnpm workspace with two packages. Every command below runs from the root.

`packages/core` (`@perch/core`) is the read-only scanner, pure Node with no
Electron imports. Two stages, both writing under the gitignored `.scan/` at
the repository root:

- `pnpm gather` reads this machine and the forge accounts in two rounds (root
  collectors, then enrichers) and writes raw facts, one JSON file per source,
  to `.scan/raw/`. Types in `src/raw.ts`.
- `pnpm aggregate` reads only those files and the config, joins presences
  into projects (`src/join.ts`), and writes `.scan/snapshot.json`. Types in
  `src/snapshot.ts`; every derivation rule is in `src/derivations.ts`.

`pnpm scan` runs both. Config is `~/.config/perch/config.toml`, or the root
`config.example.toml` when that is absent.

`apps/desktop` (`@perch/desktop`) is the Electron app, built with
electron-vite. It does not use the scanner yet: the window shows a
placeholder page. The main process is `src/main`, the sandboxed preload
`src/preload`, the renderer `src/renderer`. Every renderer call into the main
process is declared in `src/shared/ipc.ts`. shadcn components are added with
`pnpm dlx shadcn add <name>` from `apps/desktop`. Renderer packages are
devDependencies because electron-vite bundles them; shadcn adds its packages
to `dependencies`, so move them.

`pnpm dev` runs the app. `pnpm check` runs Biome over the workspace, then tsc
and vitest in each package. `pnpm dist` builds the AppImage into
`apps/desktop/dist/`; CI releases it from `v*` tags, see the README.

## Conventions

- Electron, TypeScript end to end: Vite, React, TypeScript strict, Tailwind
  v4, TanStack Router and Query, shadcn for basics, Biome, vitest, pnpm. The
  same frontend stack as harbour and skiff; why Electron is in
  `docs/decisions/tech-stack.md`.
- Every behaviour change ships with a test in the same commit. Scanners are
  tested against fixture repositories and files under `tests/fixtures/`, never
  against the live machine.
- Dependencies are required parameters, never optional with a null guard.
- A feature the scanner cannot derive is not a feature. It goes in the roadmap
  with a note on what would have to change first.
- Secrets never touch the repository or the disk. Tokens come from the desktop
  keyring at run time, see the spec.
- Work on a branch. `main` moves only on an approved merge.
- Commit messages: imperative subject, a body only when the why is not
  obvious. No attribution trailers.
- British English in docs, comments and messages. No em dashes.
- Design is explained visually. A new idea gets a prototype page in
  mockups/, a new file per round; an approved page moves to design/ and is
  updated in place. Prefer a page on the board over a markdown explainer;
  the decision docs hold the why.
