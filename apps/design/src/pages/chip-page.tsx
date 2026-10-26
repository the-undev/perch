import type { Chip as ChipModel } from "@perch/core/viewmodel.ts";
import { Chip } from "@perch/ui/chip.tsx";
import { mockBirds } from "../specimens.ts";
import { Code, Section, Specimen, Usage } from "../usage.tsx";

/** Every distinct chip the mock carries, plus the CI states it lacks. */
const chips: ChipModel[] = [
  ...new Map(
    mockBirds
      .flatMap((bird) => bird.bubble.chips)
      .map((chip) => [`${chip.label}|${chip.severity}`, chip]),
  ).values(),
  { kind: "ci", label: "ci pending", count: null, severity: null },
  { kind: "ci", label: "ci neutral", count: null, severity: null },
];

const ofSeverity = (severity: ChipModel["severity"]) =>
  chips.filter((chip) => chip.severity === severity);

const kindRule: Record<ChipModel["kind"], string> = {
  ci: "The worst CI state across forges on the default branch; red only when failing.",
  bugs: "Open bugs on the roadmap. Always red.",
  uncommitted:
    "Uncommitted changes, toned by their age: unjudged under 24 hours, amber to 72, red beyond.",
  unpushed: "Commits on no remote, toned by their age like uncommitted work.",
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
        <Specimen label="amber" rule="A fact past its amber window.">
          <ChipRow list={ofSeverity("amber")} />
        </Specimen>
        <Specimen
          label="red"
          rule="A fact past its red window, failing CI, or bugs."
        >
          <ChipRow list={ofSeverity("red")} />
        </Specimen>
      </Section>

      <Section
        title="Kinds"
        rule="Chips run in this order on a bubble: CI, bugs, uncommitted, unpushed, open pull requests, open items."
        min={320}
      >
        {kinds.map((kind) => (
          <Specimen key={kind} label={kind} rule={kindRule[kind]}>
            <ChipRow list={chips.filter((chip) => chip.kind === kind)} />
          </Specimen>
        ))}
      </Section>

      <Usage
        component="<Chip> and <Chips>"
        props={[
          {
            name: "chip",
            type: "Chip",
            what: "Chip: one of bird.bubble.chips: kind, label, count, severity.",
          },
          {
            name: "chips",
            type: "Chip[]",
            what: "Chips: the whole row; draws nothing when empty.",
          },
        ]}
      >
        <p>
          The label already holds the number in words the view model chose (
          <Code>3 unpushed</Code>, <Code>1 open PR</Code>). The chip only picks
          the paper tone from the severity. The CI pending and neutral chips are
          hand-built: the mock&apos;s CI runs all succeed or fail.
        </p>
      </Usage>
    </>
  );
}
