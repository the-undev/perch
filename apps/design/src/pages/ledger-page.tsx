import type { LedgerEntry } from "@perch/core/viewmodel.ts";
import { ChipHandles } from "@perch/ui/chip.tsx";
import { type Landing, Ledger } from "@perch/ui/ledger.tsx";
import { useState } from "react";
import { bugLedgerRows, mockBird, scanMoment } from "../specimens.ts";
import { Code, Ground, Section, Specimen, Usage } from "../usage.tsx";

/** A bug line pressed on a page with no paper beside the ledger. */
const ignoreReveal = () => {};

/** A state the mock lacks: a last commit three weeks old. */
const handBuilt: LedgerEntry[] = [
  {
    kind: "count",
    label: "uncommitted changes",
    count: 0,
    text: "none",
    tone: "green",
    chip: null,
    workings: [],
  },
  {
    kind: "time",
    label: "last commit",
    at: "2026-09-30T12:00:00.000Z",
  },
];

type LedgerSpecimen = { id: string; label: string; rule: string };

const specimens: LedgerSpecimen[] = [
  {
    id: "dev/perch",
    label: "Clean zeros, an unjudged count",
    rule: "Perch: nothing unpushed and no bugs read a quiet green none; three uncommitted changes younger than a day take no tone. CI reads pending, the worse of GitHub's success and Forgejo's pending, and takes no tone.",
  },
  {
    id: "undev/spool",
    label: "Nothing waits",
    rule: "Spool: a clean, pushed clone with nothing amber or red opens its ledger with one faint sentence.",
  },
  {
    id: "undev/prism",
    label: "An amber count, a failing state",
    rule: "Prism: four uncommitted changes past a day; CI failing on Forgejo and passing on GitHub, each linked to its run.",
  },
  {
    id: "undev/gramophone",
    label: "A red count",
    rule: "Gramophone: fourteen uncommitted changes past 72 hours.",
  },
  {
    id: "undev/oxbow",
    label: "Two forges, no CI",
    rule: "Oxbow: on GitHub and Forgejo, one pull request row for both; neither runs CI, so there is no CI row.",
  },
  {
    id: "dev/odin/hello",
    label: "One disk only",
    rule: "hello: a clone with no remote shows the remote row instead of unpushed commits, and its opening sentence says no remote holds a copy.",
  },
  {
    id: "github:finch/obsidian-tidy",
    label: "Forge only",
    rule: "obsidian-tidy: no clone, so no git rows; only what the forge says.",
  },
];

const workingSpecimens: LedgerSpecimen[] = [
  {
    id: "dev/perch",
    label: "Two forges disagreeing on CI",
    rule: "Perch: the CI row says pending, the worst state, as the chip does; beneath it GitHub's newest run passed and Forgejo's waits with no runner, each named, toned and linked to the run, with its age. The pull requests row names the one forge that has one.",
  },
  {
    id: "undev/prism",
    label: "A forge's part that couldn't be read",
    rule: "Prism: GitHub answered 404 for its pull requests alone, so the pull request row says so in amber beside what Forgejo said, and the count covers only what was read. GitHub's CI was read, so the CI row names its run.",
  },
  {
    id: "obsidian/Hothouse",
    label: "Open items over two roadmap files",
    rule: "Hothouse Vault: the open items row counts per file; the uncommitted row names the oldest change and its age, amber past a day.",
  },
  {
    id: ".dotfiles",
    label: "Unpushed commits by branch",
    rule: "Dotfiles: one line per local branch holding commits no remote has, oldest first, each with the age of its oldest such commit. main is 3 ahead of origin/main, amber past a day and linked to the branch on its forge; split-layout has no upstream, so no link, and its one commit is too fresh for a tone.",
  },
  {
    id: "obsidian/Pocket",
    label: "A roadmap file with none open",
    rule: "Pocket Vault: a source with nothing to say is silent, so the roadmap file with no open items is left out.",
  },
  {
    id: "undev/Hollow-legacy",
    label: "Bugs",
    rule: "Hollow: the bugs row for its roadmap file holds 23, past red, its working the window it is judged by. A critical bug row appears only for a file that has any.",
  },
  {
    id: "undev/skiff",
    label: "A remote no card can read",
    rule: "Skiff: no card covers skiff-app on GitHub, so the CI and pull request rows each say couldn't read for github beside what Forgejo said.",
  },
  {
    id: "dev/hearth-config",
    label: "No forge could be read",
    rule: "hearth-config: neither forge's token was found, so the CI and pull request rows themselves say couldn't read, in amber, each forge beneath them saying so.",
  },
];

const bugMoods = [
  {
    mood: "content",
    bug: 4,
    criticalBug: 2,
    rule: "Content: 4 bugs against 5 and 2 critical bugs against 3. Each row lists its open lines and nothing else.",
  },
  {
    mood: "restless",
    bug: 5,
    criticalBug: 3,
    rule: "Restless: 5 bugs and 3 critical bugs, each at its amber count. Each row ends in a restless line naming that count, toned amber.",
  },
  {
    mood: "distressed",
    bug: 20,
    criticalBug: 6,
    rule: "Distressed: 20 bugs and 6 critical bugs, each at its red count. Each row ends in a distressed line naming that count, toned red.",
  },
];

