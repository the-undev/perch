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
- The config forms share `packages/ui/src/form-parts.tsx`: the ruled
  row, the pill choice, the list editor and the threshold field. A list
  entry is now a text field edited in place, on the entry editor's key
  files and roadmaps too; ordered lists (wires, tiers) move entries up
  and down. An emptied number field reads as NaN, which every rule
  refuses, rather than as 0.
- The settings editor holds a draft. While untouched it follows the
  file; once edited, a change to the file is noted, and saving writes
  the form over it (last write wins) or Discard takes the file's values.
  Save waits until something changed, so opening the page and saving
  never rewrites a commented starter for nothing. Renaming the default
  wire or tier in place keeps it the default.
- The settings groups flow into CSS columns 36rem wide: two on a small
  monitor, five or so on the ultrawide, each group whole.
- The settings page is the `/settings` route, reached from "settings",
  the camera header's last word in the scan line's voice. It takes the
  camera's place rather than riding inside it: the camera's tabs and
  strip have nothing to show there. The brand, "back to the aviary" and
  Escape go home, Escape even from inside a field, as on a bird's page.
  The page lists the main process's problems above the form, so a
  refused save is seen where it was made.
- Every pushed state reads the open entry form and the settings form
  again, since the config may have changed on disk. The query cache keeps
  an equal answer as the same object, so an untouched form keeps its
  draft.
- The design site shows the settings on two pages: "Settings groups"
  renders each group in its states, editable, with the problems the
  editor would list beneath each, and "The settings page" scene renders
  the whole page with a control that changes the file on disk.
- An empty wire's header tab is a quiet label, its name and "empty",
  rather than a disabled button: there is nothing to press, so it is
  not a control.
- The open key-file sheet is capped at the window's height less 18rem,
  at least 20rem, and scrolls inside itself. 18rem is about the header,
  the strip and the folder tabs, so a capped sheet fits the ground
  beneath them. The sheet takes keyboard focus so the keys scroll it.
- A crowded perch's names: neighbours under 150 units apart alternate
  between a near baseline and one 22 units lower; under 100 apart every
  name also steps down a size (12.5 to 11 on the fence, 13.5 to 12 on a
  wire, 13 to 11.5 in the strip). 150 is about the widest name the live
  machine has (15 characters) at full size with room either side; 100
  keeps neighbours on different baselines from overlapping much. The live
  fence of 21 birds sits 88 apart, so it takes both. Below the limits a
  fence keeps one baseline.
- `namePlace(index, spacing, nearDrop)` decides it for the aviary's
  wires and fence, the `Wire` and `Fence` components and the camera's
  strip. Aviary wire rows never come under the limits (a row holds six
  birds at most, 340 apart), so only the strip's crowded wires change.
  The strip's near baseline sits 22 below the perch so its lower one
  clears the strip's foot.
- The sources design round (mockups/sources.html) is approved: perch
  starts from nothing and every data source is added, never assumed.
  Each connection is its own card carrying its own last-scan sentence,
  and the picker is a registry, so a new source kind is one row.
- Config moves to repeatable source tables: `[[sources.local]]`,
  `[[sources.github]]`, `[[sources.forgejo]]`, `[[sources.kuma]]`. The
  `[local]`, `[forges]` and `[server]` tables go, with no migration:
  the only config this breaks is on this machine. `finalised_commits`
  moves to `[scan]`. A local source holds `include` and `exclude`
  (renamed from `ignore`); a github source holds `account`, `key`,
  `hosts` and `tracked_forks`; a forgejo source adds `base_url`; a
  kuma source holds `name`, `base_url` and `status_page`. A config
  with no sources is valid and scans to an empty snapshot.
- The starter config is generated from a default `Config` through
  `writeConfig`, not copied from the example: one wire, the standard
  thresholds and tiers, no sources. `config.example.toml` becomes a
  commented reference with placeholder values only, and the CLI
  without a config runs the defaults instead of the example, so the
  AppImage stops shipping it.
- Perch may write a pasted token into the keyring (Secret Service,
  the same `secret-tool` entries as before). It never reads one back
  for display: the field is write-only and the manual `secret-tool
  store` command stays printed beside it.
- Claude Code sessions stay an automatic source, not a card.
- A card's identity for its scan record: a github card is its
  account, a forgejo card its account at its base URL, a kuma card
  its name, a local card its include paths.
- Built in four phases: the config schema end to end, the per-card
  scan record in the snapshot, the settings rebuild (a left rail of
  pages beside one reading-width column), and the keyring write with
  the token test.
- The config schema phase. A config key outside the model is refused by
  name (`config: local is not a config key`), at the top level, in
  `[sources]` and in each source table, so the old `[local]`, `[forges]`
  and `[server]` tables fail loudly. `exclude` and `tracked_forks` may be
  left out and read as empty; every other source key is required.
