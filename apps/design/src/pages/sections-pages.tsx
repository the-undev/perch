// The ledger's sections, one usage page each: branches, the commit river, pull requests, flags
// and sources not read.

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
    rule: "Oxbow: here and both forges hold every commit, so every mark is filled and no sentence is drawn.",
  },
  {
    id: ".dotfiles",
    label: "Unpushed on main",
    rule: "Dotfiles: three commits on main that neither forge has. Their forge marks are hollow; the forges agree, so no sentence.",
  },
  {
    id: "undev/harbour",
    label: "Diverged",
    rule: "Harbour: Forgejo missed the last push. Its mark is hollow and one amber sentence says it is behind GitHub.",
  },
  {
    id: "dev/perch",
    label: "Beyond a list",
    rule: "Perch: Forgejo's list holds one commit, so the two older ones are beyond it. Their Forgejo reach is unknown, drawn as the faint dot, never hollow.",
  },
  {
    id: "undev/spool",
    label: "One forge",
    rule: "Spool: here and Forgejo, in step.",
  },
  {
    id: "dev/odin/hello",
    label: "Only here",
    rule: "hello: no remote, so the clone is the one place.",
  },
  {
    id: "undev/prism",
    label: "A place not read",
    rule: "Prism: GitHub answered 404. Its name says not read in amber and every GitHub mark is unknown.",
  },
];

export function RiverPage() {
  return (
    <>
      <Section
        title="The commit river"
        rule="The newest commits on the default branch, each once, joined by hash across local main and each forge's list, newest first and capped at scan.finalised_commits. Each commit has a mark per place, here first and then the bird's forges: filled where the place holds it, hollow where it lacks it, a faint dot where its reach is unknown. A place's list is its newest commits, so a commit is lacking only when it is no older than the list's oldest; an older one is unknown. One amber sentence appears only when a forge lacks a commit another forge holds."
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
            what: "bird.detail.river: the places, the commits with their reach per place, and the divergence sentence or null.",
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
        <Specimen label="Several" rule="Skiff: two open on GitHub.">
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
        title="Sources not read"
        rule="A failing source keeps its previous result and shows the error. The row names the source and its error; the value is amber."
        min={420}
      >
        <Specimen
          label="A forge call failed"
          rule="Prism: GitHub answered 404 for its pull requests."
        >
          <Ground>
            <SourceProblems
              problems={mockBird("undev/prism").detail.problems}
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
