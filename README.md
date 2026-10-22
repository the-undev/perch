# perch

A tray app for one PC that shows the current state of everything its
owner is working on, so a project can be picked up where it was left.
Projects are birds on wires: git repositories with their uncommitted and
unpushed work, branches, remotes and CI; each project's roadmap; recent
Claude Code sessions. Click a bird and it tells you how it is doing.

Everything on screen is read from the machine or from GitHub and
Forgejo. Nothing is entered by hand, and only the latest scan is kept.

Electron, TypeScript end to end. Built for one Linux machine: Arch Linux, KDE
Plasma 6 on Wayland.

Requirements: [docs/spec.md](docs/spec.md). Decisions with their
reasons: [docs/decisions/](docs/decisions/). Parked work:
[docs/roadmap.md](docs/roadmap.md). The settled designs are working
pages: open [design/index.html](design/index.html) in a browser.

Status: design settled, scanner proof of concept working. `pnpm scan`
gathers raw facts into `.scan/raw/` and aggregates them into
`.scan/snapshot.json`; `pnpm check` runs Biome, tsc and vitest. The
app build is next.