- A forge source's tracked forks are the union across that kind's
  tables, as one forge's list was before. A remote is looked up through
  the table whose account owns it and whose hosts name its host.
- Each kuma table makes a server item with id `server:<name>`, so two
  tables make two items; the old single item's id was `server`.
  `RawData.kuma` is keyed by the table's name, an unreadable page that
  name's error instead of the source's.
- The raw account listings stay keyed by account, so two Forgejo tables
  for one account name at two instances share one listing entry. The
  per-table scan record phase gives each table its own.
- `defaultConfig()` lives in `src/config-default.ts`: wire `projects`,
  zellij session `main`, no launch commands, the example's windows,
  tiers and scan values. Finalised commits moves into the settings
  page's scan group with the key.
- The per-card scan record phase. `Snapshot.sourceCards` is derived in
  `src/derivations.ts`: a forgejo card's heading and identity use the
  base URL's host with its port, so `finch@forge.example.lan:3000`.
  Paths in local identities and headings are written with `~`, so
  aggregation takes the home directory as an input.
- An ok card's time is its raw file's gatheredAt. A failed card's last
  read is carried from its record in the previous snapshot, since the
  raw files keep no per-account success time; without one it is null.
- The source's status is checked before the card's grain: a source that
  failed as a whole fails every card it holds, even one added since. A
  local card counts as scanned only once every one of its include paths
  has an outcome in the raw file.
- The account listings stay keyed by account name, not by table, and
  each forge card reads its account's entry. Giving each Forgejo table
  its own entry is in the roadmap.
- The desktop app pushes the cards in its state as `sourceCards`, null
  until a snapshot holding them exists and without config, as the
  aviary is. The renderer takes the type from the view model, which
  re-exports it as it does `HealthLevel`.
- The settings rebuild phase. The open page is the settings view's own
  state, Sources each time the page opens; the router keeps only
  `/settings`. Each former group is one page headed by its rail word,
  its note become the page's lead.
- The sources form holds config's own source tables with local paths
  written with `~`. A card added from the picker goes after its kind's
  last, so the draft's order is the order saved. A card's scan record
  is matched by the id its draft values make, through the per-kind id
  functions `configuredCards` uses, so a card whose account or name is
  edited reads as never scanned until it is saved and scanned.
- The form refuses more than the parser on two points: a local source
  names at least one folder, every folder starting with `/` or `~`, and
  a base URL starts with `http://` or `https://`. The repeat rules are
  the parser's own. Each problem is shown beside its field and listed
  beside Save as "GitHub source 2, account: ...".
- A card that cannot be written when it appears, a new one among them,
  starts open; the rest start closed. The keyring key follows the
  account as `<kind>-<account>` while it is empty or still that
  suggestion.
- Card times are by the minute within the hour ("4 min ago"), then the
  speech's hour words. The picker's closing line is the board's second
  form on every page, and the page lead drops the board's "simply".
- Creating the config resolves whether it wrote before its scan
  settles, and the window then goes to `/settings`; a refusal reads "The
  config file was not created: ..." and the welcome stays.
- The keyring write phase. `storeToken` and `testSource` live in
  `apps/desktop/src/main/keyring.ts`, beside app-state rather than in
  it, since neither reads config or the pushed state. Their answers
  show on the card only, never among the state's problems.
- The pasted token is trimmed before it is stored; the key is used as
  the card holds it, as the lookup uses it. The entry's label is
  `perch`.
- The fetch errors are typed (`NoAnswerError`, `HttpStatusError`, same
  messages as before) so a test can say "no answer from <host>" or
  "<host> answered HTTP <status>" without parsing a message. GitHub's
  host in those sentences is `api.github.com`; Forgejo's is the base
  URL's host and port.
- Test counts the repositories the account owns among the token's full
  listing, the owner match the gather uses, forks included. Any failure
  sentence has the token replaced by `[token]` in case a message ever
  carried it.
- Once stored, the token field empties rather than showing dots as the
  board drew it, so the renderer holds no copy. Store is also held
  while the field is empty, and Test while the card has no account or,
  for Forgejo, no address.

## 25 October 2026

- The adoption round (`mockups/adoption.html`), all five verdicts
  approved as recommended: adoption is a sheet of papers unfolding in
  the ground area of the bird's page, not a modal; the wire picker is
  drawn as wires with the bird sitting on the chosen one; wire, name,
  tier and expectations sit above a named fold holding the overrides
  (thresholds, key files, roadmaps, session); "the papers" replaces
  "edit the entry" everywhere; the fence bubble offers adopt as its one
  key, and bubble and page lead to the same sheet.
- For the implementation: the tier row must say what a tier does, that
  it sets the bird's size, first tier largest. Asked at review; the
  mockup's "How much it matters" with the starter names read as
  categories, not sizes.
