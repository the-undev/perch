# Tech stack

What perch is built with.

Status: decided, 20 October 2026

## Decision

Electron, TypeScript end to end. UI: Vite, React, TypeScript strict,
Tailwind v4, TanStack Router and Query, shadcn, Biome, vitest, pnpm, the
house convention shared with harbour, skiff and prism. The scanner is
TypeScript in the main process.

## Why

The UI is the point of the app: always resident, expected to look fancy and
animate smoothly. Electron ships its own Chromium, which renders that
reliably. The costs, a few hundred MB resident and a bigger install, do not
matter on this machine for a single-instance app.

## Rejected

- Tauri + Rust, the original spec's choice. WebKitGTK on this machine's
  NVIDIA Wayland setup crashed until an environment variable workaround was
  found, trails Chromium on animation, and the backend language is one the
  owner does not write. Its advantages, binary size and memory, are the ones
  this project cares least about.
- A native toolkit (Qt/QML would be the honest fit on Plasma) was not taken:
  it abandons the house stack and the owner's web skills. Accepted with
  reluctance; the owner's view is that a desktop app *should* be native, and
  the browser runtime is a pragmatic concession, not a preference.
