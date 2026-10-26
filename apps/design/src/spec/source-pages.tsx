// One page per data source: what it reads, the raw types it writes, and what the aggregate
// derives from them, each declaration excerpted from the repository and a mock value beside.

import { mockSnapshot } from "@perch/core/mock.ts";
import type { ItemSources } from "@perch/core/snapshot.ts";
import type { ReactNode } from "react";
import { Code } from "../usage.tsx";
import { type CoreFile, roundOf } from "./code.ts";
import { Declarations, MockValue, Part, Prose, Signatures } from "./parts.tsx";

interface SourceSpec {
  /** The polled sources this page covers, by the name gather.ts gives them. */
  polled: string[];
  /** What the source reads, and how. */
  reads: ReactNode;
  /** The modules that read it, and the functions in each that do the reading. */
  moduleNames: { file: CoreFile; names: string[] }[];
  rawTypes: string[];
  /** What the aggregate makes of it. */
  derives: ReactNode;
  derivations: string[];
  snapshotTypes: string[];
  /** One item's derived data for this source in the mock snapshot. */
  example: { itemId: string; source: keyof ItemSources };
}

function roundWords(source: string): string {
  const round = roundOf(source);
  return `${source}: round ${round}, ${round === 1 ? "a root collector" : "an enricher"}, written to .scan/raw/${source}.json`;
}

function mockSourceData(itemId: string, source: keyof ItemSources): unknown {
  const item = mockSnapshot.items.find((candidate) => candidate.id === itemId);
  if (item === undefined) throw new Error(`the mock has no item ${itemId}`);
  return item.sources[source] ?? null;
}

function SourcePage({ spec }: { spec: SourceSpec }) {
  return (
    <>
      <Part title="What it reads">
        <Prose>
          {spec.reads}
          <ul className="m-0 list-disc pl-5">
            {spec.polled.map((source) => (
              <li key={source}>
                <Code>{roundWords(source)}</Code>
              </li>
            ))}
          </ul>
        </Prose>
        {spec.moduleNames.map(({ file, names }) => (
          <Signatures key={file} file={file} names={names} />
        ))}
      </Part>
      <Part title="The raw types">
        <Prose>
          <p>
            As declared in <Code>packages/core/src/raw.ts</Code>: observed
            facts, nothing judged, every missing value with its reason.
          </p>
        </Prose>
        <Declarations file="src/raw.ts" names={spec.rawTypes} />
      </Part>
      <Part title="What the aggregate derives">
        <Prose>{spec.derives}</Prose>
        <Signatures file="src/derivations.ts" names={spec.derivations} />
        <Declarations file="src/snapshot.ts" names={spec.snapshotTypes} />
      </Part>
      <Part title="In the mock snapshot">
        <Prose>
          <p>
            <Code>{spec.example.itemId}</Code>&apos;s{" "}
            <Code>sources.{spec.example.source}</Code>, from{" "}
            <Code>packages/core/src/mock.ts</Code>.
          </p>
        </Prose>
        <MockValue
          title={`items["${spec.example.itemId}"].sources.${spec.example.source}`}
          value={mockSourceData(spec.example.itemId, spec.example.source)}
        />
      </Part>
    </>
  );
}