- The thresholds rows and the override fields (key files, roadmaps,
  zellij session, launch integrations) stay as the current form parts
  in this round; their redesign is parked on the roadmap.
- Building the papers: what perch has seen is the clone's path with
  home as `~` (so the entry form takes the home directory), each forge
  presence's address without its scheme, and the last commit. The last
  commit is git's checked-out one with its branch's subject, else the
  newest a forge finalised, so a forge-only bird still has one. A fact
  the scan lacks leaves its line out; with no clone the forge lines read
  "lives at" rather than "also lives at".
- The entry form also names the session the launch rules give the
  clone, as the zellij field's placeholder. The papers now write the
  session they hold instead of keeping the old one.
- The amend signature line reads "Signed, the owner" without the
  mockup's "first adopted" date: config holds no adoption date and the
  scan cannot derive one.
- The fold's form parts stay the dark settings parts, drawn in the
  paper's ink by a `data-material="paper"` block in `theme.css` that
  maps the ground and ink tokens onto the paper tokens. No new colours.
  The unchosen wire strokes are paper-quiet at half strength, close to
  the mockup's untokened grey.
- The fold is a button with `aria-expanded` rather than `<details>`, and
  starts closed when amending too: its label names what it holds.
- Signed papers stay open until the entry read back matches what was
  signed, compared by `sameEntryValues`; a refused write leaves them
  open with the main process's problems in paper-red. Every problem the
  main process holds shows there while the papers are open.
- Escape folds the papers only when pressed inside them, before the
  camera hears it; anywhere else on the page it still rides home.
- The bubble's Adopt key sits after the launch keys and before "Tell me
  the full story", a dark key with the adopt icon and its word.
- The camera place carries `papers`, kept in the URL as
  `?papers=true` on the bird route. The papers unfold whenever it turns
  true; Not now leaves the URL as it is.
- On the page the papers sit beneath the action row, left-aligned with
  it, at the mockup's 620px; the mockup centres them on a stage. Amend
  mode keeps Not now beside "Amend the papers", with "Return to the
  fence" first on the signature line.

## 26 October 2026

- Importance removed whole, with the archived scan interval, the
  `tickets` expectation and Uptime Kuma in the sources picker. No
  migration: a config holding a removed key is refused by name and is
  edited by hand.
- Item entries and `[scan]` now refuse a key outside the model by name,
  as the top level and the source tables already did, so
  `items."<key>".importance` and `scan.archived_interval_hours` fail
  loudly. `[wires]`, `[thresholds]` and `[launch]` still ignore an
  unknown key.
- A `tickets` expectation is refused by the existing check on
  `expect`, whose message names the key and the allowed names, not the
  value.
- Every bird on a wire starts from one scale, 0.9, the old default
  tier's, so a bird that took the default draws as before. The fence
  keeps 0.78 and plumpness still multiplies both.
- Along a wire, birds order by the worst mood, then by name.
- The snapshot item's `importance` field goes too: the aggregate wrote
  it and only tests read it.
- `settingsWarnings` goes with the tier warnings: it only wrapped the
  wire warnings, which the Wires page calls directly.
- `expectationMet` keeps its name parameter, checking through a record
  of one check per expectation name, so a returning `tickets` is one
  entry.
- The mock's red expectation moves to Oxbow's CI, expected for a
  month: its forges lose their CI runs and its branch its CI-fix
  subject.
- The picker's kinds are `pickerKinds`; `sourceKinds` adds Uptime Kuma
  after them, so a kuma card keeps its heading. `withSourceAdded` still
  makes a kuma card, and the design site's empty kuma card specimen
  stays, the state a hand-written table can reach.
- The design site's bird page loses its size section, and its
  plumpness rule no longer names tickets, which plumpness never read.
- `scripts/mockup-data.mjs` keeps its tiers: it feeds the retired
  mockups only.


## 26 October 2026 (bird motion states)

- A perched bird does one thing at a time: arriving, or idle. `PerchedBird`
  starts arriving and flips to idle on `animationend` of the `arrive`
  animation; the `beak-wiggle` ending inside the figure bubbles up and is
  ignored by name. This is the attempted fix for the figure painting twice
  during the arrival, which is suspected to be a finite parent transform
  animation running over infinite child ones in one SVG.
- `Bird` and `BirdFigure` take a required `idle` flag. Birds drawn at rest
  (wire, fence, portrait, detail and adoption figures) pass `idle`. Hover
  lift, beak wiggle and focus work in both states.
- Reduced motion needs no handling: every animation involved is
  `motion-safe:`, so nothing waits on an event that never fires, and the
  state is invisible.
- The roadmap entry stays until the owner confirms the doubling is gone.

