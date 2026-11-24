import { useState } from "react";
import { SpeakingBird } from "../speaking-bird.tsx";
import { byDay, mockBird, smallHours, snoozedUntil } from "../specimens.ts";
import { Code, Plate, Section, Specimen, Usage } from "../usage.tsx";

interface Entry {
  id: string;
  label: string;
  rule: string;
}

const content: Entry[] = [
  {
    id: "undev/spool",
    label: "All quiet",
    rule: "No unsafe work, no stalled flight, nothing red. The default state.",
  },
  {
    id: "dev/perch",
    label: "Uncommitted changes",
    rule: "Uncommitted. The song plays; the speech acknowledges you.",
  },
  {
    id: "obsidian/Pocket",
    label: "All quiet with a backlog",
    rule: "Green with open work items. The work items are an offer.",
  },
  {
    id: "undev/glyph-docs",
    label: "Out on a branch",
    rule: "Committed on a non-default branch, all of it younger than the amber threshold.",
  },
];

const restless: Entry[] = [
  {
    id: "obsidian/Hothouse",
    label: "Uncommitted work ageing",
    rule: "Oldest uncommitted change past 24 hours (default), under 72.",
  },
  {
    id: ".dotfiles",
    label: "Unpushed backlog",
    rule: "Oldest unpushed commit past 24 hours, under 72.",
  },
  {
    id: "undev/skiff",
    label: "A remote no card can read",
    rule: "The local repository pushes to a repository whose owner no card covers: amber, with the can't-read chip, which lands on the record's notice. Its stall follows as the secondary.",
  },
];

const distressed: Entry[] = [
  {
    id: "undev/prism",
    label: "Several things at once",
    rule: "Worst input speaks first, one secondary follows, chips hold the rest.",
  },
  {
    id: "undev/Hollow-legacy",
    label: "Open bugs",
    rule: "Bugs open on the roadmap.",
  },
  {
    id: "undev/gramophone",
    label: "Unsafe work gone stale",
    rule: "Oldest unsafe change past 72 hours (default).",
  },
];

const fence: Entry[] = [
  {
    id: "github:finch/obsidian-tidy",
    label: "Forge only",
    rule: "A repository on a forge with no local repository.",
  },
  {
    id: "dev/hearth-config",
    label: "Found, undecided",
    rule: "A local repository config has not adopted or ignored.",
  },
  {
    id: "dev/odin/hello",
    label: "One disk only",
    rule: "A local repository with no remote at all.",
  },
];

