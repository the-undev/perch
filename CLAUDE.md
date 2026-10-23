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
  design pages, opened in a browser, kept as the approved record. The design
  site (`pnpm design`) is its living successor on the real components.
  mockups/ holds the retired prototype rounds, never edited once their
  verdicts are recorded.

## State of the repository

A pnpm workspace with four packages. Every command below runs from the root.

`packages/core` (`@perch/core`) is the read-only scanner, pure Node with no
Electron imports. `src/scan.ts` composes it, every directory and the config
path a parameter: the CLI writes under the gitignored `.scan/` at the
repository root, the desktop app under `~/.local/share/perch/scan/`. Two
stages:

- Gather (`pnpm gather`) reads this machine and the forge accounts in three
  rounds (root collectors, then enrichers, then the roadmap reader, which
  resolves each clone's config entry through the join) and writes raw
  facts, one JSON file per source, to `raw/`. Types in `src/raw.ts`.
- Aggregate (`pnpm aggregate`) reads only those files, the config and the
  previous snapshot, joins presences into projects (`src/join.ts`), and
  writes `snapshot.json`. Types in `src/snapshot.ts`; every derivation rule
  is in `src/derivations.ts`.

The renderer reads only the view model: `src/viewmodel.ts` derives the
aviary, each bird, its bubble and its detail from a snapshot and the config
by pure functions, with the speech in `src/speech.ts`. `src/mock.ts` is a
hand-curated snapshot and config pair that covers every view model state,
imported as `@perch/core/mock.ts`; `tests/mock.test.ts` fails if it drifts
from the rules or loses a state.

`pnpm scan` runs both. Config is `~/.config/perch/config.toml`, its
sources declared as `[[sources.<kind>]]` tables. The CLI scans with
`defaultConfig()` (`src/config-default.ts`) when that is absent. The app
reads only the config file; without it the window shows a welcome screen
that writes the default config there as a starter. The root
`config.example.toml` is a commented reference with placeholder values;
nothing reads it but the tests and the design site.

`packages/ui` (`@perch/ui`) holds the React components of the design,
typed against the view model only: the bird, wire, fence and sky scene, the
bubble and chips, the detail page's pieces (ledger and its sections,
launch actions, links out, key-file paper), and the config forms: the
entry forms and the settings pages behind the rail, built from
`form-parts.tsx`.
Components are presentational:
no fetching and no clock; the caller passes `night`, a `now` Date and
callbacks. `src/theme.css` is the one theme, Tailwind v4 tokens taken from
`design/perch.html`; each app imports it after `tailwindcss`. shadcn
primitives live in `src/primitives`, added with `pnpm dlx shadcn add <name>`
from `packages/ui`; rewrite the `@/` imports it writes to relative ones,
because the apps resolve ui's sources with their own settings.

`apps/design` (`@perch/design`) is the design site, a Vite and React app
served by `pnpm design`: an index and one usage page per component and
primitive, every state rendered from the mock dataset with the rule behind
it. A page is a component in `src/pages` and one entry in
`src/registry.ts`. It is a local tool, never deployed.

`apps/desktop` (`@perch/desktop`) is the Electron app, built with
electron-vite. The main process (`src/main`) reads the config, runs the scan
at start, on the config's interval, on window focus and on request
(`scan-scheduler.ts`), keeps the snapshot cache, derives the aviary,
reads key files and turns entry and settings edits into config edits
(`app-state.ts`), writes the config file (`config-edit.ts`), rereads it
when it changes on disk (`config-watch.ts`), runs launch actions
(`launch.ts`), and stores a pasted token in the keyring and tests a
forge card's connection (`keyring.ts`). Its data lives in
`~/.local/share/perch`, Electron's userData. The renderer (`src/renderer`) receives only view model types and
the form types from `@perch/core/entry-form.ts` and
`@perch/core/settings-form.ts`, never a `Config`: TanStack Query holds the
pushed state and rereads the open forms on every push, TanStack Router
holds where the camera points (`/` and `/bird/<id>`), and `CameraView`
draws it; `/settings` draws `SettingsView`, reached from the camera
header, in its place. The sandboxed preload
(`src/preload`) exposes the calls declared in `src/shared/ipc.ts`. Main
tests run in node, renderer tests in jsdom against a fake preload API
(`fake-api.ts`). Workspace packages are devDependencies because
electron-vite bundles them. The app lives in the tray (`tray-menu.ts`):
closing hides the window, and a second launch hands its arguments over
(`command-line.ts`, `window-presence.ts`). `resources/` holds the icon
SVGs, the PNGs `pnpm icons` renders from them, and the desktop entries
for the launcher and autostart.

`pnpm dev` runs the app, `pnpm design` the design site. `pnpm check` runs Biome over the workspace, then tsc
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
