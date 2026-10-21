# Config

Where configuration lives, its format, and how it is backed up.

Status: open

## Decided so far

Decided 20 October 2026.

- Config is plain text files under `~/.config/perch/`, stowed from the
  dotfiles repository (a `perch` stow package), so editing the live config
  edits the repo copy and the dotfiles push is the backup. No separate
  backup story needed.
- Both humans and Claude edit it, so it must read well in a diff and carry
  comments.
- No secrets in config. Tokens come from the keyring at run time.

## Known contents so far

Superseded on the same day by [project-model](project-model.md): config is
itself a source of assertions, not a closed project list. It holds the
local include and ignore paths, the forge accounts, joins the remote URLs
cannot prove, importance, ignores and per-item overrides (drift thresholds,
zellij session, roadmap paths beyond the defaults). Discovery under the
include paths is app behaviour; an unconfigured find is flagged, not
hidden.

Also: drift threshold defaults, the Forgejo address, the Uptime Kuma address
and slug, the scan interval, launcher commands.

## Open

- Format: TOML is the working assumption, not yet confirmed.
- One file or several (for example `config.toml` plus a `projects.toml` for
  per-project assignments, which Claude will touch most often).
