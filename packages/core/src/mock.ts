// A hand-curated snapshot and config pair modelled on the owner's real projects, for the design
// site and the app to render every view model state without a scan. The scan is at 09:00 on 22
// October 2026, and every age below is measured from it. Between them the birds cover every mood
// and work state, the fence's three situations, failing CI, two forges disagreeing on CI, an unpushed
// backlog, a stalled branch and clean zeros, a bird with no local repository here on a wire and one
// on the fence, each with its no-local-repository slip, and one on no forge, a remote no card can
// read, forges that couldn't be read at all and one whose pull requests alone couldn't be read, the
// source cards every scan state, the Updates page every update state, and every kind of launch
// action, some overridden, the Obsidian one on Obsidian birds alone; tests/mock.test.ts keeps it
// so. Roadmap files carry numbered placeholder work items, as many as each file's open counts, with
// roadmap files within their bug thresholds, past amber on critical bugs, and past red on bugs.

import {
  type Config,
  defaultBugThresholds,
  noThresholdOverrides,
  type Papers,
} from "./config.ts";
import type { LoginEntry } from "./settings-form.ts";
import type {
  CiRun,
  Entity,
  EntityError,
  FinalisedCommit,
  ForgeData,
  ForgeName,
  ForgeRepository,
  GitData,
  LocalBranch,
  PullRequest,
  RoadmapData,
  Snapshot,
  SourceCard,
  WorkItem,
  WorkItemKind,
} from "./snapshot.ts";
import type { UpdateState } from "./update.ts";
import { type Aviary, deriveAviary } from "./viewmodel.ts";

/** The home directory the mock's paths sit under. */
export const mockHome = "/home/owner";
const home = mockHome;
const forgejoBase = "http://forge.example.lan:3000";
const scannedAt = "2026-10-22T09:00:00.000Z";

const unsafeThresholds = { amberHours: 24, redHours: 72 };
const dayThresholds = { amberDays: 7, redDays: 30 };

// Config

function papers(fields: Partial<Papers>): Papers {
  return {
    wire: null,
    name: null,
    thresholds: noThresholdOverrides(),
    keyFiles: null,
    roadmaps: null,
    zellijSession: null,
    bugWords: null,
    criticalBugWords: null,
    ...fields,
  };
}

export const mockConfig: Config = {
  wires: { names: ["Machine & Home", "Projects"], default: "Projects" },
  sources: {
    local: [
      {
        include: [
          `${home}/dev`,
          `${home}/undev`,
          `${home}/.dotfiles`,
          `${home}/obsidian/Hothouse`,
          `${home}/obsidian/Pocket`,
          `${home}/work`,
        ],
        exclude: [`${home}/dev/archived`, `${home}/dev/third-party`],
      },
    ],
    github: [
      {
        account: "finch",
        key: "github-finch",
        hosts: ["github.com", "github-work"],
        trackedForks: [],
      },
      {
        account: "the-undev",
        key: "github-the-undev",
        hosts: ["github.com", "github-work"],
        trackedForks: [],
      },
      {
        account: "newcomer",
        key: "github-newcomer",
        hosts: ["github.com"],
        trackedForks: [],
      },
    ],
    forgejo: [
      {
        account: "finch",
        key: "forgejo-finch",
        baseUrl: forgejoBase,
        hosts: ["forgejo", "forge-work", "forge.example.lan"],
        trackedForks: [],
      },
      {
        account: "the-undev",
        key: "forgejo-the-undev",
        baseUrl: forgejoBase,
        hosts: ["forgejo", "forge-work", "forge.example.lan"],
        trackedForks: [],
      },
    ],
  },
  links: [],
  ignore: [],
  thresholds: {
    unsafe: unsafeThresholds,
    stalled: dayThresholds,
    ...defaultBugThresholds,
  },
  work: { bugWords: null, criticalBugWords: null },
  entities: {
    ".dotfiles": papers({
      wire: "Machine & Home",
      name: "Dotfiles",
      roadmaps: ["docs/roadmap.md"],
    }),
    "obsidian/Hothouse": papers({
      wire: "Machine & Home",
      name: "Hothouse Vault",
      roadmaps: ["Tech/Tech Plans.md", "Garden/Garden Plans.md"],
    }),
    "obsidian/Pocket": papers({
      wire: "Machine & Home",
      name: "Pocket Vault",
      roadmaps: ["Code/Code Plans.md", "Pocket Plans.md"],
    }),
    "dev/perch": papers({
      name: "Perch",
      keyFiles: ["README.md", "docs/forge-access.md", "docs/roadmap.md"],
      roadmaps: ["docs/roadmap.md"],
    }),
    "undev/harbour": papers({
      name: "Harbour",
      roadmaps: ["docs/roadmap.md"],
    }),
    "undev/skiff": papers({
      name: "Skiff",
      roadmaps: ["docs/roadmap.md"],
    }),
    "undev/prism": papers({
      name: "Prism",
      roadmaps: ["docs/roadmap.md"],
    }),
    "undev/Hollow-legacy": papers({
      name: "Hollow (legacy)",
      roadmaps: ["docs/roadmap.md"],
    }),
    "undev/oxbow": papers({
      name: "Oxbow",
      roadmaps: ["docs/roadmap.md"],
    }),
    "undev/gramophone": papers({
      name: "Gramophone",
      roadmaps: ["docs/roadmap.md"],
    }),
    // Spool lists no roadmaps: its standard-named file is shown as a document only.
    "undev/spool": papers({ name: "Spool" }),
    "undev/glyph-docs": papers({
      name: "Glyph Docs",
      roadmaps: ["Roadmap.md"],
    }),
    "forgejo:finch/field-notes": papers({
      wire: "Machine & Home",
      name: "Pergola Notes",
    }),
  },
  scan: {
    intervalMinutes: 15,
    finalisedCommits: 10,
  },
  launch: {
    actions: [
      {
        kind: "obsidian",
        verb: "Open in Obsidian",
        command: ["xdg-open", "obsidian://open?vault={obsidian}"],
      },
      {
        kind: "zellij",
        verb: "Open the zellij tab",
        zellij: ["zellij"],
        terminal: ["alacritty", "-e", "zellij", "attach", "-c", "{session}"],
        session: "home",
        sessions: { [`${home}/undev`]: "undev" },
      },
      { kind: "vscode", verb: "Open in VS Code", command: ["code", "{path}"] },
      {
        kind: "folder",
        verb: "Open the folder",
        command: ["dolphin", "{path}"],
      },
      {
        kind: "nvim",
        verb: "Open in nvim",
        command: [
          "alacritty",
          "--working-directory",
          "{path}",
          "-e",
          "nvim",
          ".",
        ],
      },
      {
        kind: "command",
        verb: "Follow the log",
        command: ["alacritty", "-e", "lnav", "{path}/logs"],
        icon: "terminal",
      },
    ],
  },
  window: { tray: true },
  update: { check: true, install: false },
};

