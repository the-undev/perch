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

Roots, excluded folders, per-project importance tier, drift thresholds
(global defaults plus per-project overrides), the Forgejo address, the
Uptime Kuma address, the scan interval.

## Open

- Format: TOML is the working assumption, not yet confirmed.
- One file or several (for example `config.toml` plus a `projects.toml` for
  per-project assignments, which Claude will touch most often).
