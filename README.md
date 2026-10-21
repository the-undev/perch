# perch

A tray app for one PC that shows the current state of everything its owner is
working on, so a project can be picked up where it was left. Git repositories
with their uncommitted and unpushed work, branches, remotes and CI; each
project's roadmap; recent Claude Code sessions; recently played Steam games.

Everything on screen is read from the machine or from GitHub, Forgejo and
Steam. Nothing is entered by hand and nothing is stored beyond the last scan.

Tauri 2, Rust backend, React frontend. Built for one Linux machine: Arch Linux, KDE
Plasma 6 on Wayland.

Requirements and decisions: [docs/spec.md](docs/spec.md). Parked work:
[docs/roadmap.md](docs/roadmap.md).

Status: scanner proof of concept. `pnpm scan` gathers raw facts into
`.scan/raw/` and aggregates them into `.scan/snapshot.json`.