/** The mock machine's autostart entry: none yet, and the app running from its AppImage. */
export const mockLogin: LoginEntry = {
  on: false,
  held: null,
  path: `${home}/.config/autostart/perch.desktop`,
  target: null,
};

/** The AppImage the mock machine runs, which an install replaces. */
export const mockImage = `${home}/AppImages/perch.appimage`;

/** Minutes before the mock scan, as an ISO time. */
const minutesBefore = (minutes: number) =>
  new Date(Date.parse(scannedAt) - minutes * 60_000).toISOString();

const mockRelease = {
  version: "0.3.0",
  url: "https://github.com/the-undev/perch/releases/tag/v0.3.0",
};

/** The update state before any check, with the defaults: check on, install off. */
const updateBase: UpdateState = {
  running: "0.2.0",
  checkOn: true,
  installs: false,
  image: "~/AppImages/perch.appimage",
  release: null,
  checkedAt: null,
  failure: null,
  checking: false,
  download: { state: "none" },
};

/**
 * The update states the Updates page's status row and the tray entry show, measured to the mock
 * scan: before a check, checking, up to date, checking off, a newer release with install off and
 * on, downloading, downloaded, a failed download and a failed check, and the source run.
 */
export const mockUpdates = {
  noCheck: updateBase,
  checking: { ...updateBase, checking: true },
  upToDate: { ...updateBase, checkedAt: minutesBefore(4) },
  checkOff: { ...updateBase, checkOn: false },
  found: { ...updateBase, release: mockRelease, checkedAt: minutesBefore(12) },
  foundInstall: {
    ...updateBase,
    installs: true,
    release: mockRelease,
    checkedAt: minutesBefore(0),
  },
  downloading: {
    ...updateBase,
    installs: true,
    release: mockRelease,
    checkedAt: minutesBefore(1),
    download: {
      state: "downloading",
      version: "0.3.0",
      transferred: 41_000_000,
      total: 89_000_000,
    },
  },
  ready: {
    ...updateBase,
    installs: true,
    release: mockRelease,
    checkedAt: minutesBefore(3),
    download: { state: "ready", version: "0.3.0" },
  },
  downloadFailed: {
    ...updateBase,
    installs: true,
    release: mockRelease,
    checkedAt: minutesBefore(2),
    download: {
      state: "failed",
      version: "0.3.0",
      failure: "The download failed: the connection was reset.",
    },
  },
  checkFailed: {
    ...updateBase,
    installs: true,
    release: mockRelease,
    checkedAt: minutesBefore(130),
    failure: "api.github.com did not answer",
  },
  sourceRun: { ...updateBase, running: "0.3.0-dev", image: null },
} satisfies Record<string, UpdateState>;

// Snapshot builders: shape only, every value is written out per entity below.

function repoUrl(forge: ForgeName, fullName: string): string {
  return forge === "github"
    ? `https://github.com/${fullName}`
    : `${forgejoBase}/${fullName}`;
}

/** The SSH address each forge gives for cloning, Forgejo's on its SSH port. */
function sshUrl(forge: ForgeName, fullName: string): string {
  return forge === "github"
    ? `git@github.com:${fullName}.git`
    : `ssh://git@forgejo:2222/${fullName}.git`;
}

function forgeRepository(
  forge: ForgeName,
  fullName: string,
  foundBy: ForgeRepository["foundBy"] = "local-remote",
): ForgeRepository {
  return {
    forge,
    ref: `${forge}:${fullName.toLowerCase()}`,
    fullName,
    url: repoUrl(forge, fullName),
    sshUrl: sshUrl(forge, fullName),
    foundBy,
  };
}

function forge(
  forgeName: ForgeName,
  fullName: string,
  fields: {
    latestCi?: CiRun;
    openPullRequests?: PullRequest[] | EntityError;
    finalisedCommits: FinalisedCommit[];
  },
): ForgeData {
  return {
    fullName,
    url: repoUrl(forgeName, fullName),
    defaultBranch: "main",
    openPullRequests: fields.openPullRequests ?? [],
    latestCi: fields.latestCi ?? null,
    finalisedCommits: fields.finalisedCommits,
  };
}

function branch(
  name: string,
  lastCommitAt: string,
  subject: string,
  upstream: string | null = `origin/${name}`,
): LocalBranch {
  return { name, lastCommitAt, subject, upstream };
}

/** Open placeholder work items of one kind, numbered from the first line. */
function openWorkItems(kind: WorkItemKind, count: number): WorkItem[] {
  return Array.from({ length: count }, (_, index) => ({
    text: `${kind.replace("-", " ")} ${index + 1}`,
    kind,
    done: false,
    line: index + 1,
    source: "bullet",
    body: null,
  }));
}

/** Roadmap files holding the given open tasks, bugs and critical bugs each, counted as the scan counts them. */
export function mockRoadmap(
  files: { path: string; task: number; bug: number; criticalBug: number }[],
): RoadmapData {
  const total = (count: (file: (typeof files)[number]) => number) =>
    files.reduce((sum, file) => sum + count(file), 0);
  return {
    counts: {
      task: total((file) => file.task),
      bug: total((file) => file.bug),
      "critical-bug": total((file) => file.criticalBug),
    },
    files: files.map((file) => ({
      path: file.path,
      workItems: [
        ...openWorkItems("task", file.task),
        ...openWorkItems("bug", file.bug),
        ...openWorkItems("critical-bug", file.criticalBug),
      ],
      groups: [],
      counts: {
        task: file.task,
        bug: file.bug,
        "critical-bug": file.criticalBug,
      },
    })),
    thresholds: defaultBugThresholds,
    detectedPath: null,
  };
}

