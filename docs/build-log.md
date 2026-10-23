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
- The app phase. `src/scan.ts` in core composes gather and aggregate with
  every directory and the config path as parameters; the CLI passes the
  repository's `.scan/`, the app `~/.local/share/perch/scan/`. `loadConfig`
  takes the user config path rather than deriving it from home.
- The snapshot is written to a `.part` file and renamed into place. A
  snapshot that does not parse reads as none: it is a cache and the
  first-seen record, and losing it only restarts the expectation clocks.
- userData is set before the single-instance lock, which lives in it. The
  scan's files sit in its `scan/` folder, apart from Chromium's state.
- The AppImage ships `config.example.toml` among its resources; the dev
  build reads the repository's.
- The main process derives the aviary, so the renderer receives view model
  types only. The state it pushes is the aviary (null before any
  snapshot), whether a scan runs, and problems outside any one source: an
  unreadable config, a failed scan, a failed launch. The renderer puts the
  problems ahead of the scan's warnings in the sky's notices.
- The scan timer counts from the end of the last scan and reads the
  interval afresh each time. A request during a scan joins it rather than
  queueing another. A focus scans only once a minute has passed since the
  last scan finished, so moving between windows does not rescan each time.
  Without any config the next attempt is a minute away. The config is read
  again before every scan.
- Launch commands are argument lists in `[launch.commands]`, run without a
  shell: `zellij` and `terminal` together give the zellij tab, then
  `vscode`, `folder` and `obsidian`. A placeholder a command cannot fill is
  a config error. The vault's name is URI-encoded for `{vault}`. Keys are
  the action kinds, so the verb "Open in VS Code" stays true to its key.
- The zellij tab reads running sessions from `zellij list-sessions
  --no-formatting`, a line holding "EXITED" not counting; a failed listing
  counts as none running. Programs start detached in their own process
  group with no stdio, from the home directory.
- The renderer sends the launch action itself: the bubble's callback
  carries no bird. The main process runs it only when a bird in the
  current aviary offers the same action, field for field.
- Links with a target open through `setWindowOpenHandler`, and every
  navigation is refused, web pages opening in the browser. Relative links
  on the key-file paper go nowhere, as the roadmap's item says.
- The camera is the root route and stays mounted; `/` and `/bird/$` (a
  splat, since ids hold slashes) only say where it points. The clock is
  read every minute.
- Key files are read once the state is known, keyed by bird and scan time,
  so a scan reads them again; while a read runs the same bird keeps its
  sheets.
- The camera header's scan line reads "{phase}, scanned {time}, {age}" and
  is a button that scans now, the rescan until the tray exists. While a
  scan runs it waits, and "scanning" sits before it, pulsing gently.
- Main-process tests run in node and renderer tests in jsdom, as two
  vitest projects in the desktop package.
- A full scan of this machine took 6.5 seconds cold and about 4 seconds
  warm, all seven sources ok. The interval defaults stay open.
- The tray phase. The app icon is the board's content bird on a wire on
  the ink ground, drawn from `bird.tsx`'s geometry with the theme's
  colours written out. The tray has its own silhouette: body, head, tail
  and beak in ink with the green breast, no legs, eye or wire, which
  smear at 22px. `@resvg/resvg-js` renders the PNGs, which are committed;
  a test reads each one's size.
- The window and tray icons ship among the AppImage's resources and are
  found where the dev build finds them, in `apps/desktop/resources/`.
- Activating the tray icon, a left click on Plasma, toggles the window.
  The menu is Show, Rescan and Quit, Quit set apart by a separator.
  Rescan does not show the window.
- In front means shown, not minimised and focused. A toggle on a window
  shown but behind others brings it forward rather than hiding it.
- A second launch's arguments are read from the `second-instance` event's
  command line as exact flags anywhere in it, so the executable and
  Chromium's switches are ignored. `--toggle` wins over `--show`;
  `--scan` combines with either. A second launch with only `--hidden` or
  `--scan` leaves the window alone, so an autostart beside a running
  perch does not show it.
- Two desktop entries: `perch.desktop` for the launcher runs `perch`,
  `perch-autostart.desktop` runs `perch --hidden`. Both name the icon
  `perch`, linked into the hicolor theme by hand as the README says.
  Nothing is installed outside the repository.
- The AppImage is 121 MB. Its runtime hung in the build shell, even for
  `--appimage-version`, so the hand-over was checked on
  `dist/linux-unpacked/perch` under a scratch HOME: second launches with
  `--toggle`, `--toggle` and `--scan` each quit with exit 0 in about 0.2
  seconds, the first kept running, and `--scan` wrote a new snapshot.
  Whether the window took focus was not checked; see the roadmap.

## 23 October 2026

- `writeConfig` lives in `src/config-write.ts`, beside the parser and
  free of Node imports like it. Item entries and zellij session roots
  are written sorted by key; every list keeps its order. In an item
  entry, unset fields and an empty `expect` are left out; an empty
  `key_files` or `roadmaps` is written, since it differs from none.