## 26 October 2026 (birds painting twice)

- Cause of the doubling: the camera's flyers and the destination layer's
  fade-in overlapped. The aviary layer fades in at 500ms and the strip
  layer at 620ms, both before the 850ms flights land, so for the overlap
  each tab bird showed twice: the flyer just short of its perch and the
  real bird fading in at it. Names never doubled because a flyer draws
  only the figure.
- The arrival animation and the arriving and idle motion states are
  exonerated; they stay as built.
- Fix: a bird whose flyer is in the air is not drawn at either end
  (`visibility: hidden`, layout kept) until its own flyer lands.
  `CameraView` derives the flying ids from its flights and passes them
  to `AviaryScene` (a required `flyingIds`) and to the strip. The fade
  timings are unchanged. A scene bird unhiding keeps its idle state, so
  the arrival does not replay.
- The roadmap entry "Birds paint twice during the arrival" is removed.

## 26 October 2026 (renaming a wire)

- A settings wire row is `{from, name}`: `from` is the config wire the
  row started as, null for one added. Only `from` carries entries, so an
  added row named as a removed wire is still an add and the removed
  wire's entries move to the default. A row whose `from` the config no
  longer holds is an add by the same rule, since no entry names it.
- The default is held as its row's place, `defaultRow`, not a name.
  Swapping two names passes through two rows sharing one, and a name
  cannot say which of them is the default. Moves and removals keep it on
  its row; `withSettings` writes that row's name, so the rename reaches
  the default without a step of its own.
- A repeated name is refused per name, "Wires: two wires are named X;
  each name may appear once", in place of "each wire once". Two rows
  starting as one wire are refused too, "Wires: two wires both start as
  X": the editor cannot make them, but the main process may be sent them.
- The default wire's remove is held until another wire is the default,
  so the removal line always names a wire the birds move to.
- Remove arms on the first press: it turns red and reads "remove for
  good", and a line beneath counts the entries naming the row's `from`.
  The second press removes; "keep" disarms. The question is held by the
  row object, so it follows its row on a move and drops on an edit to
  it. The note beneath the page naming a removed wire's entries stays.
- `StringList` lost its ordered mode: the wires were its one ordered
  list, and they now have rows of their own.
- The design site's Wires section gains a renamed specimen, and its
  invalid specimen shows a repeated name in place of a default outside
  the wires, which the editor can no longer reach.

## 26 October 2026 (a config write during a scan)

- A request that arrives while a scan runs queues one follow-on scan in
  the scheduler, started when the running one finishes, so its gather reads
  the config as written. Any number of requests during one scan share that
  one follow-on, and a request while idle scans at once as before.
- Such a request settles when the follow-on finishes, not the running scan,
  so a save's `await` ends after a scan that read its config. A focus during
  a scan still joins it: a focus carries no config change. `stop` cancels a
  queued follow-on.

## 26 October 2026 (problems on the detail page)

- The detail page shows the main process's problems as a strip under the
  intro, in the amber of the sky's notices. A launch that fails from the
  page now says so.
- While the adoption papers are open the strip stands down. The papers
  already print the same lines in red beside the signature, where a refused
  write is read, and two copies at equal weight would shout. Closing the
  papers brings the strip back. The open state moved from the papers' verb
  to `DetailView` so the strip can see it.

## 26 October 2026 (removing expectations)

- The expectation mark round (`mockups/expectation-toggle.html`) is
  retired. Of its three marks, C, delete as applicable, was preferred as
  the control. The round ended by removing the control: the goal it
  asserted, that a project should have CI, belongs on the project's
  roadmap, so the row went with the expectation behind it.
- Expectations removed whole: an entry's `expect`, the snapshot item's
  `expectations`, the unmet expectation health cause, the "ci not set
  up" chip and ledger row, the two speech lines and the papers' "What it
  should have" row. CI as a fact is the forge's chip; CI as a goal goes
  on the project's roadmap. The replacement, critical roadmap items
  driving health, is parked on the roadmap.
- The Unmet expectation window goes with it: `expectation_amber_days`
  and `expectation_red_days` leave the threshold keys, the defaults and
  the writer, so the Judgement page and the papers' fold hold two
  windows.
- No migration: an entry's `expect` and the expectation keys, globally
  or on an entry, are refused by name. `[thresholds]` now refuses any
  key outside the model by name, as item entries and `[scan]` do.
  `[wires]` and `[launch]` still ignore an unknown key.
- Aggregation still reads the previous snapshot, now only for a failing
  source card's last read. A snapshot cached before the removal still
  loads; its items' `expectations` field is never read.
- The mock's Harbour and Oxbow lose their expectations and are
  content and settled, so the Projects wire's tally reads 3 attention
  and 1 drifting. The mock still covers every mood, cause and chip kind
  that remains.
