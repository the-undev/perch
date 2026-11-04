// The field guide: the bird and the bubble as annotated plates, each part's note written from the
// spec and the code, the numbers it quotes read from the config defaults and the components.

import { defaultConfig } from "@perch/core/config-default.ts";
import { mockAviary } from "@perch/core/mock.ts";
import { plumpnessCap } from "@perch/core/viewmodel.ts";
import { BirdPortrait, plumpScale } from "@perch/ui/bird.tsx";
import { tailDrop } from "@perch/ui/bubble.tsx";
import { Scene, sceneWidth } from "@perch/ui/scene.tsx";
import { Fence, Wire } from "@perch/ui/wire.tsx";
import { type ReactNode, useState } from "react";
import { SpeakingBird } from "../speaking-bird.tsx";
import { mockBird, mockWire } from "../specimens.ts";
import { Plate, Pressed, Specimen } from "../usage.tsx";

const { unsafe, stalled } = defaultConfig().thresholds;
const largestGrowth = Math.round(
  (plumpScale({ outstanding: plumpnessCap, fullness: 1 }) - 1) * 100,
);

const vault = mockBird("obsidian/Hothouse");
const skiff = mockBird("undev/skiff");

interface Note {
  title: string;
  text: ReactNode;
  /** The rule or source behind the part, in the quiet voice; null when the text says it all. */
  rule: ReactNode | null;
}

const birdNotes: Note[] = [
  {
    title: "Breast colour · health, worn as mood",
    text: `Green content, amber restless, red distressed. Failing CI and open bugs are red. A remote the clone pushes to that no card can read is amber. Unsafe work, uncommitted changes and unpushed commits alike, turns amber after ${unsafe.amberHours} hours and red after ${unsafe.redHours}, timed from the oldest change. Stalled flight, parked on a branch other than the default with no movement, turns amber at ${stalled.amberDays} days and red at ${stalled.redDays}, even with everything pushed.`,
    rule: "Worst input wins. The windows are config defaults from the Judgement page; a bird's papers may set its own.",
  },
  {
    title: "Restlessness · unhappiness in motion",
    text: "Every bird bobs gently. The unhappier it is, the higher and quicker the bob, and a distressed bird's tail flicks. A fence bird bobs like a content one whatever its health.",
    rule: "Motion stays subtle; reduced motion stills every bird.",
  },
  {
    title: "Plumpness · outstanding work",
    text: `Open roadmap items make a plumper bird, up to ${largestGrowth} per cent larger at ${plumpnessCap} items, so nobody bursts. Every wire bird starts from one size and a fence bird from a slightly smaller one; plumpness is the only thing that changes it. ${vault.name} carries ${vault.plumpness.outstanding} open items, past the cap.`,
    rule: "Volume at a glance; the exact count is the bubble's open-items chip.",
  },
  {
    title: "♪ · being edited",
    text: "The song means the clone holds uncommitted changes: your hands are in it now. Activity runs on its own axis beside health, so a bird of any mood can sing, and it sings at any hour. A fence bird never sings.",
    rule: "From git: editing while any file is uncommitted.",
  },
  {
    title: "The eye · asleep at night",
    text: "The sky follows the real clock. At night a content bird that is not being edited sleeps: its eye closes and it stops bobbing. Restless and distressed birds lie awake, and every fence bird sleeps. Colours and places never change by night.",
    rule: "Clicked while asleep, a bird wakes and says so before its speech.",
  },
  {
    title: "Name · the project",
    text: "The display name from config, else the name the scan found. A bird is the project, joined over its clone, its forge repositories and its vault state, so one name covers them all. It brightens under the pointer.",
    rule: null,
  },
  {
    title: "The wire · your priority",
    text: "Wires are the owner's priority bands, an ordered named list in config. A bird never changes wire by itself; its papers move it. The wire's name is painted large and quiet on the sky above its left end, cut back round each bird, and its tally hangs in front beneath.",
    rule: "Along the wire the worst mood sits leftmost, then by name: leftmost needs you first.",
  },
  {
    title: "The fence · not adopted",
    text: "Everything the scan finds starts on the fence beneath the wires. A fence bird is dimmed and does not wear its mood, and the fence is ordered by name, since it holds no priority.",
    rule: "Adopting a bird writes its entry into config and puts it on a wire.",
  },
];

const bubbleNotes: Note[] = [
  {
    title: "Name and state word · the same health, spoken",
    text: 'The display name, and the word for the mood the breast wears, in its colour on paper: content, restless or distressed. A fence bird says "not adopted", quietly.',
    rule: "Never a second status: the colour and the word read from one derivation.",
  },
  {
    title: "The speech · how it feels and why",
    text: "The why behind the colour, in the first person. The worst cause speaks first and one more may follow; the rest waits in the chips. Tone follows mood: green brief, amber nudging, red blunt. A fence bird says where it stands without pleading.",
    rule: "Words from the phrasebook through speech.ts; the bubble never composes them. Reasons and feelings, never inventory.",
  },
  {
    title: "Chips · the numbers it carries",
    text: "In a fixed order: can't read, CI, bugs, uncommitted, unpushed, stalled, pull requests, open items. A chip is plain when its fact is not judged, amber or red when it is. Each is a handle: pressed, it rides the camera to the bird's page and lands on the ledger row holding its working.",
    rule: "A zero or an absent source shows no chip; a fence bird carries none.",
  },
  {
    title: "Launch actions · open things, change nothing",
    text: "The launch actions from config, in config order, each an icon named by its verb on hover: the zellij tab, an editor, the folder. They open things and mutate nothing.",
    rule: "A bird offers none until config holds one.",
  },
  {
    title: "Adopt · a fence bird's one key",
    text: "A fence bird's bubble has one key beside the full story: Adopt, which opens the bird's page with its adoption papers unfolded. An adopted bird's bubble has no such key.",
    rule: null,
  },
  {
    title: "Tell me the full story · the way down",
    text: "Rides the camera down to the bird's page, which holds everything the bird and its bubble show and the facts behind them.",
    rule: null,
  },
  {
    title: "The tail · grown from the beak",
    text: `The tail's tip sits on the clicked bird's beak tip, ${tailDrop}px below the paper. The bubble pops open from the tail as the beak wiggles, and Escape or a click on the open sky closes it.`,
    rule: null,
  },
];