/** A standard-named roadmap file shown as a document: the papers list none, so nothing is parsed. */
export function mockDetectedRoadmap(detectedPath: string): RoadmapData {
  return { ...mockRoadmap([]), detectedPath };
}

const quietUnsafeWork: GitData["unsafeWork"] = {
  uncommitted: null,
  unpushed: null,
  level: "green",
  thresholds: unsafeThresholds,
};

function localEntity(
  id: string,
  fields: {
    kind?: Entity["kind"];
    forges: ForgeRepository[];
    flags?: Entity["flags"];
    sources: Entity["sources"];
  },
): Entity {
  const path = `${home}/${id}`;
  return {
    id,
    name: id.slice(id.lastIndexOf("/") + 1),
    kind: fields.kind ?? "git",
    path,
    repositories: {
      local: { ref: `local:${id}`, path },
      forges: fields.forges,
    },
    flags: fields.flags ?? [],
    sources: fields.sources,
  };
}

function notSetUp(include: string): Entity["flags"] {
  return [
    {
      flag: "not-set-up",
      level: "red",
      detail: `found under ${include} with no papers in config`,
    },
  ];
}

// The birds

/** Restless: three commits on main local only for 50 hours, a fresh branch with no upstream, both forges in step. */
const dotfiles = localEntity(".dotfiles", {
  forges: [
    forgeRepository("github", "finch/dotfiles"),
    forgeRepository("forgejo", "finch/dotfiles"),
  ],
  sources: {
    git: {
      backup: "linked",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 0,
      ahead: 3,
      behind: 0,
      unpushedCount: 4,
      lastCommitAt: "2026-10-21T22:15:00.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: "2026-10-20T07:00:00.000Z",
      unpushedBranches: [
        {
          name: "main",
          upstream: "origin/main",
          count: 3,
          work: {
            since: "2026-10-20T07:00:00.000Z",
            hours: 50,
            level: "amber",
          },
        },
        {
          name: "split-layout",
          upstream: null,
          count: 1,
          work: {
            since: "2026-10-22T07:00:00.000Z",
            hours: 2,
            level: "green",
          },
        },
      ],
      branches: [
        branch(
          "main",
          "2026-10-21T22:15:00.000Z",
          "Open Alacritty at 140 by 40",
        ),
        branch(
          "split-layout",
          "2026-10-22T07:00:00.000Z",
          "Try a two-row split layout",
          null,
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "e2a4c6e8a0c2e4a6c8e0a2c4e6a8c0e2a4c6e8a0",
          committedAt: "2026-10-21T22:15:00.000Z",
          subject: "Open Alacritty at 140 by 40",
        },
        {
          sha: "b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1",
          committedAt: "2026-10-20T19:30:00.000Z",
          subject: "Bind the zellij session picker to Alt-s",
        },
        {
          sha: "c4e6a8c0e2a4c6e8a0c2e4a6c8e0a2c4e6a8c0e2",
          committedAt: "2026-10-20T07:00:00.000Z",
          subject: "Keep the Starship prompt on one line",
        },
        {
          sha: "54df24558617c0e9a2b4d6f8a0c2e4b6d8f0a2c4",
          committedAt: "2026-10-02T22:43:35.000Z",
          subject: "Split the projects session into home and undev",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github.com:finch/dotfiles.git",
          pushUrls: [
            "git@github.com:finch/dotfiles.git",
            "forgejo:finch/dotfiles.git",
          ],
        },
      ],
      workState: "committed",
      unsafeWork: {
        uncommitted: null,
        unpushed: {
          since: "2026-10-20T07:00:00.000Z",
          hours: 50,
          level: "amber",
        },
        level: "amber",
        thresholds: unsafeThresholds,
      },
      stall: null,
    },
    roadmap: mockRoadmap([
      { path: "docs/roadmap.md", task: 13, bug: 0, criticalBug: 0 },
    ]),
    github: forge("github", "finch/dotfiles", {
      finalisedCommits: [
        {
          sha: "54df24558617c0e9a2b4d6f8a0c2e4b6d8f0a2c4",
          committedAt: "2026-10-02T22:43:35.000Z",
          subject: "Split the projects session into home and undev",
        },
      ],
    }),
    forgejo: forge("forgejo", "finch/dotfiles", {
      finalisedCommits: [
        {
          sha: "54df24558617c0e9a2b4d6f8a0c2e4b6d8f0a2c4",
          committedAt: "2026-10-02T22:43:35.000Z",
          subject: "Split the projects session into home and undev",
        },
      ],
    }),
  },
});

/**
 * Restless and being edited: one critical bug in its garden plans, six changes uncommitted for
 * 30 hours, and a full roadmap whose tech plans hold one bug, within its thresholds.
 */
const hothouse = localEntity("obsidian/Hothouse", {
  kind: "obsidian",
  forges: [forgeRepository("forgejo", "finch/Hothouse", "account-listing")],
  sources: {
    git: {
      backup: "linked",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 6,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-10-20T21:47:44.000Z",
      oldestUncommittedAt: "2026-10-21T03:00:00.000Z",
      oldestUnpushedAt: null,
      branches: [branch("main", "2026-10-20T21:47:44.000Z", "office lighting")],
      defaultBranchCommits: [
        {
          sha: "a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9",
          committedAt: "2026-10-20T21:47:44.000Z",
          subject: "office lighting",
        },
        {
          sha: "15e71be9637c4a2e8b0d6f1c3a5e7b9d0f2a4c6e",
          committedAt: "2026-10-20T14:47:25.000Z",
          subject: "Record that the perch repository on Forgejo is public",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "ssh://git@forgejo:2222/finch/Hothouse.git",
          pushUrls: ["ssh://git@forgejo:2222/finch/Hothouse.git"],
        },
      ],
      workState: "uncommitted",
      unsafeWork: {
        uncommitted: {
          since: "2026-10-21T03:00:00.000Z",
          hours: 30,
          level: "amber",
        },
        unpushed: null,
        level: "amber",
        thresholds: unsafeThresholds,
      },
      stall: null,
    },
    roadmap: mockRoadmap([
      { path: "Tech/Tech Plans.md", task: 120, bug: 1, criticalBug: 0 },
      { path: "Garden/Garden Plans.md", task: 74, bug: 0, criticalBug: 1 },
    ]),
    forgejo: forge("forgejo", "finch/Hothouse", {
      finalisedCommits: [
        {
          sha: "a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9",
          committedAt: "2026-10-20T21:47:44.000Z",
          subject: "office lighting",
        },
        {
          sha: "15e71be9637c4a2e8b0d6f1c3a5e7b9d0f2a4c6e",
          committedAt: "2026-10-20T14:47:25.000Z",
          subject: "Record that the perch repository on Forgejo is public",
        },
      ],
    }),
  },
});

