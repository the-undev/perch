// A hand-curated snapshot and config pair modelled on the owner's real projects, for the design
// site and the app to render every view model state without a scan. The scan is at 09:00 on
// 22 October 2026, and every age below is measured from it. Between them the birds cover every
// mood and activity, the fence's three situations, failing CI, an unpushed backlog, a stalled
// branch and clean zeros, a bird with no clone here and one on no forge, and the source cards
// every scan state;
// tests/mock.test.ts keeps it so. Roadmap files carry
// their paths only: the counts stand for their items.

import type { Config, ItemEntry } from "./config.ts";
import type {
  CiRun,
  FinalisedCommit,
  ForgeData,
  ForgeName,
  ForgePresence,
  GitData,
  Item,
  LocalBranch,
  PullRequest,
  RoadmapData,
  Snapshot,
  SourceCard,
} from "./snapshot.ts";
import { type Aviary, deriveAviary } from "./viewmodel.ts";

/** The home directory the mock's paths sit under. */
export const mockHome = "/home/owner";
const home = mockHome;
const forgejoBase = "http://forge.example.lan:3000";
const scannedAt = "2026-10-22T09:00:00.000Z";

const unsafeWindows = { amberHours: 24, redHours: 72 };
const dayWindows = { amberDays: 7, redDays: 30 };

// Config

function entry(fields: Partial<ItemEntry>): ItemEntry {
  return {
    wire: null,
    name: null,
    thresholds: { unsafe: {}, stalled: {} },
    keyFiles: null,
    roadmaps: null,
    zellijSession: null,
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
        account: "skiff-app",
        key: "github-skiff-app",
        hosts: ["github.com", "github-work"],
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
    kuma: [
      {
        name: "Silo",
        baseUrl: "http://forge.example.lan:3001",
        statusPage: "perch",
      },
    ],
  },
  joins: [],
  ignore: [],
  thresholds: {
    unsafe: unsafeWindows,
    stalled: dayWindows,
  },
  items: {
    ".dotfiles": entry({
      wire: "Machine & Home",
      name: "Dotfiles",
    }),
    "obsidian/Hothouse": entry({
      wire: "Machine & Home",
      name: "Hothouse Vault",
      roadmaps: ["Tech/Tech Plans.md", "Garden/Garden Plans.md"],
    }),
    "obsidian/Pocket": entry({
      wire: "Machine & Home",
      name: "Pocket Vault",
      roadmaps: ["Code/Code Plans.md", "Pocket Plans.md"],
    }),
    "dev/perch": entry({
      name: "Perch",
      keyFiles: ["README.md", "docs/spec.md", "docs/roadmap.md"],
    }),
    "undev/harbour": entry({ name: "Harbour" }),
    "undev/skiff": entry({ name: "Skiff" }),
    "undev/prism": entry({ name: "Prism" }),
    "undev/Hollow-legacy": entry({ name: "Hollow (legacy)" }),
    "undev/oxbow": entry({ name: "Oxbow" }),
    "undev/gramophone": entry({ name: "Gramophone" }),
    "undev/spool": entry({ name: "Spool" }),
    "undev/glyph-docs": entry({ name: "Glyph Docs" }),
  },
  scan: {
    intervalMinutes: 15,
    finalisedCommits: 10,
  },
  launch: {
    zellijSession: "home",
    zellijSessions: { [`${home}/undev`]: "undev" },
    commands: {
      zellij: ["zellij"],
      terminal: ["alacritty", "-e", "zellij", "attach", "-c", "{session}"],
      vscode: ["code", "{path}"],
      folder: ["dolphin", "{path}"],
      obsidian: ["xdg-open", "obsidian://open?vault={vault}"],
    },
  },
};

// Snapshot builders: shape only, every value is written out per item below.

function repoUrl(forge: ForgeName, fullName: string): string {
  return forge === "github"
    ? `https://github.com/${fullName}`
    : `${forgejoBase}/${fullName}`;
}