/** The notes beside a plate, one card per part, flowing into more columns on a wide window. */
function Notes({ notes }: { notes: Note[] }) {
  return (
    <ul
      className="m-0 grid list-none gap-3 p-0"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))",
      }}
    >
      {notes.map((note) => (
        <li
          key={note.title}
          className="rounded-xl border border-edge bg-band px-4 py-3"
        >
          <h3 className="m-0 font-bold font-display text-[14px] text-ink">
            {note.title}
          </h3>
          <p className="mt-1 mb-0 text-[13px] text-ink-muted leading-normal">
            {note.text}
          </p>
          {note.rule !== null && (
            <p className="mt-1.5 mb-0 text-[12px] text-ink-faint leading-normal">
              {note.rule}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** One plate: its heading, what it answers, the specimens and the notes beside them. */
function FieldPlate({
  title,
  sub,
  notes,
  children,
}: {
  title: string;
  sub: string;
  notes: Note[];
  children: ReactNode;
}) {
  return (
    <section className="mt-11">
      <h2 className="m-0 font-bold font-display text-[20px]">{title}</h2>
      <p className="mt-1 mb-4 max-w-[76ch] text-[13.5px] text-ink-muted leading-relaxed">
        {sub}
      </p>
      <div
        className="grid items-start gap-x-8 gap-y-6"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(520px, 100%), 1fr))",
        }}
      >
        <div className="min-w-0 space-y-7">{children}</div>
        <Notes notes={notes} />
      </div>
    </section>
  );
}

export function FieldGuidePage() {
  const [pressed, setPressed] = useState("nothing yet");
  return (
    <>
      <p className="mt-6 mb-0 max-w-[76ch] text-[13.5px] text-ink-muted leading-relaxed">
        Each plate shows the real components on the mock scan, with a note per
        part: what it carries and the rule behind it. Every threshold quoted is
        the config default.
      </p>

      <FieldPlate
        title="Plate I · the bird"
        sub="Read without clicking. It answers which thing needs you first, whether anything is at risk, and whether the rest is quietly fine."
        notes={birdNotes}
      >
        <Specimen
          label={`${vault.name}: restless, editing, at the plumpness cap`}
          rule={`On ${vault.wire}. ${vault.bubble.speech}`}
        >
          <Plate phase="day">
            <div className="w-full max-w-[520px] [&>svg]:w-full">
              <BirdPortrait bird={vault} facing="right" night={false} />
            </div>
          </Plate>
        </Specimen>
        <Specimen
          label="Where it perches: Machine & Home, and the fence"
          rule="The wire's painted name and tally, its birds worst mood leftmost, and the unadopted dimmed on the fence beneath."
        >
          <div className="overflow-hidden rounded-xl border border-edge">
            <Scene
              phase="day"
              width={sceneWidth}
              height={600}
              label="The Machine & Home wire above the fence"
            >
              <Wire
                wire={mockWire("Machine & Home")}
                y={250}
                width={sceneWidth}
                night={false}
              />
              <Fence
                fence={mockAviary.fence}
                y={500}
                width={sceneWidth}
                height={600}
                night={false}
              />
            </Scene>
          </div>
        </Specimen>
        <div
          className="grid items-start gap-x-6 gap-y-7"
          style={{
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(240px, 100%), 1fr))",
          }}
        >
          <Specimen
            label="Spool by night: asleep"
            rule="Content and not edited, so its eye closes."
          >
            <Plate phase="night">
              <BirdPortrait
                bird={mockBird("undev/spool")}
                facing="right"
                night={true}
              />
            </Plate>
          </Specimen>
          <Specimen
            label="Perch by night: singing"
            rule="Being edited, so it stays awake."
          >
            <Plate phase="night">
              <BirdPortrait
                bird={mockBird("dev/perch")}
                facing="right"
                night={true}
              />
            </Plate>
          </Specimen>
        </div>
      </FieldPlate>

      <FieldPlate
        title="Plate II · the bubble"
        sub="Click a bird and it speaks. The speech is the why behind the colour; the chips are the numbers it carries."
        notes={bubbleNotes}
      >
        <Specimen
          label={`${skiff.name}: restless, adopted`}
          rule="A remote no card can read, and parked on a branch: the worst speaks first, the stall follows."
        >
          <Plate phase="dusk">
            <SpeakingBird bird={skiff} night={false} onPress={setPressed} />
          </Plate>
        </Specimen>
        <Specimen
          label="hello: on the fence"
          rule="No chips, and the Adopt key beside the full story."
        >
          <Plate phase="dusk">
            <SpeakingBird
              bird={mockBird("dev/odin/hello")}
              night={false}
              onPress={setPressed}
            />
          </Plate>
        </Specimen>
        <Pressed text={pressed} />
      </FieldPlate>
    </>
  );
}
