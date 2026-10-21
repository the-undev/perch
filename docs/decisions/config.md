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
- No secrets in config. Tokens come from the desktop keyring at run time,
  the same entries in dev and in the app: `service perch` with keys
  `github-finch`, `github-the-undev` and `forgejo-token`, stored once
  with `secret-tool store` and read with `secret-tool lookup`. All three
  are read-only tokens: fine-grained GitHub PATs (contents, metadata,
  actions and pull requests, read only) and a Forgejo read-only token. This
  replaces the spec's `gh auth token` route, for two reasons: those tokens
  carry write scopes perch must not hold, and perch must not share state
  with the `gh` the owner uses interactively, which has one active account
  that switches; the app integrates with the forges directly, not through
  another tool's login. Human backup copies live in a password manager, which
  is never read at run time. Decided 21 October 2026.

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
