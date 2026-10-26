// The roost: the bird off the wire on its own page, perched on a T-stand with its bubble above or, when wide, beside it.

import { Roost, roostRowWidth, roostWidth } from "@perch/ui/roost.tsx";
import { type ReactNode, useState } from "react";
import { mockBird, withOutstanding } from "../specimens.ts";
import { Code, Ground, Pressed, Section, Specimen, Usage } from "../usage.tsx";

/** A column of the given width, as the detail page gives the roost, so its own width picks the arrangement. */
function Column({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div style={{ width }} className="max-w-full">
      {children}
    </div>
  );
}

export function RoostPage() {
  const [pressed, setPressed] = useState("nothing yet");
  const onChip = (chip: string) => setPressed(`onChip("${chip}")`);
  return (
    <>
      <Section
        title="The bird on its perch"
        rule="On its own page the bird leaves the wire for a T-stand at the top right, drawn in the post's colour. It is drawn larger than on any wire, idle, and always faces left toward its record. Its bubble continues word for word from the aviary but drops the name and state word, which the page's heading carries, and the keys, which the page's action row carries. The tail meets the beak. Its chips are handles: pressing one hands back the chip's kind, and the detail page lands on the ledger row holding its working. These are drawn in a 330px column, under the 460px at which the roost becomes a row, so they are stacked."
        min={380}
      >
        <Specimen
          label="content, being edited"
          rule="Perch: the bob and the song run; the chips are the aviary bubble's."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost
                bird={mockBird("dev/perch")}
                night={false}
                onChip={onChip}
              />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="distressed"
          rule="Prism: red breast, a quicker bob and the tail flick, the chips toned by severity beneath the speech."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost
                bird={mockBird("undev/prism")}
                night={false}
                onChip={onChip}
              />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="restless"
          rule="Skiff: parked on a branch, amber breast."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost
                bird={mockBird("undev/skiff")}
                night={false}
                onChip={onChip}
              />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="on the fence"
          rule="hello: dim, as on the fence; a fence bird's bubble carries no chips."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost
                bird={mockBird("dev/odin/hello")}
                night={false}
                onChip={onChip}
              />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="asleep at night"
          rule="Spool at night: eyes closed and still, its bubble speaking woken, as the aviary's does when clicked."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost
                bird={mockBird("undev/spool")}
                night={true}
                onChip={onChip}
              />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="at the plumpness cap"
          rule="Spool given 50 open items: plumpness grows the bird on a stand that does not move or resize: the stand is sized for the plumpest bird."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost
                bird={withOutstanding(mockBird("undev/spool"), 50)}
                night={false}
                onChip={onChip}
              />
            </Column>
          </Ground>
        </Specimen>
      </Section>
      <Pressed text={pressed} />
      <Section
        title="Two arrangements"
        rule="The roost lays itself out by its own width, not the window's. Under 460px it is stacked: the bubble above, the bird below, the tail hanging from the bubble's bottom edge. The tail is long enough that the paper clears the top of the bird's head with 14px of daylight at the bird's drawn scale. From 460px it is a row: the bubble on the left, the bird on its stand to the right, a tail leaving the bubble's right edge and slanting down to the beak. The bubble sits at the top of the band, and the stand's pole and shadow hang below the band into the space beneath. The detail page gives the roost a 480px column from 860px wide, so it is a row there; below 860px the roost sits above the record and is a row too unless the window is narrower than 460px."
        min={660}
      >
        <Specimen
          label="stacked, under 460px"
          rule="Below 460px. The tail hangs from the bubble's bottom edge, its tip on the beak, and its length grows with the bird so the head always has daylight beneath the paper."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost
                bird={mockBird("undev/prism")}
                night={false}
                onChip={onChip}
              />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="row, 480px"
          rule="From 460px. The bubble is pinned to the top of the band and the tail's base is 12px below its top, so the tail slants down to the beak, which is the same distance below the band's top whatever the bubble's height. The drawing is only as wide as the stand and tail feathers need, and the bubble takes the rest."
        >
          <Ground>
            <Column width={roostRowWidth}>
              <Roost
                bird={mockBird("undev/prism")}
                night={false}
                onChip={onChip}
              />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="row, short speech"
          rule="Perch has a single chip row and a short bubble: the tail still lands on the beak, because the tail's tip is fixed to the beak's height below the band's top, not to the bubble's."
        >
          <Ground>
            <Column width={roostRowWidth}>
              <Roost
                bird={mockBird("dev/perch")}
                night={false}
                onChip={onChip}
              />
            </Column>
          </Ground>
        </Specimen>
      </Section>
      <Usage
        component="<Roost>"
        props={[
          { name: "bird", type: "Bird", what: "The bird whose page this is." },
          {
            name: "night",
            type: "boolean",
            what: "The sky is at night: a bird that sleeps sleeps here too, and its bubble speaks woken.",
          },
          {
            name: "onChip",
            type: "(chip: ChipKind) => void",
            what: "A chip in the bubble was pressed; the detail page scrolls to the ledger row holding its working and marks it.",
          },
        ]}
      >
        <p>
          The roost fills the width it is given: 480px, the right-hand column of
          the detail page. It sits above the record, centred, when the page is
          narrow. The bird is drawn at <Code>roostScale</Code> times its
          plumpness; <Code>roostFrame(bird)</Code> says where its beak lands,
          the drop of the stacked tail and the reach of the row&apos;s, and the
          bubble&apos;s tail is hung there. The bubble is{" "}
          <Code>{"<RoostBubble>"}</Code> from <Code>bubble.tsx</Code>: the
          aviary bubble&apos;s paper, speech and chips without the header and
          keys, its chips drawn as handles by <Code>{"<ChipHandles>"}</Code>.
        </p>
      </Usage>
    </>
  );
}
