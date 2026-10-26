// The roost: the bird off the wire on its own page, perched on a T-stand with its bubble above or, when wide, beside it.

import { Roost, roostRowWidth, roostWidth } from "@perch/ui/roost.tsx";
import type { ReactNode } from "react";
import { mockBird, withOutstanding } from "../specimens.ts";
import { Code, Ground, Section, Specimen, Usage } from "../usage.tsx";

/** A column of the given width, as the detail page gives the roost, so its own width picks the arrangement. */
function Column({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div style={{ width }} className="max-w-full">
      {children}
    </div>
  );
}

export function RoostPage() {
  return (
    <>
      <Section
        title="The bird on its perch"
        rule="On its own page the bird leaves the wire for a T-stand at the top right, drawn in the post's colour. It is drawn larger than on any wire, idle, and always faces left toward its record. Its bubble continues word for word from the aviary but drops the name and state word, which the page's heading carries, and the keys, which the page's action row carries. The tail meets the beak. These are drawn in the 330px column, where the roost is stacked."
        min={380}
      >
        <Specimen
          label="content, being edited"
          rule="Perch: the bob and the song run; the chips are the aviary bubble's."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost bird={mockBird("dev/perch")} night={false} />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="distressed"
          rule="Prism: red breast, a quicker bob and the tail flick, the chips toned by severity beneath the speech."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost bird={mockBird("undev/prism")} night={false} />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="restless"
          rule="Skiff: parked on a branch, amber breast."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost bird={mockBird("undev/skiff")} night={false} />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="on the fence"
          rule="hello: dim, as on the fence; a fence bird's bubble carries no chips."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost bird={mockBird("dev/odin/hello")} night={false} />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="asleep at night"
          rule="Spool at night: eyes closed and still, its bubble speaking woken, as the aviary's does when clicked."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost bird={mockBird("undev/spool")} night={true} />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="at the plumpness cap"
          rule="Spool given 50 open items: plumpness grows the bird and the stand's drawing grows to hold it."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost
                bird={withOutstanding(mockBird("undev/spool"), 50)}
                night={false}
              />
            </Column>
          </Ground>
        </Specimen>
      </Section>
      <Section
        title="Two arrangements"
        rule="The roost lays itself out by its own width, not the window's. Under 520px it is stacked: the bubble above, the bird below, the tail hanging from the bubble's bottom edge. The tail is long enough that the paper clears the top of the bird's head with 14px of daylight at the bird's drawn scale. From 520px it is a row: the bubble on the left, the bird on its stand to the right, a sideways tail leaving the bubble's right edge. The detail page gives the roost 330px up to a 1240px page and 620px beyond, so it stacks below 1240px and becomes a row above it."
        min={660}
      >
        <Specimen
          label="stacked, 330px"
          rule="Below 520px. The tail hangs from the bubble's bottom edge, its tip on the beak, and its length grows with the bird so the head always has daylight beneath the paper."
        >
          <Ground>
            <Column width={roostWidth}>
              <Roost bird={mockBird("undev/prism")} night={false} />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="row, 620px"
          rule="From 520px. The bird is hung from the tail's anchor, 26px below the bubble's top, so the tail meets the beak whatever the bubble's height. The drawing is only as wide as the stand and tail feathers need, and the bubble takes the rest."
        >
          <Ground>
            <Column width={roostRowWidth}>
              <Roost bird={mockBird("undev/prism")} night={false} />
            </Column>
          </Ground>
        </Specimen>
        <Specimen
          label="row, short speech"
          rule="Perch has a single chip row and a short bubble: the tail still lands on the beak, because the bubble is lowered to the beak's height, not the bird raised to the bubble's."
        >
          <Ground>
            <Column width={roostRowWidth}>
              <Roost bird={mockBird("dev/perch")} night={false} />
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
        ]}
      >
        <p>
          The roost fills the width it is given: 330px, the right-hand column of
          the detail page, up to a 1240px page, and 620px beyond. It sits above
          the record, centred, when the page is narrow. The bird is drawn at{" "}
          <Code>roostScale</Code> times its plumpness;{" "}
          <Code>roostFrame(bird)</Code> says where its beak lands, the drop of
          the stacked tail and the reach of the row&apos;s, and the
          bubble&apos;s tail is hung there. The bubble is{" "}
          <Code>{"<RoostBubble>"}</Code> from <Code>bubble.tsx</Code>: the
          aviary bubble&apos;s paper, speech and chips without the header and
          keys.
        </p>
      </Usage>
    </>
  );
}