function presence(
  forge: ForgeName,
  fullName: string,
  foundBy: ForgePresence["foundBy"] = "local-remote",
): ForgePresence {
  return {
    forge,
    ref: `${forge}:${fullName.toLowerCase()}`,
    fullName,
    url: repoUrl(forge, fullName),
    foundBy,
  };
}

function forge(
  forgeName: ForgeName,
  fullName: string,
  fields: {
    latestCi?: CiRun;
    openPullRequests?: PullRequest[];
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

function roadmap(feature: number, bug: number, paths: string[]): RoadmapData {
  return {
    counts: { bug, feature },
    files: paths.map((path) => ({ path, items: [], groups: [] })),
  };
}

const quietDrift: GitData["drift"] = {
  uncommitted: null,
  unpushed: null,
  level: "green",
  thresholds: unsafeWindows,
};

function localItem(
  id: string,
  fields: {
    kind?: Item["kind"];
    forges: ForgePresence[];
    flags?: Item["flags"];
    sources: Item["sources"];
  },
): Item {
  const path = `${home}/${id}`;
  return {
    id,
    name: id.slice(id.lastIndexOf("/") + 1),
    kind: fields.kind ?? "repo",
    path,
    liveSources: [],
    presences: { local: { ref: `local:${id}`, path }, forges: fields.forges },
    flags: fields.flags ?? [],
    sources: fields.sources,
  };
}

function notSetUp(include: string): Item["flags"] {
  return [
    {
      flag: "not-set-up",
      level: "red",
      detail: `found under ${include} with no entry in config items`,
    },
  ];
}

// The birds

/** Restless: three commits local only for 50 hours, in flight on main. */
const dotfiles = localItem(".dotfiles", {
  forges: [
    presence("github", "finch/dotfiles"),
    presence("forgejo", "finch/dotfiles"),
  ],
  sources: {
    git: {
      backup: "joined",
      branch: "main",
      defaultBranch: "main",
      upstream: "origin/main",
      uncommittedCount: 0,
      ahead: 3,
      behind: 0,
      unpushedCount: 3,
      lastCommitAt: "2026-10-21T22:15:00.000Z",
      oldestUncommittedAt: null,
      oldestUnpushedAt: "2026-10-20T07:00:00.000Z",
      branches: [
        branch(
          "main",
          "2026-10-21T22:15:00.000Z",
          "Open Alacritty at 140 by 40",
        ),
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
      activity: "in-progress",
      drift: {
        uncommitted: null,
        unpushed: {
          since: "2026-10-20T07:00:00.000Z",
          hours: 50,
          level: "amber",
        },
        level: "amber",
        thresholds: unsafeWindows,
      },
      stall: null,
    },
    roadmap: roadmap(13, 0, ["docs/roadmap.md"]),
    claudeSessions: {
      lastSessionAt: "2026-10-21T22:20:00.000Z",
      basis: "last-message",
    },
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

/** Restless and being edited: six changes uncommitted for 30 hours, a full roadmap. */
const hothouse = localItem("obsidian/Hothouse", {
  kind: "vault",
  forges: [presence("forgejo", "finch/Hothouse", "account-listing")],
  sources: {
    git: {
      backup: "joined",
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
      remotes: [
        {
          name: "origin",
          fetchUrl: "ssh://git@forgejo:2222/finch/Hothouse.git",
          pushUrls: ["ssh://git@forgejo:2222/finch/Hothouse.git"],
        },
      ],
      activity: "editing",
      drift: {
        uncommitted: {
          since: "2026-10-21T03:00:00.000Z",
          hours: 30,
          level: "amber",
        },
        unpushed: null,
        level: "amber",
        thresholds: unsafeWindows,
      },
      stall: null,
    },
    roadmap: roadmap(194, 0, ["Tech/Tech Plans.md", "Garden/Garden Plans.md"]),
    claudeSessions: {
      lastSessionAt: "2026-10-20T15:29:37.919Z",
      basis: "last-message",
    },
    forgejo: forge("forgejo", "finch/Hothouse", {
      finalisedCommits: [
        {
          sha: "15e71be9637c4a2e8b0d6f1c3a5e7b9d0f2a4c6e",
          committedAt: "2026-10-20T14:47:25.000Z",
          subject: "Record that the perch repository on Forgejo is public",
        },
      ],
    }),
  },
});

/** Content, settled, with a backlog on offer. */
const pocket = localItem("obsidian/Pocket", {
  kind: "vault",
  forges: [presence("forgejo", "finch/Pocket", "account-listing")],
  sources: {
    git: {
      backup: "joined",
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
          "Describe the vault's LiveSync setup in CLAUDE.md",
        ),
      ],
      remotes: [
        {
          name: "origin",
          fetchUrl: "ssh://git@forgejo:2222/finch/Pocket.git",
          pushUrls: ["ssh://git@forgejo:2222/finch/Pocket.git"],
        },
      ],
      activity: "settled",
      drift: quietDrift,
      stall: null,
    },
    roadmap: roadmap(12, 0, [
      "Code/Code Plans.md",
      "Pocket Plans.md",
    ]),
    claudeSessions: {
      lastSessionAt: "2026-10-16T14:17:56.259Z",
      basis: "last-message",
    },
    forgejo: forge("forgejo", "finch/Pocket", {
      finalisedCommits: [
        {
          sha: "77045f066b56d1e3a5c7e9b1d3f5a7c9e1b3d5f7",
          committedAt: "2026-10-16T14:20:00.000Z",
          subject: "Describe the vault's LiveSync setup in CLAUDE.md",
        },
      ],
    }),
  },
});

/** Content and being edited on a fresh branch; CI passing. */
const perch = localItem("dev/perch", {
  forges: [
    presence("github", "finch/perch"),
    presence("forgejo", "finch/perch"),
  ],
  sources: {
    git: {
      backup: "joined",
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
          "Derive the view model: aviary, birds, bubbles and detail",
        ),
        branch(
          "main",
          "2026-10-21T19:00:00.000Z",
          "Merge foundations: workspace, desktop shell, packaging and CI",
        ),
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
      activity: "editing",
      drift: {
        uncommitted: {
          since: "2026-10-22T07:00:00.000Z",
          hours: 2,
          level: "green",
        },
        unpushed: null,
        level: "green",
        thresholds: unsafeWindows,
      },
      stall: {
        branch: "contracts",
        since: "2026-10-22T06:30:00.000Z",
        days: 0,
        level: "green",
        thresholds: dayWindows,
      },
    },
    roadmap: roadmap(16, 0, ["docs/roadmap.md"]),
    claudeSessions: {
      lastSessionAt: "2026-10-22T08:40:00.000Z",
      basis: "last-message",
    },
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

/** Content and settled on two forges, neither running CI. */
const harbour = localItem("undev/harbour", {
  forges: [
    presence("github", "the-undev/harbour"),
    presence("forgejo", "the-undev/harbour"),
  ],
  sources: {
    git: {
      backup: "joined",
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
      activity: "settled",
      drift: quietDrift,
      stall: null,
    },
    roadmap: roadmap(12, 0, ["docs/roadmap.md"]),
    claudeSessions: {
      lastSessionAt: "2026-10-20T21:09:35.615Z",
      basis: "last-message",
    },
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
          sha: "f1cf131eda8f4a6e4beda1f0a80dd3564680de86",
          committedAt: "2026-10-20T21:00:02Z",
          subject: "Merge branch 'plan-move-on'",
        },
      ],
    }),
  },
});

/** Restless: parked on a feature branch for three weeks with everything pushed. */
const skiff = localItem("undev/skiff", {
  forges: [presence("github", "skiff-app/skiff")],
  sources: {
    git: {
      backup: "joined",
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
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github-work:skiff-app/skiff.git",
          pushUrls: ["git@github-work:skiff-app/skiff.git"],
        },
      ],
      activity: "in-progress",
      drift: quietDrift,
      stall: {
        branch: "extension-popup-ia",
        since: "2026-10-01T09:00:00.000Z",
        days: 21,
        level: "amber",
        thresholds: dayWindows,
      },
    },
    roadmap: roadmap(12, 0, ["docs/roadmap.md"]),
    claudeSessions: {
      lastSessionAt: "2026-10-01T09:12:00.000Z",
      basis: "last-message",
    },
    github: forge("github", "skiff-app/skiff", {
      latestCi: {
        name: "CI",
        state: "success",
        forgeState: "completed/success",
        url: "https://github.com/skiff-app/skiff/actions/runs/33371828042",
        createdAt: "2026-08-31T08:12:44Z",
      },
      openPullRequests: [
        {
          number: 41,
          title: "Extension popup IA",
          author: "finch",
          draft: true,
          updatedAt: "2026-10-01T09:05:00Z",
          url: "https://github.com/skiff-app/skiff/pull/41",
        },
        {
          number: 40,
          title: "Wait for the popup close a retry causes",
          author: "finch",
          draft: false,
          updatedAt: "2026-08-31T10:25:00Z",
          url: "https://github.com/skiff-app/skiff/pull/40",
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

/** Distressed: CI failing on Forgejo, four changes uncommitted for 60 hours, GitHub unreadable. */
const prism = localItem("undev/prism", {
  forges: [
    presence("github", "the-undev/prism"),
    presence("forgejo", "the-undev/prism"),
  ],
  sources: {
    git: {
      backup: "joined",
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
      activity: "editing",
      drift: {
        uncommitted: {
          since: "2026-10-19T21:00:00.000Z",
          hours: 60,
          level: "amber",
        },
        unpushed: null,
        level: "amber",
        thresholds: unsafeWindows,
      },
      stall: null,
    },
    roadmap: roadmap(78, 0, ["docs/roadmap.md"]),
    claudeSessions: {
      lastSessionAt: "2026-10-17T09:43:52.559Z",
      basis: "last-message",
    },
    github: {
      error:
        "HTTP 404 from https://api.github.com/repos/the-undev/prism/pulls?state=open&per_page=100",
    },
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

/** Distressed: two bugs open on the roadmap. */
const hollow = localItem("undev/Hollow-legacy", {
  forges: [presence("github", "the-undev/Hollow")],
  sources: {
    git: {
      backup: "joined",
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
      remotes: [
        {
          name: "origin",
          fetchUrl: "git@github-work:the-undev/Hollow.git",
          pushUrls: ["git@github-work:the-undev/Hollow.git"],
        },
      ],
      activity: "settled",
      drift: quietDrift,
      stall: null,
    },
    roadmap: roadmap(7, 2, ["docs/roadmap.md"]),
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

/** Content and settled on two forges, neither running CI, with a long backlog. */
const oxbow = localItem("undev/oxbow", {
  forges: [
    presence("github", "the-undev/oxbow"),
    presence("forgejo", "the-undev/oxbow"),
  ],
  sources: {
    git: {
      backup: "joined",
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
      activity: "settled",
      drift: quietDrift,
      stall: null,
    },
    roadmap: roadmap(96, 0, ["docs/roadmap.md"]),
    claudeSessions: {
      lastSessionAt: "2026-10-09T21:06:32.977Z",
      basis: "last-message",
    },
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
const gramophone = localItem("undev/gramophone", {
  forges: [presence("forgejo", "the-undev/gramophone")],
  sources: {
    git: {
      backup: "joined",
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
      remotes: [
        {
          name: "origin",
          fetchUrl: "forge-work:the-undev/gramophone.git",
          pushUrls: ["forge-work:the-undev/gramophone.git"],
        },
      ],
      activity: "editing",
      drift: {
        uncommitted: {
          since: "2026-10-17T06:00:00.000Z",
          hours: 123,
          level: "red",
        },
        unpushed: null,
        level: "red",
        thresholds: unsafeWindows,
      },
      stall: null,
    },
    roadmap: roadmap(3, 0, ["docs/roadmap.md"]),
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

/** Content and settled with every count a clean zero. */
const spool = localItem("undev/spool", {
  forges: [presence("forgejo", "the-undev/spool")],
  sources: {
    git: {
      backup: "joined",
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
      remotes: [
        {
          name: "origin",
          fetchUrl: "forge-work:the-undev/spool.git",
          pushUrls: ["forge-work:the-undev/spool.git"],
        },
      ],
      activity: "settled",
      drift: quietDrift,
      stall: null,
    },
    roadmap: roadmap(0, 0, ["docs/roadmap.md"]),
    claudeSessions: {
      lastSessionAt: "2026-10-20T23:05:00.000Z",
      basis: "last-message",
    },
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

/** Content and in flight on a branch with one fresh commit not yet pushed. */
const glyphDocs = localItem("undev/glyph-docs", {
  kind: "vault",
  forges: [presence("forgejo", "the-undev/glyph-docs")],
  sources: {
    git: {
      backup: "joined",
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
      remotes: [
        {
          name: "origin",
          fetchUrl: "forge-work:the-undev/glyph-docs.git",
          pushUrls: ["forge-work:the-undev/glyph-docs.git"],
        },
      ],
      activity: "in-progress",
      drift: {
        uncommitted: null,
        unpushed: {
          since: "2026-10-22T04:00:00.000Z",
          hours: 5,
          level: "green",
        },
        level: "green",
        thresholds: unsafeWindows,
      },
      stall: {
        branch: "render-scale-fix",
        since: "2026-10-22T04:00:00.000Z",
        days: 0,
        level: "green",
        thresholds: dayWindows,
      },
    },
    roadmap: roadmap(11, 0, ["Roadmap.md"]),
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

/** Found under an include directory, joined to two forges, not yet decided. */
const homeItConfig = localItem("dev/hearth-config", {
  forges: [
    presence("github", "finch/hearth-config"),
    presence("forgejo", "finch/hearth-config"),
  ],
  flags: notSetUp(`${home}/dev`),
  sources: {
    git: {
      backup: "joined",
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
      activity: "settled",
      drift: quietDrift,
      stall: null,
    },
    roadmap: roadmap(0, 0, []),
    github: forge("github", "finch/hearth-config", {
      finalisedCommits: [],
    }),
    forgejo: forge("forgejo", "finch/hearth-config", {
      finalisedCommits: [],
    }),
  },
});

/** Found with no remote at all: one disk only. */
const hello = localItem("dev/odin/hello", {
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
      remotes: [],
      activity: "settled",
      drift: quietDrift,
      stall: null,
    },
    roadmap: roadmap(0, 0, []),
  },
});

/** On a forge, never cloned here. */
const obsidianTidy: Item = {
  id: "github:finch/obsidian-tidy",
  name: "obsidian-tidy",
  kind: "repo",
  path: null,
  liveSources: [],
  presences: {
    local: null,
    forges: [presence("github", "finch/obsidian-tidy", "account-listing")],
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

/** The server item, which waits for server monitoring and is not a bird. */
const server: Item = {
  id: "server:Silo",
  name: "Silo",
  kind: "server",
  path: null,
  liveSources: ["dockerContainers"],
  presences: { local: null, forges: [] },
  flags: [],
  sources: {},
};

const items: Item[] = [
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
  server,
];

function listing(forgeName: ForgeName): Snapshot["forges"][ForgeName] {
  return {
    active: items.flatMap((item) =>
      item.presences.forges
        .filter((entry) => entry.forge === forgeName)
        .map((entry) => ({
          ref: entry.ref,
          fullName: entry.fullName,
          url: entry.url,
          itemId: item.id,
          ignored: false,
        })),
    ),
    archived:
      forgeName === "github"
        ? [
            {
              ref: "github:finch/antler",
              fullName: "finch/antler",
              url: "https://github.com/finch/antler",
              itemId: null,
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
    kuma: ok(90),
    roadmap: ok(60),
    claudeSessions: ok(130),
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
    githubCard("skiff-app", 1),
    forgejoCard("finch"),
    forgejoCard("the-undev"),
    // The raw kuma file holds nothing for Silo yet, which is why its item has no kuma data.
    {
      id: "kuma:Silo",
      kind: "kuma",
      label: "Silo",
      result: { state: "never-scanned" },
    },
  ],
  items,
};

/** The view model of the mock pair: every component state the design site renders. */
export const mockAviary: Aviary = deriveAviary(
  mockSnapshot,
  mockConfig,
  mockHome,
);
