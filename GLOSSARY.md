# Perch

Perch shows the state of everything its owner works on as birds on wires. These
are the words for what it shows and for the facts behind it.

## Language

### Entities

**Entity**:
Something perch can watch. A project is the only type so far.
_Avoid_: Item, thing

**Project**:
An entity made of code or documents: its repositories, taken as one.
_Avoid_: Repo (a repository is one copy of a project)

**Repository**:
One copy of a project: a local repository or a forge repository.
_Avoid_: Presence

**Local repository**:
A project's repository on this machine. A project has one at most.
_Avoid_: Clone, checkout, working copy

**Forge repository**:
A project's repository on a forge. A project has any number.

**Forge**:
A service that hosts repositories, such as GitHub or a Forgejo instance.
_Avoid_: Remote (a remote is git's own name for an address a local repository pushes to)

**Link**:
What makes several repositories one project, proved by a remote's address or stated by the owner.
_Avoid_: Join, relationship

**Papers**:
What the owner has recorded about one entity, such as its wire, its name and its roadmaps.
_Avoid_: Entry

**Adopted**:
Taken on by the owner to look after. An adopted bird has papers and sits on a wire; every other bird sits on the fence.

### The aviary

**Aviary**:
The whole scene: the wires, the fence beneath them and every bird.

**Bird**:
An entity as the aviary shows it.

**Wire**:
One of the owner's priority bands, named and ordered in config, holding the adopted birds it is given.
_Avoid_: Row, lane, group

**Fence**:
Where every bird that is not adopted sits, dimmed, beneath the wires.

**Fence bird**:
A bird that is not adopted.

**Fly-in**:
The birds landing one by one when the aviary opens.

**Plumpness**:
A bird's size, from its outstanding work.

**Asleep**:
A bird's look, eyes closed with a z.
Adopted bird: asleep between midnight and 06:00, unless distressed or uncommitted.
Fence bird: asleep between midnight and 06:00.
Snoozed bird: asleep at any hour.

**Bubble**:
What a clicked bird says: its name, state phrase, speech and chips.
_Avoid_: Tooltip, popover

**State phrase**:
The phrase beside the name in a bubble: the bird's mood, or not adopted, or snoozed.
_Avoid_: State word

**Speech**:
The bird's first-person sentence giving the reason for its mood.

**Chip**:
One number or state a bird carries in its bubble, coloured when its fact has reached a threshold.
_Avoid_: Badge, tag

**Bird's page**:
The full account of one bird: the roost, the ledger, the history, its branches, pull requests and sheets.
_Avoid_: Detail view

**Roost**:
The bird on its own page, sitting on a stand with its bubble beside it.

**Sheet**:
One paper on a bird's page, such as a key file, a roadmap's work or the adoption papers.

**Ledger**:
The list on a bird's page of every fact about it in full words.

**Reading**:
What one source says about a fact in the ledger, such as "failure on main" from one forge.
_Avoid_: Working

**History**:
The newest finalised commits, each told once however many repositories hold it.
_Avoid_: River

**Key file**:
A file from the local repository shown on the bird's page, such as the README or a roadmap.

**Adoption papers**:
The sheet on a bird's page that adopts it or changes its papers.

**Action**:
Something the owner does to a bird from its bubble or its page. Launch actions, the adopt action, the full-story action, the snooze action and the wake action are kinds of action.
_Avoid_: Key

**Adopt action**:
The action in a fence bird's bubble that opens its page with the adoption papers unfolded.
_Avoid_: Adopt key

**Full-story action**:
The bubble's "Tell me the full story" action, which opens the bird's page.
_Avoid_: Full-story key

**Launch action**:
An action that opens something for the project, such as an editor or a terminal tab. It changes nothing.

**Snooze action**:
The action that snoozes an adopted bird for a length of time the owner picks.
_Avoid_: Snooze key

**Wake action**:
The action that ends a snooze before its end date. It takes the snooze action's place while a bird is snoozed.
_Avoid_: Wake key

### Health

**Fact**:
One thing perch knows about an entity, read by a scan or worked out from what it read.

**Health**:
How an entity stands: a level and the causes behind it.
_Avoid_: Status

**Level**:
Green, amber or red. An entity's level is that of its worst cause.
_Avoid_: Severity, colour

**Cause**:
One amber or red fact that sets an entity's health, such as failing CI.

**Threshold**:
A limit a fact is compared against. A fact with thresholds has two: amber at the first, red at the second.
_Avoid_: Window

**Mood**:
How a bird wears its level: content for green, restless for amber, distressed for red.
_Avoid_: Settled, drifting, attention

**Work state**:
How far the work in a project's local repository has got, apart from its health: uncommitted, committed or merged. Uncommitted wins over committed.
_Avoid_: Activity

**Uncommitted**:
The local repository holds changes that are not committed.
_Avoid_: Editing

**Committed**:
The local repository holds commits not yet pushed, or a local branch other than the default, checked out or not.
_Avoid_: In flight, in progress

**Merged**:
Neither uncommitted nor committed.
_Avoid_: Settled

**Unsafe work**:
Uncommitted changes and unpushed commits, aged from the oldest.
_Avoid_: Drift

**Stalled**:
The local repository has a branch other than the default checked out, and that branch has had no new commit. A cause, aged in days.
_Avoid_: Parked

**Finalised commit**:
A commit on a project's default branch.

**Snoozed**:
A bird set aside by the owner until a date, or until woken. It is dimmed and asleep and does not wear its mood. Its bubble and page still show the entity's facts.

**Flag**:
Something odd about how an entity is set up, such as an archived forge repository or two sets of papers naming it.

### Work

**Roadmap**:
A Markdown file in the local repository listing work to do, which the papers name.

**Work item**:
One line of work in a roadmap: a task, a bug or a critical bug.
_Avoid_: Ticket, issue

**Task**:
A work item that is neither a bug nor a critical bug. Tasks never change health.

**Bug**:
A work item holding one of the bug words config lists.

**Critical bug**:
A work item holding one of the critical bug words config lists. A critical bug word wins over a bug word.

**Outstanding work**:
A project's work items of every kind that are not done.

### Scanning

**Source**:
Somewhere perch reads facts from: local folders, a forge account or a roadmap.

**Source card**:
One configured source as the settings page shows it, with the result of its last scan.

**Scan**:
One read of every source.

**Snapshot**:
What the latest scan found. Only the latest is kept.

**Assertion**:
Something config states that leaves no trace on disk or on a forge, such as a link.

**Observation**:
Something a scan read. When an assertion and an observation disagree, the observation wins.