- The design site's phrasebook page drops the one exception to no
  suggestions, a bird echoing the owner's expectations back.
  `design/phrasebook.html` and the decision docs keep their expectation
  passages as the record of what was approved then.

## 26 October 2026 (the bird's page round)

- The bird's page round (`mockups/bird-page.html`), five verdicts
  approved: the bird leaves the wire for a perch, a T-stand at the
  page's top right, full size, idle, always facing left toward its own
  record, its bubble attached without the name-and-state header the
  page's heading already carries; a bubble chip is a handle that lands
  on the ledger row holding its working, each conclusion spelled out
  per source, chosen over tooltips; commits are told once in a river
  with a reach mark per remote, hollow where a remote lacks one, and
  one amber sentence on divergence; the papers rise as a sheet over
  the dimmed record, the bird staying through the signing; and the
  camera pans the ground between birds under a still strip, replacing
  the swap flash.
- The round resolves five roadmap entries when implemented: the papers
  as a view of their own, the bird on its own page, every chip spelled
  out, commits once with remotes beside them, the empty top right, and
  the camera's move between birds.
- Every implementation phase keeps the design site current: moved or
  new pieces get their page or specimen in the same phase.

## 26 October 2026 (the perch)

- The round's first phase: the roost and the page's new shape. Chips as
  handles, the commit river, the papers rising and the camera's pan are
  the later phases.
- `Detail` gains `clonePath`, the clone's path with home as `~`, and
  `forges`, each forge that holds the bird once in the order its
  presences were found. The wire stays on `Bird` and is not copied.
  `deriveBird` had only the item, the config and the scan time, so
  `deriveAviary` takes the home directory as a required third
  parameter; the app passes its own, the mock exports `mockHome`.
- The meta line names forges by their lower-case names in mono, as the
  round's page does: "~/dev/perch · github, forgejo · on Projects".
- The roost draws the bird at 1.3 times its plumpness scale, which puts
  the mock's Perch near the round's 1.55. Wire and fence birds share
  the one scale; the fence's dimness tells them apart. The stand is a
  100 by 7 crossbar on an 8 by 42 pole with a shadow in the shade token,
  and its drawing grows with the bird so a bird at the cap still fits.
- The roost's bubble shares the aviary bubble's paper and chips, without
  the pop: the page's own arrival already moves. At night it speaks
  woken and a sleeping bird sleeps on its perch, as in the aviary.
- `DetailIntro` became `DetailHeading`. The speech left it for the
  roost. The name drops from 42px to the round's 30px. The state word
  takes the bubble header's capitals and tracking, since the heading now
  says what that header said. The activity words stay: nothing else on
  the page says them.
- The roost comes first in the document and the grid moves it to the
  second column from 860px, so the narrow order is the reading order.
  The page's cap grows from 1560px to 1920px, so the record beside the
  roost keeps the width the ledger and paper had. The ledger and paper
  split now reads the record's width, at 960px rather than the page's
  1040px: in a 1400px window the record is about 974px, and the paper
  stays beside the ledger.
- The design site gains a Roost page. The Detail heading page moves to
  the `detail-heading` slug with the meta line in every specimen, and
  the Bubble page points to the roost's bubble.
- The roadmap's "Every chip spelled out" entry loses its sentences on
  the bubble's content not carrying on: the roost carries it.

## 26 October 2026 (chips as handles)

- The round's second phase. One CI row and one open pull requests row
  replace the per-forge rows. The CI row says the worst state as the
  chip does and carries no link; each forge's run, with its link, moved
  into the row's workings.
- A ledger row's `chip` names the bubble chip whose number it carries,
  set only while the bubble carries that chip, so a fence bird's rows
  name none. `workings` lists one line per source: a source, its words,
  a tone, a link and a time, each nullable but the first two.
- A source read with nothing to say is silent: a forge with no CI run, a
  forge or roadmap file with none open. The round's "no pipeline" line
  is not drawn, as a source that does not exist shows nothing. A forge
  that was not read says "not read" in amber on the CI and pull request
  rows, since their count covers only what was read.
- A forge's pull requests link to `<repository>/pulls`, the same path on
  GitHub and Forgejo. Per-file counts come from `countOpenItems` on the
  one file. Unpushed commits name only the oldest: the snapshot holds no
  per-branch count.
- The detail view finds the row by `data-chip` inside the record and
  scrolls it to the middle with `scrollIntoView`. The ground scrolls
  smoothly under `motion-safe:scroll-smooth`, so reduced motion jumps.
  The mark is a 1.6s opacity fade with a ring, run with reduced motion
  too; a press counter keys it, so a second press marks the row again.
- The mock held no two forges disagreeing on CI, so Perch's Forgejo
  gains a run pending with no runner and Perch's chip reads "ci
  pending". The design site's hand-built pending chip and ledger row go.