/** Content, merged, with a backlog on offer. */
const pocket = localEntity("obsidian/Pocket", {
  kind: "obsidian",
  forges: [forgeRepository("forgejo", "finch/Pocket", "account-listing")],
  sources: {
    git: {
      backup: "linked",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 0,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-10-16T14:20:00.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: null,
      branches: [
        branch(
          "main",
          "2026-10-16T14:20:00.000Z",
          "Describe the Obsidian vault's LiveSync setup in CLAUDE.md",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "77045f066b56d1e3a5c7e9b1d3f5a7c9e1b3d5f7",
          committedAt: "2026-10-16T14:20:00.000Z",
          subject: "Describe the Obsidian vault's LiveSync setup in CLAUDE.md",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "ssh://git@forgejo:2222/finch/Pocket.git",
          pushUrls: ["ssh://git@forgejo:2222/finch/Pocket.git"],
        },
      ],
      workState: "merged",
      unsafeWork: quietUnsafeWork,
      stall: null,
    },
    roadmap: mockRoadmap([
      { path: "Code/Code Plans.md", task: 12, bug: 0, criticalBug: 0 },
      { path: "Pocket Plans.md", task: 0, bug: 0, criticalBug: 0 },
    ]),
    forgejo: forge("forgejo", "finch/Pocket", {
      finalisedCommits: [
        {
          sha: "77045f066b56d1e3a5c7e9b1d3f5a7c9e1b3d5f7",
          committedAt: "2026-10-16T14:20:00.000Z",
          subject: "Describe the Obsidian vault's LiveSync setup in CLAUDE.md",
        },
      ],
    }),
  },
});

/** Content and being edited on a fresh branch; CI passing on GitHub and pending on Forgejo, with no runner. */
const perch = localEntity("dev/perch", {
  forges: [
    forgeRepository("github", "finch/perch"),
    forgeRepository("forgejo", "finch/perch"),
  ],
  sources: {
    git: {
      backup: "linked",
      branch: "contracts",
      defaultBranch: "main",
      upstream: "origin/contracts",
      uncommittedCount: 3,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-10-22T06:30:00.000Z",
      oldestUncommittedAt: "2026-10-22T07:00:00.000Z",
      oldestUnpushedAt: null,
      branches: [
        branch(
          "contracts",
          "2026-10-22T06:30:00.000Z",
          "Derive the view model: aviary, birds, bubbles and bird pages",
        ),
        branch(
          "main",
          "2026-10-21T19:00:00.000Z",
          "Merge foundations: workspace, desktop shell, packaging and CI",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "af0893d5e1c2b4a6d8f0e2c4a6b8d0f2e4c6a8b0",
          committedAt: "2026-10-21T19:00:00.000Z",
          subject:
            "Merge foundations: workspace, desktop shell, packaging and CI",
        },
        {
          sha: "5b7aa89c3e5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e",
          committedAt: "2026-10-21T18:40:00.000Z",
          subject: "Start the build log; drop the data placement audit",
        },
        {
          sha: "a05a387e9c1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f",
          committedAt: "2026-10-21T13:20:00.000Z",
          subject:
            "Merge scanner-poc: scanner proof of concept and design phase",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github.com:finch/perch.git",
          pushUrls: [
            "git@github.com:finch/perch.git",
            "forgejo:finch/perch.git",
          ],
        },
      ],
      workState: "uncommitted",
      unsafeWork: {
        uncommitted: {
          since: "2026-10-22T07:00:00.000Z",
          hours: 2,
          level: "green",
        },
        unpushed: null,
        level: "green",
        thresholds: unsafeThresholds,
      },
      stall: {
        branch: "contracts",
        since: "2026-10-22T06:30:00.000Z",
        days: 0,
        level: "green",
        thresholds: dayThresholds,
      },
    },
    roadmap: mockRoadmap([
      { path: "docs/roadmap.md", task: 16, bug: 0, criticalBug: 0 },
    ]),
    github: forge("github", "finch/perch", {
      latestCi: {
        name: "check",
        state: "success",
        forgeState: "completed/success",
        url: "https://github.com/finch/perch/actions/runs/18712004321",
        createdAt: "2026-10-21T19:01:12Z",
      },
      openPullRequests: [
        {
          number: 6,
          title: "Typed contracts, the view model and the mock dataset",
          author: "finch",
          draft: true,
          updatedAt: "2026-10-22T06:31:00Z",
          url: "https://github.com/finch/perch/pull/6",
        },
      ],
      finalisedCommits: [
        {
          sha: "af0893d5e1c2b4a6d8f0e2c4a6b8d0f2e4c6a8b0",
          committedAt: "2026-10-21T19:00:00.000Z",
          subject:
            "Merge foundations: workspace, desktop shell, packaging and CI",
        },
        {
          sha: "5b7aa89c3e5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e",
          committedAt: "2026-10-21T18:40:00.000Z",
          subject: "Start the build log; drop the data placement audit",
        },
        {
          sha: "a05a387e9c1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f",
          committedAt: "2026-10-21T13:20:00.000Z",
          subject:
            "Merge scanner-poc: scanner proof of concept and design phase",
        },
      ],
    }),
    forgejo: forge("forgejo", "finch/perch", {
      latestCi: {
        name: "check / check (push)",
        state: "pending",
        forgeState: "pending",
        url: `${forgejoBase}/finch/perch/actions/runs/14`,
        createdAt: "2026-10-21T20:01:10+01:00",
      },
      finalisedCommits: [
        {
          sha: "af0893d5e1c2b4a6d8f0e2c4a6b8d0f2e4c6a8b0",
          committedAt: "2026-10-21T19:00:00.000Z",
          subject:
            "Merge foundations: workspace, desktop shell, packaging and CI",
        },
      ],
    }),
  },
});

