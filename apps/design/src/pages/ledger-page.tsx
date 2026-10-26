import type { LedgerEntry } from "@perch/core/viewmodel.ts";
import { Ledger } from "@perch/ui/ledger.tsx";
import { mockBird, scanMoment } from "../specimens.ts";
import { Code, Ground, Section, Specimen, Usage } from "../usage.tsx";

/** States the mock lacks: a pending CI run with no tone and a link, and an old Claude session. */
const handBuilt: LedgerEntry[] = [
  {
    kind: "count",
    label: "uncommitted changes",
    count: 0,
    text: "none",
    tone: "green",
  },
  {
    kind: "state",
    label: "CI on GitHub",
    text: "pending on main",
    tone: null,
    url: "https://github.com/finch/perch/actions",
  },
  {
    kind: "time",
    label: "last Claude session",
    at: "2026-09-30T12:00:00.000Z",
  },
];

const specimens: { id: string; label: string; rule: string }[] = [
  {
    id: "dev/perch",
    label: "Clean zeros, an unjudged count",
    rule: "Perch: nothing unpushed and no bugs read a quiet green none; three uncommitted changes younger than a day take no tone. CI success is green.",
  },
  {
    id: "undev/prism",
    label: "An amber count, a failing state",
    rule: "Prism: four uncommitted changes past a day; CI failing on Forgejo, linked to the run.",
  },
  {
    id: "undev/gramophone",
    label: "A red count",
    rule: "Gramophone: fourteen uncommitted changes past 72 hours.",
  },
  {
    id: "undev/oxbow",
    label: "Two forges, no CI",
    rule: "Oxbow: on GitHub and Forgejo, each with its own pull request row; neither runs CI, so there is no CI row.",
  },
  {
    id: "dev/odin/hello",
    label: "One disk only",
    rule: "hello: a clone with no remote shows the remote row instead of unpushed commits.",
  },
  {
    id: "github:finch/obsidian-tidy",
    label: "Forge only",
    rule: "obsidian-tidy: no clone, so no git rows; only what the forge says.",
  },
];

export function LedgerPage() {
  return (
    <>
      <Section
        title="Facts in full words"
        rule='Only facts that exist, each in full words. Clean zeros show a quiet green "none" instead of a large 0; counts take amber or red from their judged level, else no tone; times read as durations to the scan.'
        min={360}
      >
        {specimens.map((specimen) => (
          <Specimen
            key={specimen.id}
            label={specimen.label}
            rule={specimen.rule}
          >
            <Ground>
              <Ledger
                entries={mockBird(specimen.id).detail.ledger}
                now={scanMoment}
              />
            </Ground>
          </Specimen>
        ))}
        <Specimen
          label="A pending state, linked; an older time"
          rule="Hand-built: CI pending takes no tone; a session three weeks back reads in weeks."
        >
          <Ground>
            <Ledger entries={handBuilt} now={scanMoment} />
          </Ground>
        </Specimen>
      </Section>

      <Usage
        component="<Ledger>"
        props={[
          {
            name: "entries",
            type: "LedgerEntry[]",
            what: "bird.detail.ledger: count, state and time rows in the view model's order.",
          },
          {
            name: "now",
            type: "Date",
            what: "The moment times are measured to. The app passes its clock; these pages pass the mock scan's.",
          },
        ]}
      >
        <p>
          Every word on a row comes from the view model; the ledger only tones
          and lays them out. <Code>LedgerRow</Code> and{" "}
          <Code>LedgerHeading</Code> are exported for the sections beneath it.
        </p>
      </Usage>
    </>
  );
}