- The mock's roadmap files carry numbered placeholder items matching
  their counts, and the mock test checks the counts against
  `countOpenItems`. Hothouse's open items split over its two files;
  Pocket's second file holds none.
- The aviary bubble's chips became handles too, after the round's
  verdict named only the bird's page. A press closes the bubble and
  rides to `/bird/<id>?chip=<kind>`; `DetailView` takes `arrivalChip`
  and lands on it from one effect, so a new chip on the same page lands
  again. `Chips`, the inert row, went with its last caller.
- The router keeps the raw search beneath the validated one, so a
  validator that drops a key leaves the raw value in place. The bird
  route's validator sets `chip` to undefined for anything but a known
  kind, `chipKinds` exported from the view model for the check.
- An arrival chip lands once the page's own swap has ended, as the mark
  and the smooth scroll during it flickered. The page settles on the
  article's own `swap` animationend, or at mount when the article has no
  running animation (`getAnimations` missing or empty, as under reduced
  motion and jsdom). A roost press lands at once.
- The landing's scroll is instant: `scrollIntoView` is passed
  `behavior: "instant"` and the ground no longer opts into smooth
  scrolling. The mark played on a row still gliding across the screen
  and flickered, so the jump comes first and the mark plays in place.

## 26 October 2026 (the commit river)

- The round's third phase. The scanner held no list for local main, only
  each forge's, so the git collector now reads `git log` on the branch
  `chooseDefaultBranch` picks, capped at `scan.finalised_commits` like
  the forges. When that branch is not a local one the raw value is
  absent, `no-default-branch`, and the snapshot holds null.
- `GitData.defaultBranchCommits` is optional: a snapshot cached before
  the change lacks it, and the river tells here as unknown, "not read
  yet", until the next scan. The cache is read as before; nothing
  migrates it.
- The forges' places follow a fixed order, GitHub then Forgejo, so the
  marks read the same way on every page. Here comes first.
- Unknown has no form in the round's page. It is drawn as the quietest
  mark: a 3px dot in the hollow ring's edge colour, centred where the
  9px mark would sit. A place not read says why in amber beside its
  name in the legend, the ledger's "not read" tone.
- The divergence sentence keeps the round's "behind" for one forge
  lacking, and says "have diverged" with a count each when both lack.
  Here lacking a forge's commit earns no sentence: the ledger's unpushed
  row and the hollow marks carry local work. The counts run over every
  listed commit, so a cap that hides some does not shrink them.
- A commit's subject links to the first forge holding it; the short hash
  is no longer drawn, as the round's page has none. The heading is the
  round's "Where each commit has reached".
- The rows share one grid through subgrid, so the age column fits "3
  weeks ago" and the marks stay aligned.
- The mock's main lists follow each clone's default branch, which its
  test checks. Dotfiles gains two invented unpushed commits on main,
  Harbour's Forgejo misses its last push, and Hothouse's Forgejo holds
  the commit its clone had already pushed.
- The design site's Newest commits page is now the Commit river page,
  slug `river`, with a specimen per state.

## 26 October 2026 (the river's one dot)

- The river's per-place marks and its legend went after review: the
  list answers what is on main and whether it has spread. Each commit
  carries one dot, its tone and its words derived in the view model;
  `RiverPlace` and `PlaceReach` left the model, and `River` gained
  `notes`. The lists, `reachIn` and the window rule stay as the
  machinery, and the divergence sentence is unchanged.
- The dot is judged over forges read only. A commit beyond a forge's
  list counts as held, and so does every commit against an empty list,
  which has no window to judge within: the dot does not cry wolf.
  The divergence sentence still counts only a strict lack against a
  strict hold.
- Two quiet phrases: "no remote read" when the bird's forges all failed,
  "no remote" for a clone with no forge, where the clone's one-disk
  state is already the fence's business. With one forge unread and no
  read forge holding a commit, it reads "on no remote read" rather than
  claiming it was never pushed.
- The dot sits before the subject, as the ledger's handle mark sits
  before its label: 7px in green or amber, the quiet dot a 3px speck in
  the edge colour. Notes for a forge not read, which name only forges,
  sit above the commits in amber with the divergence sentence. The
  clone's own read state is no longer told on the river: it only adds
  commits, so a snapshot cached before the scanner read local main
  shows the forges' commits alone until the next scan.
- The mock's hearth-config has both forges unread, 404s on their pull
  requests, for the no-remote-read dot. Its empty forge lists went with
  them.


## 27 October 2026 (forge reads by part)

- A forge repository's detail is read in three parts, pull requests, CI
  and finalised commits, each its own request and its own observation
  in the raw file. A failed request fails its part; only a missing
  token, before any request, still fails the whole detail. The snapshot
  holds a failed part as an `ItemError` in that field's place. A
  snapshot cached before the change holds every part as read, so it
  needs no optional field.
