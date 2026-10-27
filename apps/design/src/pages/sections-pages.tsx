// The ledger's sections, one usage page each: branches, the commit river, pull requests, flags
// and what couldn't be read.

import type { FlagLine } from "@perch/core/viewmodel.ts";
import {
  BranchLines,
  CommitRiver,
  FlagLines,
  PullRequestLines,
  SourceProblems,
} from "@perch/ui/ledger.tsx";
import { mockBird, scanMoment } from "../specimens.ts";
import { Code, Ground, Section, Specimen, Usage } from "../usage.tsx";

export function BranchesPage() {
  return (
    <>
      <Section
        title="Branches"
        rule="Every local branch, the checked-out one first, then by newest commit. A branch links to its forge page when its upstream matches a forge presence."
        min={380}
      >
        <Specimen
          label="Out on a feature branch"
          rule="Perch: contracts is checked out; main is the default."
        >
          <Ground>
            <BranchLines
              branches={mockBird("dev/perch").detail.branches}
              now={scanMoment}
            />
          </Ground>
        </Specimen>
        <Specimen
          label="Stalled flight"
          rule="Skiff: parked on extension-popup-ia for three weeks."
        >
          <Ground>
            <BranchLines
              branches={mockBird("undev/skiff").detail.branches}
              now={scanMoment}
            />
          </Ground>
        </Specimen>
        <Specimen
          label="On the default branch"
          rule="Spool: one branch, checked out and default."
        >
          <Ground>
            <BranchLines
              branches={mockBird("undev/spool").detail.branches}
              now={scanMoment}
            />
          </Ground>
        </Specimen>
      </Section>
      <Usage
        component="<BranchLines>"
        props={[
          {
            name: "branches",
            type: "BranchLine[]",
            what: "bird.detail.branches.",
          },
          {
            name: "now",
            type: "Date",
            what: "The moment the newest-commit times are measured to.",
          },
        ]}
      >
        <p>
          Draw it only when the bird has branches: a forge-only bird has none.
        </p>
      </Usage>
    </>
  );
}

/** The river's states, each from a mock bird and the rule that draws it. */
const riverSpecimens: { id: string; label: string; rule: string }[] = [
  {
    id: "undev/oxbow",
    label: "In step",
    rule: "Oxbow: both forges hold every commit, so every dot is green and no sentence is drawn.",
  },
  {
    id: ".dotfiles",
    label: "Unpushed on main",
    rule: "Dotfiles: three commits on main that no forge holds are amber, not pushed to a remote. The forges agree, so no sentence.",
  },
  {
    id: "undev/harbour",
    label: "Diverged",
    rule: "Harbour: Forgejo missed the last push. That commit is amber, only on github, and one amber sentence says Forgejo is behind.",
  },
  {
    id: "dev/perch",
    label: "Beyond a list",
    rule: "Perch: Forgejo's list holds one commit, so the two older ones are beyond it. A forge counts as holding a commit older than its list, so they stay green.",
  },
  {
    id: "undev/spool",
    label: "One forge",
    rule: "Spool: Forgejo holds every commit, green.",
  },
  {
    id: "undev/prism",
    label: "A forge's commits read, its pull requests not",
    rule: "Prism: GitHub answered 404 for its pull requests but its commits were read, so the dot is judged over both forges and no line appears.",
  },
  {
    id: "undev/skiff",
    label: "A remote no card can read",
    rule: "Skiff: no card covers skiff-app, so GitHub's line says couldn't read github with the short why. Forgejo was read, so the dot is judged over it alone.",
  },
  {
    id: "dev/hearth-config",
    label: "No remote could be read",
    rule: "hearth-config: neither forge's detail could be read, so each gets an amber line, and every commit's dot is amber: no remote could be read.",
  },
  {
    id: "dev/odin/hello",
    label: "No remote",
    rule: "hello: no remote, so the quiet dot.",
  },
];

export function RiverPage() {
  return (
    <>
      <Section
        title="The commit river"
        rule="The newest commits on the default branch, each once, joined by hash across local main and each forge's list, newest first and capped at scan.finalised_commits; the heading names the branch. One dot before each says how far it has spread over the forges read: green when every one holds it, amber when one lacks it or none does, amber too when the bird has forges and none could be read, and the quiet dot only for a bird with no forge. A forge lacks a commit only when it is no older than the forge's oldest listed commit; an older one counts as held. The clone only adds commits. A forge whose commits couldn't be read gets an amber line, with the short why when no card covers it, and one amber sentence appears only when a forge lacks a commit another forge holds."
        min={420}
      >
        {riverSpecimens.map((specimen) => (
          <Specimen
            key={specimen.id}
            label={specimen.label}
            rule={specimen.rule}
          >
            <Ground>
              <CommitRiver
                river={mockBird(specimen.id).detail.river}
                now={scanMoment}
              />
            </Ground>
          </Specimen>
        ))}
      </Section>
      <Usage
        component="<CommitRiver>"
        props={[
          {
            name: "river",
            type: "River",
            what: "bird.detail.river: the branch it judges, the commits with their tone and spoken spread, a note per forge that couldn't be read, and the divergence sentence or null.",
          },
          {
            name: "now",
            type: "Date",
            what: "The moment commit times are measured to.",
          },
        ]}
      >
        <p>
          Draw it only when the river has commits. A commit links to the first
          forge holding it; one only here is not linked.
        </p>
      </Usage>
    </>
  );
}

