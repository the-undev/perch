# Build log

Decisions made by Claude during the build, dated, newest last. Design
decisions with lasting weight live in docs/decisions/; this log records the
build-time calls so they can be revisited.

## 22 October 2026

- Biome excludes `design/` and `mockups/`: the pages are recorded rounds,
  never edited, and linting them blocked `pnpm check`.
- The pre-build data placement audit is dropped; building starts straight
  away, iteratively. The placement decisions themselves stay in
  docs/decisions/data-placement.md.
- Repository layout: pnpm workspace. `packages/core` holds the scanner,
  contracts, derivations and config (the part a future server or phone app
  would import); `packages/ui` the visual components; `apps/desktop` the
  Electron app; `apps/design` the design site. Core and desktop arrive
  first, the rest with their build phases.
- Electron tooling: electron-vite for dev and bundling, electron-builder
  for the AppImage.
- Versioning: semver from 0.1.0. CI runs `pnpm check` on every push; a
  `v*` tag builds the AppImage and attaches it to a GitHub release. In-app
  auto-update is parked on the roadmap.
- The periodic scan runs inside the Electron main process while the app
  sits in the tray. No separate service or systemd unit. Recorded in
  docs/decisions/scan-model.md.
- Design site: hand-rolled Vite and React site rather than Storybook. It
  needs bespoke spec pages, composition scenes and theming review, and it
  is the design board's successor, so it should look like perch. Every
  component in use gets a usage page with its states, shadcn ones
  included.
- appId: `com.github.finch.perch`. Reverse-DNS form and stability are
  the only constraints; the rest was a coin toss.
- Build process: one Opus subagent per phase on its own branch; the main
  session reviews the diff, tests and check output, then merges no-ff to
  main and pushes.
- Unsafe work ages in hours, matching the 24 and 72 hour windows in
  docs/decisions/data-placement.md. The snapshot's drift carries the
  uncommitted and unpushed ages separately, each with its own level.
  Config's `[drift]` becomes `[thresholds]`, six keys for the three
  windows, the same keys per item; amber must open before red.
- Stalled flight ages from the newest commit on the branch HEAD is on.
  Uncommitted edits are not movement: they age as unsafe work. A
  detached HEAD, or a clone with no default branch, never stalls.
- Expectations are `ci` and `tickets`. CI is met when any readable
  forge presence has a CI result on its default branch; an unreadable
  forge counts as none. Tickets are never met until the forge issues
  source exists. The first-seen record is the previous snapshot, read
  by `pnpm aggregate` before it writes the new one.
- An entry in config `items` adopts a bird; it sits on the entry's wire,
  else `wires.default`. The example config puts the two vaults on
  Machine & Home under the phrasebook's names.
- Health is the worst of CI, bugs, unsafe work, stalled flight and
  unmet expectations. Flags are not inputs: not set up is the fence's
  own situation. Only amber and red inputs are causes; ties speak in
  that order.
- Along a wire: worst mood leftmost, then the more important tier, then
  the name. The fence is ordered by name. Every configured wire appears,
  empty or not.
- A fence bird speaks only of where it stands, carries no chips and
  sleeps at night. Its mood is still derived; the bubble's word is "not
  adopted".
- The server item is not a bird until server monitoring is picked up.
- Activity is editing, in flight or settled, from the git work-state,
  and null without a local clone.
- Size is the importance tier, its rank and the tier count; the
  renderer turns that into pixels. Plumpness is open roadmap items, bugs
  included, capped at 50.
