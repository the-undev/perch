# Window presentation

How perch appears on screen when summoned.

Status: decided, 20 October 2026

## Decision

A normal desktop window plus the tray icon. Summoned and dismissed by the
global shortcut, hidden rather than quit on close, placed and sized like any
other window. The mockups target a window, not an edge panel.

## Autostart

Decided 22 October 2026. An XDG autostart desktop entry,
`apps/desktop/resources/perch-autostart.desktop`, linked into
`~/.config/autostart/`, runs `perch --hidden`. systemd's
xdg-autostart generator turns each entry into a user unit,
`app-<name>@autostart.service`, started after the graphical session with
its output in the journal and no restart.

## Summoning

A Plasma custom shortcut runs `perch --toggle`. The second launch hands
its arguments to the running instance and quits. That needs no portal or
KWin code; an in-app global shortcut waits on Electron's Wayland support,
see the roadmap.

## Rejected

- **A systemd user unit for autostart.** Needless: the desktop entry
  already runs as one, generated. A hand-written unit would buy only
  restart on failure, which a tray app has not needed.
- **Slide-out edge panel.** The proper mechanism is layer-shell, which
  Electron's Chromium does not speak. The imitation, a frameless window
  forced to an edge by a KWin rule, needed a spike to prove placement and
  raising on Plasma 6 Wayland. Judged not worth the spike; a normal window
  does the job.
- **Plasma widget.** QML, rejected with the native route, see
  [tech-stack](tech-stack.md).

Recorded in case Electron gains layer-shell support: the panel idea was
liked, not disproved.