- The ledger names the part not read, "pull requests not read" or "CI
  not read", on the row it would have spelled out, and "Sources not
  read" lists it as the forge and the part, "GitHub pull requests". The
  river's line stays "github not read" and now means the forge's
  commits.
- The mock's Prism has GitHub's pull requests failed with the 404
  and its CI and commits read. hearth-config keeps both forges unread
  as a whole, now for a missing token, since a 404 on one request no
  longer fails a forge.

## 27 October 2026 (one listing per table)

- The account listings are keyed by the table's keyring key, the one
  field every forge table has that names it alone, and the enricher
  reads each listed repository through that table's client. The config
  parser and the Sources page refuse one keyring key on two tables of
  one kind, since the raw file needs it distinct. A raw file from before
  the change matches no table: its cards read as never scanned until
  the next gather rewrites it.
- Repositories stay keyed by owner/name. Putting the instance in the
  key changes the presence reference config names, so it waits on the
  roadmap.

## 27 October 2026 (bug round polish)

- A hand edit to the config file rereads it and then requests a scan
  through the scheduler, as a save from the settings page does, so a new
  include path shows its birds at once.
- A chip's landing commits its mark with `flushSync` before the row is
  scrolled into view, so the row is never painted unlit. Both callers,
  the press and the arrival effect, run outside render.
- The list editor's remove and Add buttons share one gutter width and
  the add line has no width cap, so the add input ends where the value
  inputs end. The wires list in `settings-forms.tsx` keeps its own add
  line, which the roadmap entry did not name.
- A new GitHub card starts with `github.com` in its hosts. A Forgejo
  card's hosts follow its base URL's hostname (no port, as a parsed
  remote carries none) while they are empty or exactly the previous
  derivation, and an address that does not parse yet gives no host. The
  hosts field's description says what hosts are for.
- The window's `img-src` gains `https:` so a README's badges render. The
  key-file paper shows an image with no scheme as its alt text. The
  roadmap keeps the relative-image read behind a custom protocol.
- The camera header's scan line uses the card times ("just now",
  "4 min ago", then hours), so a scan seconds old no longer reads
  "under an hour ago". The sources page inherits "just now" for its
  floor.

## 27 October 2026 (the unread remote)

- The unread-remote round (`mockups/unread-remote.html`, now retired)
  had four verdicts, all as drawn. A remote perch knows but cannot read
  is never silent, and a failure says "couldn't read", never "not
  read", which implied perch had not got round to it.
- The forge enricher records a remote it could not look up with a
  reason: `no-card` when no card on the remote's host covers the owner,
  `lookup-failed` for anything else. Aggregation keeps either as a
  forge presence carrying the error, joined by its owner/name like any
  other; its full name is the lower-case key and its URL null, since
  the repository was never read. An untracked fork stays dropped. The
  snapshot's forge error carries `cause`, `no-card` or `read-failed`,
  so nothing downstream matches on the message. A raw file or snapshot
  from before the change has no cause and reads as a failed read.
- The config gap distresses, the transient failure does not: a remote
  no card can read is an amber health cause, sorted after CI and
  before bugs. The bird is restless, says "I push to skiff-app/skiff
  on github, but no card of yours can read it.", and carries the amber
  "can't read github" chip first, naming every such forge in one chip.
  A missing token or an HTTP error keeps its "couldn't read" ledger
  rows and problem line only.
- The chip lands on the record's notice under the heading, one amber
  sentence per unreadable remote with Sources linking to the settings
  page through `DetailView`'s `onSettings`. The notice derives from the
  health cause, so it sits on a fence bird's page too, without a chip.
  The landing now searches the whole page, since the notice sits in the
  heading cell.
- Vocabulary: "couldn't read CI" and "couldn't read pull requests" in
  the workings; a CI or pull request row no forge could fill says
  "couldn't read" itself in amber; "What couldn't be read" heads the
  problems, whose value is "couldn't read"; the river's note is
  "couldn't read github", adding "· no card covers skiff-app" for the
  gap; the camera header says "couldn't read 1 source" and the sky
  "Couldn't read Forgejo accounts". The enricher's sentence names the
  card: "no GitHub card is configured for owner skiff-app". The
  spread word for a commit no read forge holds while another couldn't
  be read is "on no remote that could be read".
- Amber dots: when a bird has forge presences and none of their commit
  lists could be read, every commit's dot is amber, "no remote could be
  read". The quiet speck is kept for a bird with no forge, "no remote".
- The branch in the heading: "Where each commit on main has reached",
  the river carrying the clone's default branch, else the first read
  forge's.
