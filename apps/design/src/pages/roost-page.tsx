// The roost: the bird off the wire on its own page, perched on a T-stand with its bubble above.

import { Roost } from "@perch/ui/roost.tsx";
import { mockBird, withOutstanding } from "../specimens.ts";
import { Code, Ground, Section, Specimen, Usage } from "../usage.tsx";

export function RoostPage() {
  return (
    <>
      <Section
        title="The bird on its perch"
        rule="On its own page the bird leaves the wire for a T-stand at the top right, drawn in the post's colour. It is drawn larger than on any wire, idle, and always faces left toward its record. Its bubble continues word for word from the aviary but drops the name and state word, which the page's heading carries, and the keys, which the page's action row carries. The tail meets the beak."
        min={380}
      >
        <Specimen
          label="content, being edited"
          rule="Perch: the bob and the song run; the chips are the aviary bubble's."
        >
          <Ground>
            <Roost bird={mockBird("dev/perch")} night={false} />
          </Ground>
        </Specimen>
        <Specimen
          label="distressed"
          rule="Prism: red breast, a quicker bob and the tail flick, the chips toned by severity beneath the speech."
        >
          <Ground>
            <Roost bird={mockBird("undev/prism")} night={false} />
          </Ground>
        </Specimen>
        <Specimen
          label="restless"
          rule="Skiff: parked on a branch, amber breast."
        >
          <Ground>
            <Roost bird={mockBird("undev/skiff")} night={false} />
          </Ground>
        </Specimen>
        <Specimen
          label="on the fence"
          rule="hello: dim, as on the fence; a fence bird's bubble carries no chips."
        >
          <Ground>
            <Roost bird={mockBird("dev/odin/hello")} night={false} />
          </Ground>
        </Specimen>
        <Specimen
          label="asleep at night"
          rule="Spool at night: eyes closed and still, its bubble speaking woken, as the aviary's does when clicked."
        >
          <Ground>
            <Roost bird={mockBird("undev/spool")} night={true} />
          </Ground>
        </Specimen>
        <Specimen
          label="at the plumpness cap"
          rule="Spool given 50 open items: plumpness grows the bird and the stand's drawing grows to hold it."
        >
          <Ground>
            <Roost
              bird={withOutstanding(mockBird("undev/spool"), 50)}
              night={false}
            />
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
          The roost is 330px wide, the right-hand column of the detail page, and
          sits above the record, centred, when the page is narrow. The bird is
          drawn at <Code>roostScale</Code> times its plumpness;{" "}
          <Code>roostFrame(bird)</Code> says where its beak lands, and the
          bubble&apos;s tail is hung there. The bubble is{" "}
          <Code>{"<RoostBubble>"}</Code> from <Code>bubble.tsx</Code>: the
          aviary bubble&apos;s paper, speech and chips without the header and
          keys.
        </p>
      </Usage>
    </>
  );
}