const localGit: SourceSpec = {
  polled: ["local"],
  reads: (
    <p>
      Every include path in config: a repository itself, or a directory searched
      up to five levels deep for <Code>.git</Code>, never entering an ignore
      path, a hidden directory or <Code>node_modules</Code>. For each clone it
      runs read-only git: <Code>status --porcelain=v2</Code>,{" "}
      <Code>for-each-ref</Code> over the local branches with their upstream
      tracking, <Code>remote -v</Code>, where <Code>origin/HEAD</Code> points,
      <Code>log --branches --not --remotes</Code> for the commits no remote
      holds, and <Code>log</Code> on the default branch for its newest commits,
      as many as <Code>scan.finalised_commits</Code>. It stats each dirty file
      for its mtime and checks for <Code>.obsidian/</Code> and the LiveSync
      plugin.
    </p>
  ),
  moduleNames: [
    { file: "src/sources/local.ts", names: ["createLocalSource"] },
    { file: "src/sources/git.ts", names: ["readRepository"] },
  ],
  rawTypes: [
    "RawLocal",
    "RawLocalPresence",
    "RawObsidian",
    "IncludeKind",
    "RawGit",
    "RawCommit",
    "RawBranch",
    "Tracking",
    "RawDirtyFile",
    "RawRemote",
  ],
  derives: (
    <p>
      Joining comes first: each clone is a presence, and its remote URLs join it
      to forge presences (<Code>joinPresences</Code> in <Code>src/join.ts</Code>
      ). Then git data per item: the default branch, the work-state, unsafe work
      aged in hours from its oldest change, and stalled flight aged in days. A
      missing include path becomes a scene-wide warning.
    </p>
  ),
  derivations: [
    "deriveGit",
    "chooseDefaultBranch",
    "deriveActivity",
    "deriveDrift",
    "deriveStall",
  ],
  snapshotTypes: [
    "GitData",
    "Backup",
    "ActivityState",
    "Drift",
    "AgedWork",
    "Stall",
    "LocalBranch",
    "Remote",
  ],
  example: { itemId: "dev/perch", source: "git" },
};

const forgeRawTypes = [
  "RawForgeAccount",
  "RawForgeRepoInfo",
  "RawForgeRepo",
  "RawForgeDetails",
  "RawPullRequest",
  "RawCi",
];

const forgeSnapshotTypes = [
  "ForgeData",
  "CiRun",
  "CiState",
  "PullRequest",
  "FinalisedCommit",
  "ForgePresence",
  "ForgeListing",
];

const forgeDerives = (
  <p>
    Each forge repository is a presence, joined to clones by their remote URLs
    and to other presences by config&apos;s <Code>joins</Code>. Its details
    become the item&apos;s forge data: open pull requests, the latest CI in
    perch&apos;s own four states, and the finalised commits. Archived
    repositories go to the forge&apos;s listing only, never the main view.
  </p>
);

const github: SourceSpec = {
  polled: ["githubAccounts", "github"],
  reads: (
    <p>
      The REST API at <Code>api.github.com</Code>, each{" "}
      <Code>[[sources.github]]</Code> account with its own fine-grained
      read-only token from the keyring. First the accounts&apos; own
      repositories (<Code>/user/repos</Code>), untracked forks left out by name.
      Then, for every listed repository and any that a local remote names on a
      GitHub host the listings missed: open pull requests, the latest workflow
      run on the default branch, and its newest commits, as many as{" "}
      <Code>scan.finalised_commits</Code>. Archived repositories keep their info
      and skip the details.
    </p>
  ),
  moduleNames: [
    {
      file: "src/sources/forge.ts",
      names: ["createForgeAccountsSource", "createForgeSource"],
    },
    { file: "src/sources/github.ts", names: ["createGithubClient"] },
  ],
  rawTypes: [...forgeRawTypes, "RawGithubRun"],
  derives: forgeDerives,
  derivations: ["deriveForge", "githubCiState"],
  snapshotTypes: forgeSnapshotTypes,
  example: { itemId: "dev/perch", source: "github" },
};

const forgejo: SourceSpec = {
  polled: ["forgejoAccounts", "forgejo"],
  reads: (
    <p>
      The v1 API at each <Code>[[sources.forgejo]]</Code> account&apos;s{" "}
      <Code>base_url</Code>, with its own read-only token from the keyring. The
      same two rounds as GitHub: the accounts&apos; own repositories, then pull
      requests, CI and finalised commits for each. CI is the default branch
      head&apos;s combined commit status, since Forgejo&apos;s Actions API
      cannot filter runs by branch.
    </p>
  ),
  moduleNames: [
    { file: "src/sources/forgejo.ts", names: ["createForgejoClient"] },
  ],
  rawTypes: [...forgeRawTypes, "RawCommitStatus"],
  derives: forgeDerives,
  derivations: ["deriveForge", "forgejoCiState"],
  snapshotTypes: forgeSnapshotTypes,
  example: { itemId: "undev/prism", source: "forgejo" },
};

