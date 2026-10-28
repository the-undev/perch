import { mockAviary } from "@perch/core/mock.ts";
import { crowdedGap, rowCapacity, rowsFor } from "@perch/ui/aviary-layout.ts";
import { AviaryView } from "@perch/ui/aviary-view.tsx";
import { CameraView } from "@perch/ui/camera.tsx";
import { sceneWidth } from "@perch/ui/scene.tsx";
import {
  alternateBelow,
  edgeMargin,
  fenceGap,
  placeSpacing,
  smallerBelow,
} from "@perch/ui/wire.tsx";
import {
  aviaryWith,
  crowdedFence,
  crowdedWire,
  mockWire,
  scanMoment,
} from "../specimens.ts";
import { Code, SceneFrame, Section, Specimen, Usage } from "../usage.tsx";

/** The fewest fence birds whose neighbours sit closer than a limit. */
function fenceCountBelow(limit: number): number {
  return Math.floor((sceneWidth - 2 * edgeMargin) / limit) + 2;
}

/** The live machine's fence on first look: 21 birds. */
const liveFence = 21;

/** How many birds a row holds at full width. */
const fullRow = rowCapacity(sceneWidth);

const counts = [fullRow, fullRow + 1, 2 * fullRow, 2 * fullRow + 2];

export function CrowdedPage() {
  return (
    <>
      <Section
        title="A wire over more than one row"
        rule={`A row holds as many birds as fit ${crowdedGap} units apart between the margins: ${fullRow} at full width, fewer in a window too narrow for the full width at the floor. A wire with more takes another row for each row's worth, dealing its birds over the rows in turn, so the leftmost of every row still needs you first. Each further row sits a little to the right, between the birds above; only the first row carries the wire's name and tally.`}
        min={900}
      >
        {counts.map((count) => (
          <Specimen
            key={count}
            label={`${count} birds, ${rowsFor(count, sceneWidth)} ${rowsFor(count, sceneWidth) === 1 ? "row" : "rows"} at full width`}
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
                onAdopt={() => {}}
                onChip={() => {}}
              />
            </SceneFrame>
          </Specimen>
        ))}
        <Specimen
          label="The mock's Projects wire"
          rule={`Nine birds, more than ${fullRow}: two rows at full width, as the board drew it.`}
        >
          <SceneFrame height="560px">
            <AviaryView
              aviary={mockAviary}
              now={scanMoment}
              onLaunch={() => {}}
              onFullStory={() => {}}
              onAdopt={() => {}}
              onChip={() => {}}
            />
          </SceneFrame>
        </Specimen>
      </Section>

      <Section
        title="A crowded fence"
        rule={`Every bird stays on the one fence. While neighbours sit ${alternateBelow} units apart or more their names share one baseline; closer, every other name drops to a lower baseline; under ${smallerBelow} apart every name also steps down a size. The strip of the fence's tab row follows the same rule.`}
        min={900}
      >
        <Specimen
          label={`${fenceCountBelow(alternateBelow)} birds, names alternate`}
          rule={`Neighbours ${Math.round(placeSpacing(fenceCountBelow(alternateBelow), fenceGap, sceneWidth))} units apart: two baselines at full size.`}
        >
          <SceneFrame height="560px">
            <AviaryView
              aviary={crowdedFence(fenceCountBelow(alternateBelow))}
              now={scanMoment}
              onLaunch={() => {}}
              onFullStory={() => {}}
              onAdopt={() => {}}
              onChip={() => {}}
            />
          </SceneFrame>
        </Specimen>
        <Specimen
          label={`${liveFence} birds, the live machine's fence`}
          rule={`Neighbours ${placeSpacing(liveFence, fenceGap, sceneWidth)} units apart: two baselines, a size smaller. Copies of the mock's fence birds, numbered, ordered by name.`}
        >
          <SceneFrame height="560px">
            <AviaryView
              aviary={crowdedFence(liveFence)}
              now={scanMoment}
              onLaunch={() => {}}
              onFullStory={() => {}}
              onAdopt={() => {}}
              onChip={() => {}}
            />
          </SceneFrame>
        </Specimen>
        <Specimen
          label={`${liveFence} birds in the fence's strip`}
          rule="A fence bird's page: its wire-mates in the tab row alternate their names the same way."
        >
          <SceneFrame height="560px">
            <CameraView
              aviary={crowdedFence(liveFence)}
              now={scanMoment}
              place={{
                at: "detail",
                birdId: "fence/0",
                papers: false,
                chip: null,
              }}
              onNavigate={() => {}}
              onLaunch={() => {}}
              sheets={[]}
              scanning={false}
              onRescan={() => {}}
              onSettings={() => {}}
              entry={{ form: null, onSave: () => {}, onRemove: () => {} }}
              problems={[]}
            />
          </SceneFrame>
        </Specimen>
      </Section>

      <Usage
        component="rowsFor(count, width)"
        props={[
          {
            name: "count",
            type: "number",
            what: "How many birds the wire holds; the result is the rows it takes, at least one.",
          },
          {
            name: "width",
            type: "number",
            what: "The scene's width in units: sceneWidth at full size, sceneWidthFor(pixels) in a window.",
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