export function BubblePage() {
  const [pressed, setPressed] = useState("nothing yet");
  const sections: {
    title: string;
    rule: string;
    entries: Entry[];
  }[] = [
    {
      title: "Content",
      rule: "Green birds are brief. Contentment never needs more than two sentences, and the backlog is an invitation, not a nag.",
      entries: content,
    },
    {
      title: "Restless",
      rule: "Amber birds nudge. They name the quantity and the time and stop there; the closing remark may be dry, never wounded.",
      entries: restless,
    },
    {
      title: "Distressed",
      rule: "Red birds are blunt and lead with the worst thing. One secondary fact at most; the rest waits in the chips.",
      entries: distressed,
    },
    {
      title: "On the fence",
      rule: "Fence birds state their situation without pleading, and carry no chips. The decision is the owner's; the bird just says where it stands.",
      entries: fence,
    },
  ];
  return (
    <>
      <p className="mt-6 text-[13px] text-ink-faint">
        Last pressed: <span className="text-ink-muted">{pressed}</span>
      </p>
      {sections.map((section) => (
        <Section
          key={section.title}
          title={section.title}
          rule={section.rule}
          min={440}
        >
          {section.entries.map((entry) => (
            <Specimen key={entry.id} label={entry.label} rule={entry.rule}>
              <Plate phase="dusk">
                <SpeakingBird
                  bird={mockBird(entry.id)}
                  now={byDay}
                  onPress={setPressed}
                />
              </Plate>
            </Specimen>
          ))}
        </Section>
      ))}

      <Section
        title="Asleep"
        rule="Any bird with closed eyes, clicked, is woken and says so before its usual speech. A bird with open eyes never gains the prefix."
        min={440}
      >
        <Specimen
          label="Woken"
          rule="Skiff: restless, committed, asleep until clicked."
        >
          <Plate phase="night">
            <SpeakingBird
              bird={mockBird("undev/skiff")}
              now={smallHours}
              onPress={setPressed}
            />
          </Plate>
        </Specimen>
        <Specimen
          label="Awake anyway"
          rule="Hollow-legacy: distressed, so it never slept."
        >
          <Plate phase="night">
            <SpeakingBird
              bird={mockBird("undev/Hollow-legacy")}
              now={smallHours}
              onPress={setPressed}
            />
          </Plate>
        </Specimen>
      </Section>

      <Section
        title="The snooze action"
        rule="An adopted bird's bubble has a Snooze action after its launch icons, whatever its mood. It opens the durations on a small dark card, shortest first, with indefinitely under a rule. A pick snoozes the bird until that duration's end date from today, or with no date, and closes the bubble. Opening the durations, or folding them with Escape, leaves it open. A fence bird has no snooze action, and a bird whose snooze has run out offers it again."
        min={440}
      >
        <Specimen
          label="Durations"
          rule="Skiff, restless: press Snooze to open the durations."
        >
          <Plate phase="dusk">
            <SpeakingBird
              bird={mockBird("undev/skiff")}
              now={byDay}
              onPress={setPressed}
            />
          </Plate>
        </Specimen>
        <Specimen
          label="Run out"
          rule="Prism snoozed until 22 October, on that day: its real mood, and the Snooze action again."
        >
          <Plate phase="dusk">
            <SpeakingBird
              bird={snoozedUntil(mockBird("undev/prism"), "2026-10-22")}
              now={byDay}
              onPress={setPressed}
            />
          </Plate>
        </Specimen>
      </Section>

      <Section
        title="Snoozed"
        rule="A snoozed bird's state phrase is snoozed, in quiet grey, with the end on its own line under the name: the weekday within six days, else the day and month, or until you wake it. Its eyes are closed, so a click gives the waking prefix. The chips keep their true colours. A Wake action takes the Snooze action's place, and pressing it wakes the bird and closes the bubble."
        min={440}
      >
        <Specimen
          label="Until Friday"
          rule="Prism snoozed until 23 October, on Thursday 22 October."
        >
          <Plate phase="dusk">
            <SpeakingBird
              bird={snoozedUntil(mockBird("undev/prism"), "2026-10-23")}
              now={byDay}
              onPress={setPressed}
            />
          </Plate>
        </Specimen>
        <Specimen
          label="Until a date"
          rule="Skiff snoozed until 4 December: beyond six days, the day and month."
        >
          <Plate phase="dusk">
            <SpeakingBird
              bird={snoozedUntil(mockBird("undev/skiff"), "2026-12-04")}
              now={byDay}
              onPress={setPressed}
            />
          </Plate>
        </Specimen>
        <Specimen label="Until woken" rule="Harbour snoozed with no end date.">
          <Plate phase="dusk">
            <SpeakingBird
              bird={snoozedUntil(mockBird("undev/harbour"), null)}
              now={byDay}
              onPress={setPressed}
            />
          </Plate>
        </Specimen>
      </Section>

      <Usage
        component="<Bubble>"
        props={[
          {
            name: "bubble",
            type: "Bubble",
            what: "bird.bubble: name, speech, chips.",
          },
          {
            name: "look",
            type: "BirdLook",
            what: "birdLook(bird, now): the state phrase, a snooze's end in words, and closed eyes, which give the speech the waking prefix.",
          },
          {
            name: "actions",
            type: "LaunchAction[]",
            what: "bird.page.actions, shown as icon buttons titled with their verbs.",
          },
          {
            name: "onLaunch",
            type: "(action: LaunchAction) => void",
            what: "A launch action was pressed; the app asks the main process to open it.",
          },
          {
            name: "snoozeAction",
            type: "ReactNode",
            what: "The snooze control, after the launch actions: a <SnoozeAction> with place bubble, or null for none.",
          },
          {
            name: "onFullStory",
            type: "() => void",
            what: "Rides the camera down to the bird's page.",
          },
          {
            name: "onAdopt",
            type: "(() => void) | null",
            what: "A fence bird's one action: rides to the bird's page with its adoption papers unfolded. Null for an adopted bird, whose bubble has no adopt action; the caller decides from bird.adopted.",
          },
          {
            name: "onChip",
            type: "(chip: ChipKind) => void",
            what: "A chip was pressed: the camera rides to the bird's page, which lands on the ledger row holding the chip's reading and marks it, as a press on the page's own bubble does.",
          },
          {
            name: "tail",
            type: '{ side: "left" | "right"; inset: number }',
            what: "Which edge the tail hangs from, and the distance from that edge to its tip.",
          },
        ]}
      >
        <p>
          The speech comes from <Code>@perch/core/speech.ts</Code> by the
          phrasebook; the bubble never composes words. To meet a beak, take the
          bird&apos;s beak tip and set the tail&apos;s inset to it; the tip
          hangs 26px below the bubble. The pages here use{" "}
          <Code>portraitFrame(bird, facing)</Code> to do that for a portrait.
        </p>
        <p>
          On the bird&apos;s own page the bubble is{" "}
          <Code>{"<RoostBubble>"}</Code>: the same paper, speech and chips with
          no header and no actions, since the page carries both. Beside the bird
          it is as wide as its words up to about 56 characters, so its chips
          keep to one row where they fit. The Roost page shows it.
        </p>
        <p>
          The chips are handles in both bubbles. Pressed here, one closes the
          bubble like the full-story action and rides the camera to the
          bird&apos;s page with the chip in the URL, <Code>?chip=ci</Code>; the
          page lands on its row as it opens.
        </p>
        <p>
          The snooze control is <Code>{"<SnoozeAction>"}</Code> from{" "}
          <Code>@perch/ui/snooze-action.tsx</Code>, given the bird, its look,
          its place (bubble or page) and the <Code>SnoozeCalls</Code>. A
          pick&apos;s end date is counted from <Code>pickedAt</Code>, the moment
          of the pick. The look decides the action: snoozed offers Wake, not
          adopted offers neither, any other state phrase Snooze. The durations
          exist only there: a pick becomes an end date with{" "}
          <Code>snoozeEndDate</Code>, or null for indefinitely, and goes to{" "}
          <Code>onSnooze(birdId, until)</Code>. The bird&apos;s page carries the
          same control after its launch verbs. In the aviary a pick or a wake
          closes the bubble; on the page it leaves the page as it is.
        </p>
      </Usage>
    </>
  );
}