/** Content and merged on two forges, neither running CI, Forgejo a commit behind GitHub. */
const harbour = localEntity("undev/harbour", {
  forges: [
    forgeRepository("github", "the-undev/harbour"),
    forgeRepository("forgejo", "the-undev/harbour"),
  ],
  sources: {
    git: {
      backup: "linked",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 0,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-10-20T21:00:02.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: null,
      branches: [
        branch(
          "main",
          "2026-10-20T21:00:02.000Z",
          "Merge branch 'plan-move-on'",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "f1cf131eda8f4a6e4beda1f0a80dd3564680de86",
          committedAt: "2026-10-20T21:00:02Z",
          subject: "Merge branch 'plan-move-on'",
        },
        {
          sha: "997987503439da4601118eb9d1d042e4dd788c2f",
          committedAt: "2026-10-20T20:59:57Z",
          subject: "Show a banner when the plan is ending or has ended",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github-work:the-undev/harbour.git",
          pushUrls: [
            "git@github-work:the-undev/harbour.git",
            "forge-work:the-undev/harbour.git",
          ],
        },
      ],
      workState: "merged",
      unsafeWork: quietUnsafeWork,
      stall: null,
    },
    roadmap: mockRoadmap([
      { path: "docs/roadmap.md", task: 12, bug: 0, criticalBug: 0 },
    ]),
    github: forge("github", "the-undev/harbour", {
      finalisedCommits: [
        {
          sha: "f1cf131eda8f4a6e4beda1f0a80dd3564680de86",
          committedAt: "2026-10-20T21:00:02Z",
          subject: "Merge branch 'plan-move-on'",
        },
        {
          sha: "997987503439da4601118eb9d1d042e4dd788c2f",
          committedAt: "2026-10-20T20:59:57Z",
          subject: "Show a banner when the plan is ending or has ended",
        },
      ],
    }),
    forgejo: forge("forgejo", "the-undev/harbour", {
      finalisedCommits: [
        {
          sha: "997987503439da4601118eb9d1d042e4dd788c2f",
          committedAt: "2026-10-20T20:59:57Z",
          subject: "Show a banner when the plan is ending or has ended",
        },
      ],
    }),
  },
});

/**
 * Restless: it pushes to skiff-app/skiff on GitHub, which no card covers, and to Forgejo, read
 * fine; and stalled on a feature branch for three weeks with everything pushed.
 */
const skiff = localEntity("undev/skiff", {
  forges: [
    {
      forge: "github",
      ref: "github:skiff-app/skiff",
      fullName: "skiff-app/skiff",
      url: null,
      sshUrl: null,
      foundBy: "local-remote",
    },
    forgeRepository("forgejo", "the-undev/skiff"),
  ],
  sources: {
    git: {
      backup: "linked",
      branch: "extension-popup-ia",
      defaultBranch: "main",
      upstream: "origin/extension-popup-ia",
      uncommittedCount: 0,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-10-01T09:00:00.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: null,
      branches: [
        branch(
          "extension-popup-ia",
          "2026-10-01T09:00:00.000Z",
          "Correct the extension changelog fragments for the new surfaces",
        ),
        branch(
          "main",
          "2026-08-31T08:10:02.000Z",
          "Merge 'Extension site patterns' from extension-site-patterns into main",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "a5aa76eb61a2c4e6a8c0e2a4c6e8a0c2e4a6c8e0",
          committedAt: "2026-08-31T08:10:02Z",
          subject:
            "Merge 'Extension site patterns' from extension-site-patterns into main",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github-work:skiff-app/skiff.git",
          pushUrls: [
            "git@github-work:skiff-app/skiff.git",
            "forge-work:the-undev/skiff.git",
          ],
        },
      ],
      workState: "committed",
      unsafeWork: quietUnsafeWork,
      stall: {
        branch: "extension-popup-ia",
        since: "2026-10-01T09:00:00.000Z",
        days: 21,
        level: "amber",
        thresholds: dayThresholds,
      },
    },
    roadmap: mockRoadmap([
      { path: "docs/roadmap.md", task: 12, bug: 0, criticalBug: 0 },
    ]),
    github: {
      error: "no GitHub card is configured for owner skiff-app",
      cause: "no-card",
    },
    forgejo: forge("forgejo", "the-undev/skiff", {
      latestCi: {
        name: "check / check (push)",
        state: "success",
        forgeState: "success",
        url: `${forgejoBase}/the-undev/skiff/actions/runs/31/jobs/0`,
        createdAt: "2026-08-31T08:12:44Z",
      },
      openPullRequests: [
        {
          number: 41,
          title: "Extension popup IA",
          author: "finch",
          draft: true,
          updatedAt: "2026-10-01T09:05:00Z",
          url: `${forgejoBase}/the-undev/skiff/pulls/41`,
        },
        {
          number: 40,
          title: "Wait for the popup close a retry causes",
          author: "finch",
          draft: false,
          updatedAt: "2026-08-31T10:25:00Z",
          url: `${forgejoBase}/the-undev/skiff/pulls/40`,
        },
      ],
      finalisedCommits: [
        {
          sha: "a5aa76eb61a2c4e6a8c0e2a4c6e8a0c2e4a6c8e0",
          committedAt: "2026-08-31T08:10:02Z",
          subject:
            "Merge 'Extension site patterns' from extension-site-patterns into main",
        },
      ],
    }),
  },
});

/**
 * Distressed: CI failing on Forgejo, four changes uncommitted for 60 hours, and GitHub's pull
 * requests not read while its CI and commits were.
 */
