# Launch actions

Opening things from a tile. In v1, unlike mutations.

Status: open

## Decided so far

Decided 20 October 2026.

- Launch actions are in v1. They change nothing the scanner reads, so the
  read-only principle is untouched; only mutating actions (push, commit)
  stay parked.
- From a project tile: open a terminal in the project directory, open the
  project in the editor, open the forge or CI page in the browser. From a
  vault tile: open the vault in Obsidian. `claude --resume` in a terminal
  is a later addition, see the roadmap's Claude Code section.
- The terminal and editor commands are config values, not hard-coded.
- "Open terminal" drives zellij rather than opening windows. The owner keeps
  two long-lived sessions, `home` and `undev`, with one tab per project.
  Config maps each project to a session, defaulting by root (`~/undev` to
  `undev`, the rest to `home`). The action: if the session has a tab named
  after the project, `zellij --session <s> action go-to-tab-name <name>`,
  else `new-tab --name <name> --cwd <dir>`; then raise the alacritty window
  attached to that session. If the session is not running,
  `alacritty -e zellij attach -c <session>`. Verified on zellij 0.45.1 on
  20 October 2026: outside targeting, `query-tab-names`, `new-tab --name
  --cwd` all work. Decided 20 October 2026.

- Actions sit on a right-click context menu per tile, and the list is
  configured per tile: a repo offers the zellij tab, VS Code and the file
  manager; a vault offers Obsidian and the same; a TUI tile offers run or
  focus. Left click stays drill-down. Decided 20 October 2026.
- Vaults open directly in the right vault via the URI handler:
  `xdg-open "obsidian://open?vault=<name>"`. No vault switching.
- Open directory uses `dolphin <dir>` (or `xdg-open` equivalently).
- TUI tiles (oxbow and spool from `~/undev`, installed via `make
  install`): perch launches them in tagged windows,
  `alacritty --class perch-<name> -e <name>`. Running is a process check;
  if running, focus the tagged window instead of launching. Decided
  20 October 2026.

## Open

- Raising and focusing another app's window on Wayland (the zellij session's
  alacritty window, tagged TUI windows by class) still needs a working
  route, likely a KWin script or `kdotool`. No longer a spike of its own
  after the edge-panel idea was dropped, see
  [window-presentation](window-presentation.md); it is verified when launch
  actions are implemented, and the fallback is selecting the tab without
  raising the window.
- Focusing a TUI instance the owner started by hand inside a zellij tab:
  `zellij action dump-layout` exposes running commands per tab, so this is
  possible as best-effort, allowed to fail to a plain launch.
- Whether `EDITOR`/nvim wants its own menu entry or the zellij tab covers
  it. Default: the tab covers it.