- A clone whose only remote is unreadable now counts as joined for
  backup, so its unpushed commits are aged as anyone's are.
- The mock's Skiff mirrors the live case: no GitHub card covers
  skiff-app, Forgejo reads it fine, and it is still stalled, which
  speaks as the secondary. The mock config loses the skiff-app card
  and its source card. hearth-config keeps both forges failed for
  missing tokens, untroubled, and now draws the amber dots.

## 27 October 2026 (the fixed stage)

- The fixed-stage round (`mockups/fixed-stage.html`) had five verdicts.
  The window never scrolls on the bird's page: the strip, the heading
  with its actions and the roost are fixed, and the record pane and the
  paper pane each scroll their own contents with a thin quiet
  scrollbar. A narrow page goes to one pane, the key files at the
  record's end, over the folder-tab alternative. The papers rising over
  the still stage belongs to the sheet rework on its own branch; here
  the inline papers move into the record pane. The aviary and the
  settings page are out of the round.
- The thresholds stay: the band stacks the roost under the heading
  below 860px, and the panes join below 960px, both measured on the
  page. The stacked band stays fixed, so a window both narrow and short
  leaves the panes little height.
- In a narrow page the panes' grid is the one scroller and the panes
  inside it do not scroll, so one tree serves both widths and the key
  files render once.
- Each pane carries 10px of side padding inside a grid pulled out by
  10px, so a landing mark, 10px wider than its row each side, is not
  clipped. The record column becomes 350 to 450px and the gap 20px,
  which keeps the content widths and the 40px between them. Sideways
  overflow is hidden, so a wide row clips rather than raising a
  horizontal scrollbar.
- `pane-scroll` in the theme is the panes' one styling: overscroll
  contained and a thin scrollbar in edge-hi on transparent. It has no
  webkit scrollbar rules: Chromium 121 and later ignore them once
  `scrollbar-color` is set.
- The papers' verb stays in the band's action row and the papers unfold
  at the top of the record pane. A press scrolls them into view, since
  the pane may be scrolled away; papers open on arrival need no scroll.
- The main process's problems move into the band under the action row,
  so a failed launch stays in view whatever the record's scroll.
- The key-file sheet loses its cap of the window's height less 18rem
  and its own scroll. It keeps its focus stop rather than the pane
  taking one: the keys scroll the nearest scrolling ancestor, the paper
  pane when wide and the joined pane when narrow. The folder tabs stick
  to the pane's top on the ground's colour.
- A chip's landing is unchanged: `scrollIntoView` moves the row's pane.
  The camera's ground is overflow hidden and fits its contents, so it
  holds still.
- The design site frames the bird's page in a `Stage` of fixed height
  on the detail scene and adoption papers pages, and the paper page
  shows a long document scrolling its pane.

## 27 October 2026 (the papers rise, on the stage)

- The rising sheet from the papers-rise branch landed on the fixed
  stage, refitted rather than merged. `RisingSheet` keeps its contract:
  inert and hidden while leaving, Escape contained, the background
  press, and focus moved in on the rise and handed back on dismissal,
  both without scrolling. The papers no longer unfold in the record
  pane.
- The papers rise over the whole ground: both panes dim to a quarter
  over 420ms and the panes grid is inert. The problems strip still
  stands down while the sheet is up.
- The dismissal catcher covers the band too, so a press anywhere off
  the papers folds them, modal in feel. A catcher over the panes alone
  left a press on the band doing nothing. The article is a two-row
  grid, band auto and ground `minmax(0,1fr)`, and the sheet's layer
  spans both rows with subgrid rows: its catcher spans both, its
  surface rises in the last. The band stays visible and undimmed, but
  its controls rest under the catcher while the papers are up; pressing
  the verb then folds them through the catcher, which keeps
  `aria-expanded` honest, and the roost's chips rest too.
- Leaving falls faster than rising: 260ms on an accelerating curve,
  `cubic-bezier(0.55, 0, 0.8, 0.4)`, with the unmount at 300ms; the
  rise keeps 420ms on its decelerating curve. The rise's curve run
  backwards crawled its last pixels while the card was already a
  clipped sliver at the stage's foot, then the 450ms unmount snapped it
  away.
- The rise no longer scrolls the layer into view. On the stage nothing
  beneath the sheet scrolls and the cell is always in view, so the call
  and its scroll margin are gone.
- The ground row is fixed, so a sheet taller than the ground cannot
  grow it. The surface stops at the row's foot (`max-h-full`) and
  scrolls its own contents with `pane-scroll`. The article clips
  vertically (`overflow-y-clip`), so the card rises from the ground's
  foot without making anything scrollable, and its rising shadow falls
  on the band above, inside the clip.
- The design site's rising sheet page frames its specimens as a clipped
  two-row grid, a band over a pane, and adds a card taller than its
  row.
