import type { Chip as ChipModel } from "@perch/core/viewmodel.ts";
import { Chip } from "@perch/ui/chip.tsx";
import { mockBirds } from "../specimens.ts";
import { Code, Section, Specimen, Usage } from "../usage.tsx";

/** Every distinct chip the mock carries, plus the CI state it lacks. */
const chips: ChipModel[] = [
  ...new Map(
    mockBirds
      .flatMap((bird) => bird.bubble.chips)
      .map((chip) => [`${chip.label}|${chip.severity}`, chip]),
  ).values(),
  { kind: "ci", label: "ci neutral", count: null, severity: null },
];

const ofSeverity = (severity: ChipModel["severity"]) =>
  chips.filter((chip) => chip.severity === severity);

const kindRule: Record<ChipModel["kind"], string> = {
  unreadable:
    "A forge the clone pushes to that no card can read, named by forge. Always amber; it lands on the record's notice.",
  ci: "The worst CI state across forges on the default branch; red only when failing.",
  bugs: "A roadmap file's open bugs, one chip per file with any: plain within the bug window, then amber, then red. The path is named only when the record has several roadmap files.",
  "critical-bugs":
    "A roadmap file's open critical bugs, a chip of their own beside its bugs: plain within the critical bug window, then amber, then red.",
  uncommitted:
    "Uncommitted changes, toned by their age: unjudged under 24 hours, amber to 72, red beyond.",
  unpushed: "Commits on no remote, toned by their age like uncommitted work.",
  stalled:
    "The days the checkout has been parked on a branch other than the default, past the stall window: amber, then red. It lands on the branches section.",
  "pull-requests": "Open pull requests across forges. Not judged.",
  "open-items": "Open roadmap items. Not judged: plumpness carries the volume.",
};

function ChipRow({ list }: { list: ChipModel[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl bg-paper p-4">
      {list.map((chip) => (
        <Chip key={`${chip.label}|${chip.severity}`} chip={chip} />
      ))}
    </div>
  );
}

export function ChipPage() {
  const kinds = [...new Set(chips.map((chip) => chip.kind))];
  return (
    <>
      <Section
        title="Severity"
        rule="A chip's severity is its fact's amber or red, else none. Chips are real data, not inference; the bubble's speech gives the feeling, the chips the numbers."
        min={320}
      >
        <Specimen
          label="not judged"
          rule="Plain paper: counts and states that carry no judgement."
        >
          <ChipRow list={ofSeverity(null)} />
        </Specimen>
        <Specimen
          label="amber"
          rule="A fact past its amber window, or a remote no card can read."
        >
          <ChipRow list={ofSeverity("amber")} />
        </Specimen>
        <Specimen label="red" rule="A fact past its red window, or failing CI.">
          <ChipRow list={ofSeverity("red")} />
        </Specimen>
      </Section>

      <Section
        title="Kinds"
        rule="Chips run in this order on a bubble: can't read, CI, bugs, uncommitted, unpushed, parked, open pull requests, open items."
        min={320}
      >
        {kinds.map((kind) => (
          <Specimen key={kind} label={kind} rule={kindRule[kind]}>
            <ChipRow list={chips.filter((chip) => chip.kind === kind)} />
          </Specimen>
        ))}
      </Section>

      <Usage
        component="<Chip> and <ChipHandles>"
        props={[
          {
            name: "chip",
            type: "Chip",
            what: "Chip: one of bird.bubble.chips: kind, label, count, severity.",
          },
          {
            name: "chips",
            type: "Chip[]",
            what: "ChipHandles: the whole row; draws nothing when empty.",
          },
          {
            name: "onPress",
            type: "(chip: ChipKind) => void",
            what: "ChipHandles: a chip was pressed; the bird's page lands on the ledger row holding its working, or the record's notice for can't read, riding there first from the aviary.",
          },
        ]}
      >
        <p>
          The label already holds the number in words the view model chose (
          <Code>3 unpushed</Code>, <Code>1 open PR</Code>). The chip only picks
          the paper tone from the severity. The CI neutral chip is hand-built:
          the mock&apos;s CI runs succeed, fail or wait.
        </p>
        <p>
          Both bubbles draw <Code>{"<ChipHandles>"}</Code>: the same paper as
          buttons, each landing on the ledger row holding its working. From the
          aviary the camera first rides to the bird&apos;s page.
        </p>
      </Usage>
    </>
  );
}