export function PullRequestsPage() {
  return (
    <>
      <Section
        title="Open pull requests"
        rule="Open pull requests across every forge, the most recently updated first, with the number, forge, author and draft state."
        min={420}
      >
        <Specimen label="A draft" rule="Perch: one draft on GitHub.">
          <Ground>
            <PullRequestLines
              pullRequests={mockBird("dev/perch").detail.pullRequests}
              now={scanMoment}
            />
          </Ground>
        </Specimen>
        <Specimen label="Several" rule="Skiff: two open on Forgejo.">
          <Ground>
            <PullRequestLines
              pullRequests={mockBird("undev/skiff").detail.pullRequests}
              now={scanMoment}
            />
          </Ground>
        </Specimen>
      </Section>
      <Usage
        component="<PullRequestLines>"
        props={[
          {
            name: "pullRequests",
            type: "PullRequestLine[]",
            what: "bird.detail.pullRequests.",
          },
          {
            name: "now",
            type: "Date",
            what: "The moment update times are measured to.",
          },
        ]}
      >
        <p>Draw it only when there are open pull requests.</p>
      </Usage>
    </>
  );
}

/** Flags the mock lacks: every other flag the scan can raise, at each level. */
const handBuiltFlags: FlagLine[] = [
  {
    flag: "remote-archived",
    text: "remote archived",
    detail: "github:finch/antler is archived on GitHub",
    level: "amber",
  },
  {
    flag: "remote-joined-elsewhere",
    text: "remote joined elsewhere",
    detail: "forgejo:finch/perch is joined to dev/perch-old",
    level: null,
  },
  {
    flag: "config-conflict",
    text: "config conflict",
    detail:
      "config joins undev/harbour to github:the-undev/skiff; the remote says otherwise",
    level: "red",
  },
];

export function FlagsPage() {
  return (
    <>
      <Section
        title="Flags"
        rule="Facts the scan raised about the bird itself, the detail on the left and the flag on the right, toned by its level. Flags are not health inputs."
        min={420}
      >
        <Specimen
          label="Not set up"
          rule="hello: found under an include path with no entry in config items."
        >
          <Ground>
            <FlagLines flags={mockBird("dev/odin/hello").detail.flags} />
          </Ground>
        </Specimen>
        <Specimen
          label="Every other flag"
          rule="Hand-built: the mock raises only not set up."
        >
          <Ground>
            <FlagLines flags={handBuiltFlags} />
          </Ground>
        </Specimen>
      </Section>
      <Usage
        component="<FlagLines>"
        props={[
          { name: "flags", type: "FlagLine[]", what: "bird.detail.flags." },
        ]}
      >
        <p>Draw it only when there are flags.</p>
      </Usage>
    </>
  );
}

export function ProblemsPage() {
  return (
    <>
      <Section
        title="What couldn't be read"
        rule="A failing source keeps its previous result and shows the error. The row names the source and its error; the value, couldn't read, is amber."
        min={420}
      >
        <Specimen
          label="A forge call failed"
          rule="Prism: GitHub answered 404 for its pull requests, so the row names that part alone."
        >
          <Ground>
            <SourceProblems
              problems={mockBird("undev/prism").detail.problems}
            />
          </Ground>
        </Specimen>
        <Specimen
          label="No card covers the owner"
          rule="Skiff: the scanner's full sentence for the config gap the notice under the heading also names."
        >
          <Ground>
            <SourceProblems
              problems={mockBird("undev/skiff").detail.problems}
            />
          </Ground>
        </Specimen>
      </Section>
      <Usage
        component="<SourceProblems>"
        props={[
          {
            name: "problems",
            type: "SourceProblem[]",
            what: "bird.detail.problems.",
          },
        ]}
      >
        <p>
          Per-bird problems only. Scene-wide failures (
          <Code>aviary.sourceErrors</Code>) belong to the aviary scene.
        </p>
      </Usage>
    </>
  );
}
