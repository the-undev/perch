# perch

Desktop app for one machine, showing the current state of everything
its owner is working on: git repositories, their remotes and CI, roadmaps,
Claude Code sessions, Steam. It lives in the tray and derives everything it
shows from things that already change. Nothing in it is typed in by hand.

## Read first

- [docs/spec.md](docs/spec.md): what it shows, how it behaves, and every
  decision with the reason behind it. Read before proposing anything.
- [docs/roadmap.md](docs/roadmap.md): parked work. Anything worth returning to
  goes there, in a commit, never in chat.

## State of the repository

Documentation only. No code and no scaffold yet. The first build session
scaffolds the project from the Tooling section of the spec, once the Rust
toolchain is installed by the dotfiles script named there.

## Conventions

- Tauri 2. Rust in `src-tauri/`, the UI in `src/`: Vite, React, TypeScript
  strict, Tailwind v4, TanStack Router and Query, shadcn, Biome, vitest, pnpm.
  The same frontend stack as harbour and skiff.
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
