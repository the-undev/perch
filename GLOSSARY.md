# Perch

Perch shows the state of everything its owner works on as birds on wires. These
are the words for what it shows and for the facts behind it.

## Language

### Entities

**Entity**:
Something the owner looks after that perch can watch. A project is the only type so far.
_Avoid_: Item, thing

**Project**:
An entity made of code or documents: its repositories and its roadmaps, taken as one.
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
What the owner has recorded about one entity: its wire, its name and its own thresholds.
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

**Bubble**:
What a clicked bird says: its name, state word, speech and chips.
_Avoid_: Tooltip, popover

**State word**:
The one word beside the name in a bubble: content, restless, distressed, not adopted or snoozed.

**Speech**:
The bird's first-person sentence giving the reason for its mood.

**Chip**:
One number or state a bird carries in its bubble, coloured when its fact is judged.
_Avoid_: Badge, tag

**Bird's page**:
The full account of one bird: the ledger, the history, its branches, pull requests and key files.
_Avoid_: Detail view

**Ledger**:
The list on a bird's page of every fact about it in full words.

**Reading**:
What one source says about a fact in the ledger, such as "failure on main" from one forge.
_Avoid_: Working

**History**:
The newest commits on a project's default branch, each told once however many repositories hold it.
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
The action that snoozes an adopted bird for 1 day, 3 days, 1 week, 2 weeks, 1 month or indefinitely.
_Avoid_: Snooze key

**Wake action**:
The action that ends a snooze before its end date. It takes the snooze action's place while a bird is snoozed.
_Avoid_: Wake key

### Health

**Health**:
The fact of how an entity stands: a level and the causes behind it.
_Avoid_: Status

**Level**:
Green, amber or red. An entity's level is that of its worst cause.
_Avoid_: Severity, colour

**Cause**:
One amber or red fact that sets an entity's health, such as failing CI.

**Threshold**:
A limit a fact is judged against. Each judged fact has two: amber at the first, red at the second.
_Avoid_: Window

**Mood**:
How a bird wears its level: content for green, restless for amber, distressed for red.

**Activity**:
What is happening in a project's local repository, apart from its health: editing, in flight or settled.

**Editing**:
The local repository holds uncommitted changes.

**In flight**:
Work is under way that is not finished: commits not yet pushed, or a branch other than the default.
_Avoid_: In progress

**Settled**:
Neither editing nor in flight.

**Unsafe work**:
Uncommitted changes and unpushed commits, aged from the oldest.
_Avoid_: Drift

**Stalled**:
In flight with no new commit: the local repository sits on a branch other than the default and that branch has not moved.
_Avoid_: Parked

**Finalised commit**:
A commit on a project's default branch.

**Plumpness**:
A bird's size, from its outstanding work.

**Asleep**:
A bird's look, eyes closed with a z. A bird that is neither distressed nor being edited is asleep between midnight and 06:00, and a snoozed bird at any hour.

**Snoozed**:
A bird set aside by the owner until a date, or until woken. It is dimmed and asleep and does not wear its mood. Its bubble and page still show the entity's facts.

**Fly-in**:
The birds landing one by one when the aviary opens.

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
A work item holding one of the bug words.

**Critical bug**:
A work item holding one of the critical bug words.

**Outstanding work**:
A project's open work items of every kind.

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
