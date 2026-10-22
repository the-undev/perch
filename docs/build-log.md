# Build log

Decisions made by Claude during the build, dated, newest last. Design
decisions with lasting weight live in docs/decisions/; this log records the
build-time calls so they can be revisited.

## 22 October 2026

- Biome excludes `design/` and `mockups/`: the pages are recorded rounds,
  never edited, and linting them blocked `pnpm check`.
- The pre-build data placement audit is dropped; building starts straight
  away, iteratively. The placement decisions themselves stay in
  docs/decisions/data-placement.md.
- Repository layout: pnpm workspace. `packages/core` holds the scanner,
  contracts, derivations and config (the part a future server or phone app
  would import); `packages/ui` the visual components; `apps/desktop` the
  Electron app; `apps/design` the design site. Core and desktop arrive
  first, the rest with their build phases.
- Electron tooling: electron-vite for dev and bundling, electron-builder
  for the AppImage.
- Versioning: semver from 0.1.0. CI runs `pnpm check` on every push; a
  `v*` tag builds the AppImage and attaches it to a GitHub release. In-app
  auto-update is parked on the roadmap.
- The periodic scan runs inside the Electron main process while the app
  sits in the tray. No separate service or systemd unit. Recorded in
  docs/decisions/scan-model.md.
- Design site: hand-rolled Vite and React site rather than Storybook. It
  needs bespoke spec pages, composition scenes and theming review, and it
  is the design board's successor, so it should look like perch. Every
  component in use gets a usage page with its states, shadcn ones
  included.
- appId: `com.github.finch.perch`. Reverse-DNS form and stability are
  the only constraints; the rest was a coin toss.
- Build process: one Opus subagent per phase on its own branch; the main
  session reviews the diff, tests and check output, then merges no-ff to
  main and pushes.