const roadmaps: SourceSpec = {
  polled: ["roadmap"],
  reads: (
    <p>
      For every local presence, the roadmap files its config entry names in{" "}
      <Code>roadmaps</Code>, else the first of the standard names that exists.
      The entry is resolved through the project the clone joins, so it runs
      after the forge enrichers. Each file is parsed into its headings, the
      bullets directly under each, and the prose between.
    </p>
  ),
  moduleNames: [
    {
      file: "src/sources/roadmap.ts",
      names: ["createRoadmapSource"],
    },
  ],
  rawTypes: [
    "RawRoadmap",
    "RawRoadmapFile",
    "RoadmapStructure",
    "RawSection",
    "RawBullet",
    "RawHeadingRef",
  ],
  derives: (
    <p>
      Work items by the per-heading rule, bugs marked by their heading or a{" "}
      <Code>#bug</Code> tag, and the open items counted by kind. The counts feed
      the bird&apos;s plumpness, its chips and its ledger; open bugs turn it
      red.
    </p>
  ),
  derivations: [
    "deriveRoadmap",
    "deriveRoadmapFile",
    "countOpenItems",
    "mentionsBugs",
  ],
  snapshotTypes: [
    "RoadmapData",
    "RoadmapFile",
    "WorkItemGroup",
    "WorkItem",
    "WorkItemCounts",
  ],
  example: { itemId: "undev/Hollow-legacy", source: "roadmap" },
};

const claude: SourceSpec = {
  polled: ["claudeSessions"],
  reads: (
    <p>
      For every local presence, its directory under{" "}
      <Code>~/.claude/projects/</Code>, named by encoding the clone&apos;s path.
      It lists the transcripts with their mtimes and reads the newest one
      backwards from its end for the timestamp of the last user or assistant
      line.
    </p>
  ),
  moduleNames: [
    {
      file: "src/sources/claude-sessions.ts",
      names: ["encodeProjectPath", "readLastMessageAt"],
    },
  ],
  rawTypes: ["RawClaudeSessions", "RawTranscript", "RawNewestTranscript"],
  derives: (
    <p>
      One time per item: the newest transcript&apos;s last message, else its
      mtime. The detail&apos;s ledger shows it as the last Claude session.
    </p>
  ),
  derivations: ["deriveClaudeSessions"],
  snapshotTypes: ["ClaudeSessionsData"],
  example: { itemId: "dev/perch", source: "claudeSessions" },
};

const kuma: SourceSpec = {
  polled: ["kuma"],
  reads: (
    <p>
      Each <Code>[[sources.kuma]]</Code> table&apos;s Uptime Kuma status page,{" "}
      <Code>status_page</Code> at <Code>base_url</Code>: its monitor groups and
      their heartbeats, keyed by the table&apos;s <Code>name</Code>. The gather
      reads them on every scan, and the aggregate puts each on the server item
      that name gives. The view model leaves the server off the scene until
      server monitoring is picked up, so nothing it reads is shown; see the
      roadmap&apos;s Server monitoring.
    </p>
  ),
  moduleNames: [{ file: "src/sources/kuma.ts", names: ["createKumaSource"] }],
  rawTypes: ["RawKuma", "RawMonitor", "RawHeartbeat"],
  derives: (
    <p>
      Each monitor&apos;s status from its newest heartbeat, and whether the
      server is all up: at least one monitor, every one of them up.
    </p>
  ),
  derivations: ["deriveKuma"],
  snapshotTypes: ["KumaData", "Monitor", "MonitorStatus"],
  example: { itemId: "server:Silo", source: "kuma" },
};

export function LocalGitPage() {
  return <SourcePage spec={localGit} />;
}

export function GithubPage() {
  return <SourcePage spec={github} />;
}

export function ForgejoPage() {
  return <SourcePage spec={forgejo} />;
}

export function RoadmapsPage() {
  return <SourcePage spec={roadmaps} />;
}

export function ClaudeSessionsPage() {
  return <SourcePage spec={claude} />;
}

export function KumaPage() {
  return <SourcePage spec={kuma} />;
}