- Speech names durations measured at the scan ("for 30 hours", "for two
  days"), never weekdays, so the model needs no clock or time zone:
  hours under two days, then days, weeks under thirty days, months
  beyond; counts in words up to twenty. Two content lines the
  phrasebook lacks: "Out on {branch}. All fresh so far." and "{N}
  commits waiting to go up. All fresh so far." Last touched is the
  newest commit, local or on a forge. "Just pushed" stays a candidate.
- Only a sleeping bird gains the waking prefix, per the bird language;
  the model carries the woken speech beside the plain one.
- Chips run CI, unmet expectations, bugs, uncommitted, unpushed, open
  PRs, open items. The CI chip shows the worst state across forges.
  A chip's severity is its fact's amber or red, else none.
- Ledger: a clean zero is "none" in green; a count takes amber or red
  from its judged level, else no tone; CI success is green. A clone with
  no remote shows "remote: none, one disk only" instead of unpushed
  commits.
- Key files default to README.md and the roadmap files the scan found;
  `key_files` replaces them. The model holds paths; the renderer reads
  the files.
- The zellij tab is named after the scanned name. Its session is the
  entry's, else the session of the longest root in
  `launch.zellij_sessions` containing the clone, else
  `launch.zellij_session`. A vault adds Open in Obsidian first.
- A branch links to its forge when its upstream's remote URL matches a
  forge presence through the configured hosts.
- Forgejo gives CI target URLs relative to the instance; they are
  resolved against the repository URL.
- `config.ts` drops its Node imports so the renderer can use the config
  lookups. The mock uses `/home/owner` for its paths.
- Both expectation kinds open with "You said I should have ...": one
  template per cause. The phrasebook's red example said "I'd get"; its
  distinctive closer "That was {span} ago." is kept.
- Electron's userData defaults to `~/.config/perch`, the config file's
  home, and would litter it with browser state. The app will set
  userData to `~/.local/share/perch`, leaving `~/.config/perch` to the
  stowed config.toml alone. Wired in the app phase.
- The theme is one stylesheet, `packages/ui/src/theme.css`: Tailwind v4
  `@theme static` tokens replacing Tailwind's default palette, values
  from `design/perch.html` (its lifted muted and faint inks). shadcn's
  semantic tokens map onto the ink palette and its dark variants always
  apply: perch has one theme.
- Fonts are the board's, Bricolage Grotesque and Figtree, bundled from
  fontsource; the desktop's content security policy blocks Google
  Fonts. Geist is dropped.
- shadcn primitives move to `packages/ui/src/primitives` with
  `components.json`. The desktop drops its `@/` alias, so a stray `@/`
  import in ui fails the desktop typecheck instead of resolving into the
  desktop.
- Bird size: base scale 0.9 for the least important tier rising to 1.8
  for the most, linear in rank; 0.78 on the fence. Plumpness multiplies
  by up to 1.65 at the view model's cap of 50, the board's factor.
- Sleeping birds are still as well as closed-eyed, per the bird
  language; the board kept them bobbing. Fence birds bob like content
  birds whatever their health: they do not wear their mood.
- Detail times read as the speech's durations measured to a `now` the
  caller passes ("30 hours ago"), replacing the board's day counts, so
  components hold no clock.
- Behaviour leaves components through required callbacks (`onLaunch`,
  `onFullStory`). The key-file paper keeps its open tab as its own
  state. The bubble's tail is placed by side and the inset of its tip.
- Pull request lines, sources not read and the detail heading joined
  the ui components: the view model carries them and the detail page
  needs them.
- The design site routes every page through `/$slug` from one registry,
  serves on port 5174, and its paper page renders this repository's
  README, spec and roadmap as the mock Perch bird's key files. Its smoke
  test renders the index and every page.
- The aviary lays itself out from its measured size in the board's
  proportions: the scene keeps the window's aspect between 600 and 3000
  units tall, the top wire sits at a quarter of the height or lower to
  leave a bubble room, the fence 150px from the bottom, and the wires and
  their rows share the space between, a step apart at most.
- A crowded wire splits by capacity, not by name as on the board: a row
  holds as many birds as fit 300 units apart between the margins, six,
  and each further six takes another row. Birds are dealt over the rows
  in turn, so every row's leftmost needs attention first; each further
  row sits 150 units right.
- A large change is a change of arrangement: who sits on which wire or
  on the fence. The flock flies in again; a bird that only moves along
  its wire glides there. The glide also runs as the window resizes.
- Scene-wide source errors and warnings had no place on the board. They
  sit top left in the sky, each failing source with how long since it
  was last read and its error; the camera's header adds a count beside
  the scan time, with the details in its tooltip.
- The hover tip's second line is the bird's chips, else its last commit.
  The board's summary needs facts the view model lacks; parked.
- The bubble anchors so its tail tip meets the beak tip and opens away
  from the bird's tail. Without room above it keeps to the top edge, as
  the board did.
- The camera takes where it points as a controlled prop and calls back
  every move, for the desktop's router. The bird last open under each
  tab, and the bird left on the ground while riding home, are its own
  state. A bird the aviary no longer holds shows the aviary without a
  callback.
- Every configured wire has a header tab, and so does the fence; with no
  birds the tab is disabled. The board left such tabs out.
- The flights are computed from the layouts rather than measured from the
  DOM. The aviary keeps the main area's full size beneath the collapsing
  sky, so its layout holds still during the ride.
- `Bird` gains a required `speaking` prop for the beak's wiggle; its name
  brightens on hover and underlines on keyboard focus of the group
  around it.
- `packages/ui/src/test-setup.ts` stubs what jsdom lacks: ResizeObserver,
  matchMedia, and element.animate as an animation that never finishes.
  The design site's tests load it too.
- The detail page goes to one column below 1040px of its own width, a
  container query (the board's 1100px viewport query less its padding),
  so it behaves the same embedded in a design page as in the app.
- The Spec pages excerpt declarations from the repository's files through
  `?raw` imports, cut by name; a renamed declaration throws and fails the
  route test. The gather's rounds are parsed from `gatherRounds` in
  gather.ts, which imports Node and cannot be imported by the site.
- `speechSubjectFor` and `compareOnWire` are exported from viewmodel.ts:
  the phrasebook runs `speak()` over the subjects of the mock's items,
  and the scene pages order their hand-built wires as the model does.
  A situation the mock lacks is the nearest mock bird's subject with one
  fact changed, and the page names the change.
- The Uptime Kuma source runs on every gather; nothing in config turns it
  off. The view model leaves the server off the scene, so nothing it
  reads is shown.
- Server monitoring is enabled by the presence of `[server]` in config;
  without it the kuma collector does not run and there is no server item.
- The design site's night toggle is the Night option of the sky switcher
  on the aviary and camera pages, beside Follow the clock.