- Item entry lookups take the resolved entry, not an item id:
  `resolveEntry` in `src/config.ts` is the only code that reads
  `config.items` by key. When several keys name one project, the key
  naming the earliest of the id and the project's references applies,
  ties broken by key.
- The view model resolves each bird's entry from the snapshot item's own
  presence references rather than a key stored on the item, so a config
  change applies to a cached snapshot without a rescan.
- The roadmap reader moved to a third gather round. It needs each
  clone's entry for configured roadmap paths, and resolving that through
  the same join as aggregation needs the forge enrichers' files.
- The no-config state is a `noConfig` flag on the pushed state, set when
  the latest read found no file. A config file removed while the app
  runs drops the config held, so the window returns to the welcome
  screen. A file that exists but has never parsed is not the no-config
  state: it keeps the one-minute retry.
- The welcome screen's "Check again" reuses the rescan call: without
  config, a rescan reads the path again and scans only if the file is
  there. A focus without config always rechecks, ignoring the focus gap.
- The starter write opens the file with the exclusive flag, so the
  refusal and the write are one step. A refusal stays among the problems
  until the next attempt or the next scan; the main process requests a
  scan after every attempt, which rechecks first.
- The example config no longer has a `[launch.zellij_sessions]` table;
  the launch section's comment names it with a sample entry instead.
- Adopting and editing birds in the UI: the entry form model lives in
  `packages/core/src/entry-form.ts`, beside the parser and free of Node
  imports. Its `EntryValues` and `EntryOptions` are the small types the
  ui forms take and the IPC carries, rather than a copy of each in
  `packages/ui`; the renderer never receives a `Config`.
- The IPC adds three calls: `entryForm(birdId)` reads the entry and the
  form's choices, `saveEntry(birdId, values)` adopts or edits, and
  `removeEntry(birdId)` unadopts. Adopting is a save with only the wire
  and name set, written under the item id.
- Unadopting removes every key naming the bird, so a second, conflicting
  key cannot keep it on a wire.
- Choosing the default wire or the default tier in a form stores null,
  so the entry holds only what differs. An empty name keeps the scanned
  name. Key files and roadmaps keep three states: null for the defaults,
  an empty list for none, or the paths, each once.
- The config write follows a symlink to the file it names and renames a
  `.part` sibling over it, keeping its mode, so a stowed config stays a
  symlink into the dotfiles. The edited config is parsed back before
  anything is written, so an edit that would not read back (amber after
  red, say) writes nothing and becomes a problem in the state.
- After a write the main process rereads the config and publishes before
  it scans, so the bird moves to its wire at once. The app state now asks
  for scans itself through a `requestScan` dependency; the starter config
  write uses it too, in place of the IPC handler doing it.
- The renderer reads the open bird's entry form again after every scan,
  as soon as the bird's wire or name changes, and once a save or removal
  settles. The detail page shows its entry verb only while the form
  agrees with the bird: Adopt needs no entry, Edit entry needs one.
- Unadopt asks for a second press, Return to the fence, before it writes.
- `writeConfig` takes the home directory and writes paths under it with
  `~`, so a saved config keeps the starter's `~/dev`. It leaves out the
  optional tables when they are empty (`items`, `launch.zellij_sessions`,
  `launch.commands`), so the starter saved unchanged reads as the same
  TOML document, only its comments and layout gone.
- The settings form model lives in `packages/core/src/settings-form.ts`
  beside the entry form's: `settingsFormFor(config, home)`,
  `withSettings(config, values, home)`, `settingsProblems(values)` and
  `settingsWarnings(named, values)`. Both functions take the home
  directory because the form shows paths with `~`. `SettingsValues` covers
  all of `Config` but the item entries; the renderer never receives a
  `Config`.
- A launch command, and each join, is one line in the config file's own
  list form, `["code", "{path}"]`, read with `JSON.parse`. Splitting on
  spaces would break arguments that hold spaces, and shell words would
  need a hand-rolled parser. An emptied command removes its action; `[]`
  is a problem, since it names no program.
- Removing a wire or a tier that item entries name moves those entries
  to the default: the save sets their `wire` or `importance` to null,
  since the parser refuses an entry naming a wire or tier config lacks.
  The form names the entries before it is saved.
- The global thresholds use the entry forms' rule: `thresholdProblems`
  in `entry-form.ts` serves both. Include and ignore paths and zellij
  session roots must start with `/` or `~`.
- The IPC adds `settingsForm()` and `saveSettings(values)`. The main
  process checks the values with `settingsProblems` before it writes, and
  a refusal is the same problem in the state as a refused entry write.
  The app state's two write errors became one: the latest config write's.
- The main process watches the config file (`config-watch.ts`): the
  directory of `~/.config/perch/config.toml` and, when it is a stow
  symlink, the directory of the file it names, since an editor or the
  app's own write renames a file there and the link never changes. Once
  the file has been quiet for 300 ms the app rereads the config and
  publishes, without a scan. A directory that cannot be watched is a
  console warning; the starter write starts the watch again, since its
  directory may not have existed at launch.
