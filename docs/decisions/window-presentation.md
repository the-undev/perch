# Window presentation

How perch appears on screen when summoned.

Status: decided, 20 October 2026

## Decision

A normal desktop window plus the tray icon. Summoned and dismissed by the
global shortcut, hidden rather than quit on close, placed and sized like any
other window. The mockups target a window, not an edge panel.

## Rejected

- **Slide-out edge panel.** The proper mechanism is layer-shell, which
  Electron's Chromium does not speak. The imitation, a frameless window
  forced to an edge by a KWin rule, needed a spike to prove placement and
  raising on Plasma 6 Wayland. Judged not worth the spike; a normal window
  does the job.
- **Plasma widget.** QML, rejected with the native route, see
  [tech-stack](tech-stack.md).

Recorded in case Electron gains layer-shell support: the panel idea was
liked, not disproved.