const prism = localEntity("undev/prism", {
  forges: [
    forgeRepository("github", "the-undev/prism"),
    forgeRepository("forgejo", "the-undev/prism"),
  ],
  sources: {
    git: {
      backup: "linked",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 4,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-10-16T21:16:34.000Z",
      oldestUncommittedAt: "2026-10-19T21:00:00.000Z",
      oldestUnpushedAt: null,
      branches: [
        branch(
          "main",
          "2026-10-16T21:16:34.000Z",
          "Merge composition-and-dispatch: prism becomes the user's side of ComfyUI",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "76cb6256a466e8a0c2e4a6c8e0a2c4e6a8c0e2a4",
          committedAt: "2026-10-16T21:16:34.000Z",
          subject:
            "Merge composition-and-dispatch: prism becomes the user's side of ComfyUI",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github-work:the-undev/prism.git",
          pushUrls: [
            "git@github-work:the-undev/prism.git",
            "forge-work:the-undev/prism.git",
          ],
        },
      ],
      workState: "uncommitted",
      unsafeWork: {
        uncommitted: {
          since: "2026-10-19T21:00:00.000Z",
          hours: 60,
          level: "amber",
        },
        unpushed: null,
        level: "amber",
        thresholds: unsafeThresholds,
      },
      stall: null,
    },
    roadmap: mockRoadmap([
      { path: "docs/roadmap.md", task: 78, bug: 0, criticalBug: 0 },
    ]),
    github: forge("github", "the-undev/prism", {
      latestCi: {
        name: "check",
        state: "success",
        forgeState: "completed/success",
        url: "https://github.com/the-undev/prism/actions/runs/18611200341",
        createdAt: "2026-10-16T21:17:02Z",
      },
      openPullRequests: {
        error:
          "HTTP 404 from https://api.github.com/repos/the-undev/prism/pulls?state=open&per_page=100",
      },
      finalisedCommits: [
        {
          sha: "76cb6256a466e8a0c2e4a6c8e0a2c4e6a8c0e2a4",
          committedAt: "2026-10-16T21:16:34Z",
          subject:
            "Merge composition-and-dispatch: prism becomes the user's side of ComfyUI",
        },
      ],
    }),
    forgejo: forge("forgejo", "the-undev/prism", {
      latestCi: {
        name: "check / check (push)",
        state: "failure",
        forgeState: "failure",
        url: `${forgejoBase}/the-undev/prism/actions/runs/6/jobs/0`,
        createdAt: "2026-10-17T23:02:30+01:00",
      },
      openPullRequests: [
        {
          number: 3,
          title: "LoRA quirk resilience",
          author: "finch",
          draft: false,
          updatedAt: "2026-10-17T09:50:00Z",
          url: `${forgejoBase}/the-undev/prism/pulls/3`,
        },
        {
          number: 2,
          title: "Note the requeue and send-dialog size gaps",
          author: "finch",
          draft: true,
          updatedAt: "2026-10-02T18:20:00Z",
          url: `${forgejoBase}/the-undev/prism/pulls/2`,
        },
      ],
      finalisedCommits: [
        {
          sha: "76cb6256a466e8a0c2e4a6c8e0a2c4e6a8c0e2a4",
          committedAt: "2026-10-16T22:16:34+01:00",
          subject:
            "Merge composition-and-dispatch: prism becomes the user's side of ComfyUI",
        },
      ],
    }),
  },
});

/** Distressed: twenty-three bugs open on the roadmap, past red. */
const hollow = localEntity("undev/Hollow-legacy", {
  forges: [forgeRepository("github", "the-undev/Hollow")],
  sources: {
    git: {
      backup: "linked",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 0,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-05-06T10:33:04.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: null,
      branches: [
        branch(
          "main",
          "2026-05-06T10:33:04.000Z",
          "Per-kind site policies, error observability, and grab-UX polish (#17)",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "958b0709e120a2c4e6a8c0e2a4c6e8a0c2e4a6c8",
          committedAt: "2026-05-06T10:33:04Z",
          subject:
            "Per-kind site policies, error observability, and grab-UX polish (#17)",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github-work:the-undev/Hollow.git",
          pushUrls: ["git@github-work:the-undev/Hollow.git"],
        },
      ],
      workState: "merged",
      unsafeWork: quietUnsafeWork,
      stall: null,
    },
    roadmap: mockRoadmap([
      { path: "docs/roadmap.md", task: 7, bug: 23, criticalBug: 0 },
    ]),
    github: forge("github", "the-undev/Hollow", {
      latestCi: {
        name: "CI",
        state: "success",
        forgeState: "completed/success",
        url: "https://github.com/the-undev/Hollow/actions/runs/25430131657",
        createdAt: "2026-05-06T10:33:07Z",
      },
      finalisedCommits: [
        {
          sha: "958b0709e120a2c4e6a8c0e2a4c6e8a0c2e4a6c8",
          committedAt: "2026-05-06T10:33:04Z",
          subject:
            "Per-kind site policies, error observability, and grab-UX polish (#17)",
        },
      ],
    }),
  },
});

/** Content and merged on two forges, neither running CI, with a long backlog. */
const oxbow = localEntity("undev/oxbow", {
  forges: [
    forgeRepository("github", "the-undev/oxbow"),
    forgeRepository("forgejo", "the-undev/oxbow"),
  ],
  sources: {
    git: {
      backup: "linked",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 0,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-10-09T21:05:29.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: null,
      branches: [
        branch(
          "main",
          "2026-10-09T21:05:29.000Z",
          "Show the tide table offline",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e",
          committedAt: "2026-10-09T21:05:29.000Z",
          subject: "Show the tide table offline",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github-work:the-undev/oxbow.git",
          pushUrls: [
            "git@github-work:the-undev/oxbow.git",
            "forge-work:the-undev/oxbow.git",
          ],
        },
      ],
      workState: "merged",
      unsafeWork: quietUnsafeWork,
      stall: null,
    },
    roadmap: mockRoadmap([
      { path: "docs/roadmap.md", task: 96, bug: 0, criticalBug: 0 },
    ]),
    github: forge("github", "the-undev/oxbow", {
      finalisedCommits: [
        {
          sha: "5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e",
          committedAt: "2026-10-09T21:05:29.000Z",
          subject: "Show the tide table offline",
        },
      ],
    }),
    forgejo: forge("forgejo", "the-undev/oxbow", {
      finalisedCommits: [
        {
          sha: "5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e",
          committedAt: "2026-10-09T21:05:29.000Z",
          subject: "Show the tide table offline",
        },
      ],
    }),
  },
});

