# Project model

What a project is and how its data is collected. Supersedes the explicit
project list in [config](config.md) and the repo-discovery model in
[sources-and-priority](sources-and-priority.md), both decided a day before
this file; the join answer below also settles the no-remote question from
the first scanner review.

Status: decided, 21 October 2026

## The model

A project is a joined entity, not a local repo with extras. Sources gather
presences independently, and any side may be missing:

- A local clone, from the local git source.
- A forge repo, from the GitHub source (both accounts) and the Forgejo
  source (account listings, not just remotes of local clones). A forge repo
  with no local clone is still a project and still gets data.
- A vault's sync state, later, from LiveSync's CouchDB (metadata only; the
  Pocket vault is end to end encrypted and perch never reads content).
  Needs a verification spike.

Forge listings, decided 21 October 2026: forks are ignored by default,
with config able to name one worth tracking. Repos the forge marks
archived are still gathered, but low priority: they never appear on the
main dashboard view. Each forge gets its own drill-down view listing what
it holds, with an archived group, so the full account contents stay
observable without cluttering the glance.

Aggregation joins presences into projects. A local clone joins forge repos
through its remote URLs, which covers renames (photo-shuttle points at
camera-mover) and dual-push remotes joining one clone to two
forges. Two forge presences with no local clone do not join automatically;
config can assert the link. Anything unjoined is its own item, visibly, so
the full picture prompts archiving, ignoring or adopting.

## Collection as rounds

Collectors are typed: root collectors (config, local directories, forge
accounts) produce presences; enrichers consume them and produce more
(roadmap parsing from local presences, LiveSync state from detected vaults,
PRs and CI from forge presences). The scheduler reruns collectors whose
inputs grew until nothing grows. The chain is two or three rounds deep in
practice; the PoC implements explicit rounds, not a generic dataflow
engine, until a deeper chain exists in reality.

## Observation and assertion

Detect what leaves a trace; config asserts only what does not.

- Observed: a vault is a repo whose root holds `.obsidian/`; LiveSync is
  visible under `.obsidian/plugins/obsidian-livesync/`. Kind detection
  needs no config.
- Asserted in config: importance, ignores, joins the URLs cannot prove,
  per-item overrides (thresholds, zellij session, roadmap paths beyond the
  defaults).
- On conflict the observation wins and the conflict is flagged; stale
  config must be visible, never silently trusted.

## Local git source scope

Config gives include paths, each either a repo or a directory containing
repos, and ignore paths (for example a scratch directory for throwaway
work). A repo found under an include path that config does not know is
flagged loudly as not set up, red, so nothing on disk is silently
untracked.

## Unpushed and unbacked

Unpushed drift is measured against a joined remote presence. A local
presence with no remote is not drifting; it is "local only, one disk",
its own loud state. Decided here, closing the question the first scan
raised (a toy repo showing 371 days of fake drift).

## Composite projects

Open. A bird may be a higher-level thing than one repository: skiff
could grow a native app repo beside the web one, and the Hothouse
project already incorporates the hearth-config repo without a decided
join. The model would be a config-asserted member list per project,
with health rolling up worst-of across members. How a multi-repo
project displays on its detail page is part of the same open question.
Parked until dogfooding shows whether any two things actually want to
be one bird; for now one bird per repository or vault.

## Adoption

With only include paths and forge tokens configured, every found thing
is a bird on the fence. Observation already joins what it can prove: a
local clone whose remotes point at a GitHub and a Forgejo repository is
one thing with three presences, while the same two forge repositories
without a local clone stay two birds. Adopting a bird means adding it
to config: that puts it on a wire, and the same config entry may assert
ties the URLs could not prove.
