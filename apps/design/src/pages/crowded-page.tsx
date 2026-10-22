import { mockAviary } from "@perch/core/mock.ts";
import { crowdedGap, rowCapacity, rowsFor } from "@perch/ui/aviary-layout.ts";
import { AviaryView } from "@perch/ui/aviary-view.tsx";
import { aviaryWith, crowdedWire, mockWire, scanMoment } from "../specimens.ts";
import { Code, SceneFrame, Section, Specimen, Usage } from "../usage.tsx";

const counts = [
  rowCapacity,
  rowCapacity + 1,
  2 * rowCapacity,
  2 * rowCapacity + 2,
];

export function CrowdedPage() {
  return (
    <>
      <Section
        title="A wire over more than one row"
        rule={`A row holds as many birds as fit ${crowdedGap} units apart between the margins: ${rowCapacity}. A wire with more takes another row for each row's worth, dealing its birds over the rows in turn, so the leftmost of every row still needs you first. Each further row sits a little to the right, between the birds above; only the first row carries the wire's name and tally.`}
        min={900}
      >
        {counts.map((count) => (
          <Specimen
            key={count}
            label={`${count} birds, ${rowsFor(count)} ${rowsFor(count) === 1 ? "row" : "rows"}`}
            rule="Copies of the mock's adopted birds, numbered, ordered as the view model orders a wire."
          >
            <SceneFrame height="560px">
              <AviaryView
                aviary={aviaryWith([
                  mockWire("Machine & Home"),
                  crowdedWire("Crowded", count),
                ])}
                now={scanMoment}
                onLaunch={() => {}}
                onFullStory={() => {}}
              />
            </SceneFrame>
          </Specimen>
        ))}
        <Specimen
          label="The mock's Projects wire"
          rule={`Nine birds, more than ${rowCapacity}: two rows, as the board drew it.`}
        >
          <SceneFrame height="560px">
            <AviaryView
              aviary={mockAviary}
              now={scanMoment}
              onLaunch={() => {}}
              onFullStory={() => {}}
            />
          </SceneFrame>
        </Specimen>
      </Section>

      <Usage
        component="rowsFor(count)"
        props={[
          {
            name: "count",
            type: "number",
            what: "How many birds the wire holds; the result is the rows it takes, at least one.",
          },
        ]}
      >
        <p>
          The split lives in <Code>layoutAviary</Code>; <Code>rowsFor</Code> and{" "}
          <Code>rowCapacity</Code> are exported so pages like this one can say
          what it does. The vertical space between the top wire and the fence is
          shared out in steps: a whole step between wires, 0.6 of one between
          rows of the same wire.
        </p>
      </Usage>
    </>
  );
}