/** Distressed and being edited: fourteen changes uncommitted for five days. */
const gramophone = localEntity("undev/gramophone", {
  forges: [forgeRepository("forgejo", "the-undev/gramophone")],
  sources: {
    git: {
      backup: "linked",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 14,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-09-24T21:43:23.000Z",
      oldestUncommittedAt: "2026-10-17T06:00:00.000Z",
      oldestUnpushedAt: null,
      branches: [
        branch(
          "main",
          "2026-09-24T21:43:23.000Z",
          "Write down what the tool has to do",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "c91ce3efa2a3b5d7f9a1c3e5b7d9f1a3c5e7b9d1",
          committedAt: "2026-09-24T21:43:23.000Z",
          subject: "Write down what the tool has to do",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "forge-work:the-undev/gramophone.git",
          pushUrls: ["forge-work:the-undev/gramophone.git"],
        },
      ],
      workState: "uncommitted",
      unsafeWork: {
        uncommitted: {
          since: "2026-10-17T06:00:00.000Z",
          hours: 123,
          level: "red",
        },
        unpushed: null,
        level: "red",
        thresholds: unsafeThresholds,
      },
      stall: null,
    },
    roadmap: mockRoadmap([
      { path: "docs/roadmap.md", task: 3, bug: 0, criticalBug: 0 },
    ]),
    forgejo: forge("forgejo", "the-undev/gramophone", {
      finalisedCommits: [
        {
          sha: "c91ce3efa2a3b5d7f9a1c3e5b7d9f1a3c5e7b9d1",
          committedAt: "2026-09-24T21:43:23.000Z",
          subject: "Write down what the tool has to do",
        },
      ],
    }),
  },
});

/** Content and merged with every count a clean zero. */
const spool = localEntity("undev/spool", {
  forges: [forgeRepository("forgejo", "the-undev/spool")],
  sources: {
    git: {
      backup: "linked",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 0,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-10-20T23:00:00.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: null,
      branches: [
        branch(
          "main",
          "2026-10-20T23:00:00.000Z",
          "Merge the dashboard overhaul and its fixes",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "0c7c143772e4a6c8e0a2c4e6a8c0e2a4c6e8a0c2",
          committedAt: "2026-10-20T23:00:00.000Z",
          subject: "Merge the dashboard overhaul and its fixes",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "forge-work:the-undev/spool.git",
          pushUrls: ["forge-work:the-undev/spool.git"],
        },
      ],
      workState: "merged",
      unsafeWork: quietUnsafeWork,
      stall: null,
    },
    roadmap: mockDetectedRoadmap("docs/roadmap.md"),
    forgejo: forge("forgejo", "the-undev/spool", {
      finalisedCommits: [
        {
          sha: "0c7c143772e4a6c8e0a2c4e6a8c0e2a4c6e8a0c2",
          committedAt: "2026-10-20T23:00:00.000Z",
          subject: "Merge the dashboard overhaul and its fixes",
        },
      ],
    }),
  },
});

/** Content and committed on a branch with one fresh commit not yet pushed. */
const glyphDocs = localEntity("undev/glyph-docs", {
  kind: "obsidian",
  forges: [forgeRepository("forgejo", "the-undev/glyph-docs")],
  sources: {
    git: {
      backup: "linked",
      branch: "render-scale-fix",
      defaultBranch: "main",
      upstream: "origin/render-scale-fix",
      uncommittedCount: 0,
      ahead: 1,
      behind: 0,
      unpushedCount: 1,
      lastCommitAt: "2026-10-22T04:00:00.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: "2026-10-22T04:00:00.000Z",
      unpushedBranches: [
        {
          name: "render-scale-fix",
          upstream: "origin/render-scale-fix",
          count: 1,
          work: {
            since: "2026-10-22T04:00:00.000Z",
            hours: 5,
            level: "green",
          },
        },
      ],
      branches: [
        branch(
          "render-scale-fix",
          "2026-10-22T04:00:00.000Z",
          "Add the H3 video upscale experiment",
        ),
        branch(
          "main",
          "2026-10-15T09:19:42.000Z",
          "Merge qwen-image-setup: the Qwen Image global pool setup guide",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "ce0bebb282e8a0c2e4a6c8e0a2c4e6a8c0e2a4c6",
          committedAt: "2026-10-15T09:19:42.000Z",
          subject:
            "Merge qwen-image-setup: the Qwen Image global pool setup guide",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "forge-work:the-undev/glyph-docs.git",
          pushUrls: ["forge-work:the-undev/glyph-docs.git"],
        },
      ],
      workState: "committed",
      unsafeWork: {
        uncommitted: null,
        unpushed: {
          since: "2026-10-22T04:00:00.000Z",
          hours: 5,
          level: "green",
        },
        level: "green",
        thresholds: unsafeThresholds,
      },
      stall: {
        branch: "render-scale-fix",
        since: "2026-10-22T04:00:00.000Z",
        days: 0,
        level: "green",
        thresholds: dayThresholds,
      },
    },
    roadmap: mockRoadmap([
      { path: "Roadmap.md", task: 11, bug: 0, criticalBug: 0 },
    ]),
    forgejo: forge("forgejo", "the-undev/glyph-docs", {
      finalisedCommits: [
        {
          sha: "ce0bebb282e8a0c2e4a6c8e0a2c4e6a8c0e2a4c6",
          committedAt: "2026-10-15T09:19:42.000Z",
          subject:
            "Merge qwen-image-setup: the Qwen Image global pool setup guide",
        },
      ],
    }),
  },
});

// The fence

/** Found under an include directory, linked to two forges, not yet decided; neither forge's detail read. */
const homeItConfig = localEntity("dev/hearth-config", {
  forges: [
    forgeRepository("github", "finch/hearth-config"),
    forgeRepository("forgejo", "finch/hearth-config"),
  ],
  flags: notSetUp(`${home}/dev`),
  sources: {
    git: {
      backup: "linked",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 0,
      ahead: 0,
      behind: 0,
      unpushedCount: 0,
      lastCommitAt: "2026-10-11T09:35:24.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: null,
      branches: [
        branch(
          "main",
          "2026-10-11T09:35:24.000Z",
          "Add a User Script that updates harbour-edge when a newer edge image is published",
        ),
      ],
      defaultBranchCommits: [
        {
          sha: "d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5",
          committedAt: "2026-10-11T09:35:24.000Z",
          subject:
            "Add a User Script that updates harbour-edge when a newer edge image is published",
        },
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github.com:finch/hearth-config.git",
          pushUrls: [
            "git@github.com:finch/hearth-config.git",
            "forgejo:finch/hearth-config.git",
          ],
        },
      ],
      workState: "merged",
      unsafeWork: quietUnsafeWork,
      stall: null,
    },
    roadmap: mockRoadmap([]),
    github: {
      error:
        'no token in the keyring under service perch key github-finch; store it with: secret-tool store --label "perch github-finch" service perch key github-finch',
      cause: "read-failed",
    },
    forgejo: {
      error:
        'no token in the keyring under service perch key forgejo-finch; store it with: secret-tool store --label "perch forgejo-finch" service perch key forgejo-finch',
      cause: "read-failed",
    },
  },
});

