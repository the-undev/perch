# Config

Where configuration lives, its format, and how it is backed up.

Status: open

## Decided so far

Decided 20 October 2026.

- Config is plain text files under `~/.config/perch/`, stowed from the
  dotfiles repository (a `perch` stow package), so editing the live config
  edits the repo copy and the dotfiles push is the backup. No separate
  backup story needed.
- It must read well in a diff. Revised 23 October 2026: the live config is
  machine-written TOML without comments, because the settings UI writes it
  back. Diffs stay readable because the writer's output is deterministic:
  the same config always gives the same bytes. `config.example.toml`
  remains the commented reference for every field. This replaces the
  earlier requirement that the file carry comments for humans and Claude
  editing it by hand.
- Paths are written and shown with `~`. Decided 23 October 2026: the
  config holds include and ignore paths and zellij session roots expanded
  against the home directory, and the writer and the settings page put a
  path at or under the home directory back as `~/...`. A `~/dev` typed by
  hand survives every save; an absolute path under the home directory,
  such as `/home/owner/dev`, comes back as `~/dev`. Paths elsewhere stay
  as they are.
- No secrets in config. Tokens come from the desktop keyring at run time,
  the same entries in dev and in the app: `service perch` with one key per
  forge account (`github-finch`, `github-the-undev`,
  `github-skiff-app`, `forgejo-finch`, `forgejo-the-undev`), stored
  once with `secret-tool store` and read with `secret-tool lookup`. All three
  are read-only tokens: fine-grained GitHub PATs (contents, metadata,
  actions and pull requests, read only) and a Forgejo read-only token. This
  replaces the spec's `gh auth token` route, for two reasons: those tokens
  carry write scopes perch must not hold, and perch must not share state
  with the `gh` the owner uses interactively, which has one active account
  that switches; the app integrates with the forges directly, not through
  another tool's login. Human backup copies live in a password manager, which
  is never read at run time. Decided 21 October 2026.

- Sources are repeatable tables. Decided 23 October 2026: one
  `[[sources.<kind>]]` table per connection (`local`, `github`,
  `forgejo`, `kuma`), each carrying everything that connection needs,
  so two GitHub accounts are two tables and a new source kind is a new
  table name. The `[local]`, `[forges]` and `[server]` tables are gone
  and `finalised_commits` lives under `[scan]`. A config with no
  sources is valid: perch starts from nothing and every source is
  added, never assumed. The starter config is generated from the
  default `Config` through the writer; `config.example.toml` is a
  commented reference whose values are placeholders only. Perch may
  store a pasted token into the keyring, and never reads one back to
  show.

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