/** Perch's chips as handles above its ledger, each press landing on its row as the detail page does. */
function LandingDemo() {
  const perch = mockBird("dev/perch");
  const [landing, setLanding] = useState<Landing | null>(null);
  return (
    <Ground>
      <div className="mb-4 rounded-xl bg-paper px-4 pt-0.5 pb-3.5">
        <ChipHandles
          chips={perch.bubble.chips}
          onPress={(chip) =>
            setLanding((last) => ({ chip, press: (last?.press ?? 0) + 1 }))
          }
        />
      </div>
      <Ledger
        onReveal={ignoreReveal}
        quiet={perch.detail.quiet}
        entries={perch.detail.ledger}
        now={scanMoment}
        landing={landing}
      />
    </Ground>
  );
}

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
                onReveal={ignoreReveal}
                quiet={mockBird(specimen.id).detail.quiet}
                entries={mockBird(specimen.id).detail.ledger}
                now={scanMoment}
                landing={null}
              />
            </Ground>
          </Specimen>
        ))}
        <Specimen
          label="An older time"
          rule="Hand-built: a last commit three weeks back reads in weeks."
        >
          <Ground>
            <Ledger
              onReveal={ignoreReveal}
              quiet={null}
              entries={handBuilt}
              now={scanMoment}
              landing={null}
            />
          </Ground>
        </Specimen>
      </Section>

      <Section
        title="Each chip's working"
        rule="A bubble chip states a conclusion; the row holding its number spells out the working beneath it, source by source, in mono: each forge, roadmap file or git, what it says there, toned, linked where a page exists, and its age where it has one. A source that was read with nothing to say is silent; one that couldn't be read, or a forge whose part for that row couldn't be read, says so in amber: couldn't read, naming the part. A CI or pull request row that no forge could fill says couldn't read itself. A row holding one of the bubble's chips carries the dot, and on the bird's page the chip lands on it."
        min={360}
      >
        {workingSpecimens.map((specimen) => (
          <Specimen
            key={specimen.id}
            label={specimen.label}
            rule={specimen.rule}
          >
            <Ground>
              <Ledger
                onReveal={ignoreReveal}
                quiet={mockBird(specimen.id).detail.quiet}
                entries={mockBird(specimen.id).detail.ledger}
                now={scanMoment}
                landing={null}
              />
            </Ground>
          </Specimen>
        ))}
      </Section>

      <Section
        title="Bug rows by mood"
        rule="A roadmap file's bugs row and critical bugs row list their open bugs, then one line when the count has reached a window: restless at the amber count, distressed at the red count, toned like the row. Within its window a row has no such line. The windows here are 5 and 20 for bugs and 3 and 6 for critical bugs."
        min={360}
      >
        {bugMoods.map((specimen) => (
          <Specimen
            key={specimen.mood}
            label={specimen.mood}
            rule={specimen.rule}
          >
            <Ground>
              <Ledger
                onReveal={ignoreReveal}
                quiet={null}
                entries={bugLedgerRows(specimen.bug, specimen.criticalBug)}
                now={scanMoment}
                landing={null}
              />
            </Ground>
          </Specimen>
        ))}
      </Section>

      <Section
        title="A chip's landing"
        rule="On the bird's page a bubble chip is a handle. Pressed, the page jumps the row holding its working to the middle of the ground at once, and the mark plays in place on a row that holds still: the row lights behind its words with a ring, its working lines brighten to full ink with it, and both hold a moment and fade back over 1.6 seconds. Neither moves anything, so both run with reduced motion too. Pressing again marks it again. A chip pressed in the aviary's bubble rides the camera to the bird's page with the chip in the URL, and the page lands the same way as it opens."
        min={360}
      >
        <Specimen
          label="Perch's chips, pressed"
          rule="Press a chip: its row is marked. The detail page also scrolls to it."
        >
          <LandingDemo />
        </Specimen>
      </Section>

      <Usage
        component="<Ledger>"
        props={[
          {
            name: "quiet",
            type: "string | null",
            what: "bird.detail.quiet: the sentence that opens the ledger when nothing waits; null when something does.",
          },
          {
            name: "entries",
            type: "LedgerEntry[]",
            what: "bird.detail.ledger: count, state and time rows in the view model's order; a count or state row names the chip it holds and its workings.",
          },
          {
            name: "now",
            type: "Date",
            what: "The moment times are measured to. The app passes its clock; these pages pass the mock scan's.",
          },
          {
            name: "landing",
            type: "Landing | null",
            what: "The chip last pressed on the roost and the press's number; its row is marked afresh for each press. Null when none has been.",
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