/** Found with no remote at all: one disk only. */
const hello = localEntity("dev/odin/hello", {
  flags: notSetUp(`${home}/dev`),
  forges: [],
  sources: {
    git: {
      backup: "local-only",
      branch: "main",
      defaultBranch: "main",
      upstream: null,
      uncommittedCount: 0,
      ahead: null,
      behind: null,
      unpushedCount: 0,
      lastCommitAt: "2025-10-14T15:45:44.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: null,
      branches: [
        branch("main", "2025-10-14T15:45:44.000Z", "mli for shape", null),
      ],
      defaultBranchCommits: [
        {
          sha: "9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b",
          committedAt: "2025-10-14T15:45:44.000Z",
          subject: "mli for shape",
        },
      ],
      remotes: [],
      workState: "merged",
      unsafeWork: quietUnsafeWork,
      stall: null,
    },
    roadmap: mockRoadmap([]),
  },
});

/** On a forge, with no local repository here. */
const obsidianTidy: Entity = {
  id: "github:finch/obsidian-tidy",
  name: "obsidian-tidy",
  kind: "git",
  path: null,
  repositories: {
    local: null,
    forges: [
      forgeRepository("github", "finch/obsidian-tidy", "account-listing"),
    ],
  },
  flags: [],
  sources: {
    github: forge("github", "finch/obsidian-tidy", {
      finalisedCommits: [
        {
          sha: "071c242e52ffa2c4e6a8c0e2a4c6e8a0c2e4a6c8",
          committedAt: "2026-03-02T11:02:48Z",
          subject: "vault backup: 2026-03-02 11:02:48",
        },
      ],
    }),
  },
};

/** Adopted while only on Forgejo: no local repository here, so its slip says so and the meta line too. */
const pergolaNotes: Entity = {
  id: "forgejo:finch/field-notes",
  name: "field-notes",
  kind: "git",
  path: null,
  repositories: {
    local: null,
    forges: [
      forgeRepository("forgejo", "finch/field-notes", "account-listing"),
    ],
  },
  flags: [],
  sources: {
    forgejo: forge("forgejo", "finch/field-notes", {
      finalisedCommits: [
        {
          sha: "5d2e8f0a1b3c4d5e6f708192a3b4c5d6e7f80912",
          committedAt: "2026-10-20T08:12:00Z",
          subject: "Add the boiler service notes",
        },
      ],
    }),
  },
};

const entities: Entity[] = [
  dotfiles,
  hothouse,
  pocket,
  perch,
  harbour,
  skiff,
  prism,
  hollow,
  oxbow,
  gramophone,
  spool,
  glyphDocs,
  homeItConfig,
  hello,
  obsidianTidy,
  pergolaNotes,
];

function listing(forgeName: ForgeName): Snapshot["forges"][ForgeName] {
  return {
    active: entities.flatMap((entity) =>
      entity.repositories.forges.flatMap((entry) =>
        entry.forge !== forgeName || entry.url === null
          ? []
          : [
              {
                ref: entry.ref,
                fullName: entry.fullName,
                url: entry.url,
                entityId: entity.id,
                ignored: false,
              },
            ],
      ),
    ),
    archived:
      forgeName === "github"
        ? [
            {
              ref: "github:finch/antler",
              fullName: "finch/antler",
              url: "https://github.com/finch/antler",
              entityId: null,
              ignored: false,
            },
          ]
        : [],
  };
}

const ok = (durationMs: number) => ({
  state: "ok" as const,
  reason: null,
  error: null,
  lastSucceededAt: scannedAt,
  durationMs,
});

function githubCard(account: string, count: number): SourceCard {
  return {
    id: `github:${account}`,
    kind: "github",
    label: account,
    result: { state: "ok", at: scannedAt, count, missingIncludes: [] },
  };
}

/** A Forgejo card on the instance whose source timed out this scan. */
function forgejoCard(account: string): SourceCard {
  return {
    id: `forgejo:${account}@forge.example.lan:3000`,
    kind: "forgejo",
    label: `${account}@forge.example.lan:3000`,
    result: {
      state: "failed",
      message: "fetch failed: connect ETIMEDOUT forge.example.lan:3000",
      lastSucceededAt: "2026-10-22T08:45:00.000Z",
    },
  };
}

export const mockSnapshot: Snapshot = {
  scannedAt,
  durationMs: 6200,
  aggregatedAt: "2026-10-22T09:00:07.000Z",
  configPath: `${home}/.config/perch/config.toml`,
  warnings: [`include not found: ${home}/work`],
  conflicts: [],
  forges: { github: listing("github"), forgejo: listing("forgejo") },
  sources: {
    local: ok(840),
    githubAccounts: ok(1210),
    forgejoAccounts: {
      state: "error",
      reason: "request-failed",
      error: "fetch failed: connect ETIMEDOUT forge.example.lan:3000",
      lastSucceededAt: "2026-10-22T08:45:00.000Z",
      durationMs: 10000,
    },
    roadmap: ok(60),
    github: ok(2400),
    forgejo: ok(700),
  },
  sourceCards: [
    {
      id: "local:~/dev",
      kind: "local",
      label:
        "~/dev, ~/undev, ~/.dotfiles, ~/obsidian/Hothouse, ~/obsidian/Pocket, ~/work",
      result: {
        state: "ok",
        at: scannedAt,
        count: 14,
        missingIncludes: ["~/work"],
      },
    },
    githubCard("finch", 5),
    githubCard("the-undev", 4),
    // Added to config since the last scan, so no raw file holds it yet.
    {
      id: "github:newcomer",
      kind: "github",
      label: "newcomer",
      result: { state: "never-scanned" },
    },
    forgejoCard("finch"),
    forgejoCard("the-undev"),
  ],
  entities,
};

/** The view model of the mock pair: every component state the design site renders. */
export const mockAviary: Aviary = deriveAviary(
  mockSnapshot,
  mockConfig,
  {},
  mockHome,
);
