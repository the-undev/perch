import { useState } from "react";
import { SpeakingBird } from "../speaking-bird.tsx";
import { mockBird } from "../specimens.ts";
import { Code, Plate, Section, Specimen, Usage } from "../usage.tsx";

interface Entry {
  id: string;
  label: string;
  rule: string;
}

const content: Entry[] = [
  {
    id: "undev/spool",
    label: "Settled",
    rule: "No unsafe work, no stalled flight, nothing red. The default state.",
  },
  {
    id: "dev/perch",
    label: "Being edited",
    rule: "Activity is editing. The song plays; the speech acknowledges you.",
  },
  {
    id: "obsidian/Pocket",
    label: "Settled with a backlog",
    rule: "Green with open roadmap items. The items are an offer.",
  },
  {
    id: "undev/glyph-docs",
    label: "Out on a branch",
    rule: "In flight on a non-default branch, all of it younger than the amber window.",
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
    rule: "The clone pushes to a repository whose owner no card covers: amber, with the can't-read chip, which lands on the record's notice. Its stall follows as the secondary.",
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
    rule: "A repository on a forge with no local clone.",
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
    night: boolean;
  }[] = [
    {
      title: "Content",
      rule: "Green birds are brief. Contentment never needs more than two sentences, and the backlog is an invitation, not a nag.",
      entries: content,
      night: false,
    },
    {
      title: "Restless",
      rule: "Amber birds nudge. They name the quantity and the time and stop there; the closing remark may be dry, never wounded.",
      entries: restless,
      night: false,
    },
    {
      title: "Distressed",
      rule: "Red birds are blunt and lead with the worst thing. One secondary fact at most; the rest waits in the chips.",
      entries: distressed,
      night: false,
    },
    {
      title: "On the fence",
      rule: "Fence birds state their situation without pleading, and carry no chips. The decision is the owner's; the bird just says where it stands.",
      entries: fence,
      night: false,
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
                  night={section.night}
                  onPress={setPressed}
                />
              </Plate>
            </Specimen>
          ))}
        </Section>
      ))}

      <Section
        title="At night"
        rule="Sleep is earned. A sleeping bird clicked at night is woken and says so before its usual speech; restless and distressed birds lie awake and never gain the prefix."
        min={440}
      >
        <Specimen
          label="Woken"
          rule="Spool: content, not being edited, asleep until clicked."
        >
          <Plate phase="night">
            <SpeakingBird
              bird={mockBird("undev/spool")}
              night={true}
              onPress={setPressed}
            />
          </Plate>
        </Specimen>
        <Specimen
          label="Awake anyway"
          rule="Skiff: restless, so it never slept."
        >
          <Plate phase="night">
            <SpeakingBird
              bird={mockBird("undev/skiff")}
              night={true}
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
            what: "bird.bubble: name, state word, speech, woken speech, chips.",
          },
          {
            name: "night",
            type: "boolean",
            what: "At night a bird that sleeps speaks its woken speech.",
          },
          {
            name: "actions",
            type: "LaunchAction[]",
            what: "bird.detail.actions, shown as icon buttons titled with their verbs.",
          },
          {
            name: "onLaunch",
            type: "(action: LaunchAction) => void",
            what: "A launch action was pressed; the app asks the main process to open it.",
          },
          {
            name: "onFullStory",
            type: "() => void",
            what: "Rides the camera down to the bird's detail page.",
          },
          {
            name: "onAdopt",
            type: "(() => void) | null",
            what: "A fence bird's one key: rides to the bird's page with its adoption papers unfolded. Null for an adopted bird, whose bubble has no adopt key; the caller decides from bird.adopted.",
          },
          {
            name: "onChip",
            type: "(chip: ChipKind) => void",
            what: "A chip was pressed: the camera rides to the bird's page, which lands on the ledger row holding the chip's working and marks it, as a press on the page's own bubble does.",
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
          no header and no keys, since the page carries both. The Roost page
          shows it.
        </p>
        <p>
          The chips are handles in both bubbles. Pressed here, one closes the
          bubble like the full-story key and rides the camera to the bird&apos;s
          page with the chip in the URL, <Code>?chip=ci</Code>; the page lands
          on its row as it opens.
        </p>
      </Usage>
    </>
  );
}
