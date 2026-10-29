import { mockAviary } from "@perch/core/mock.ts";
import type { Wire as WireModel } from "@perch/core/viewmodel.ts";
import { Scene, sceneWidth } from "@perch/ui/scene.tsx";
import { columnEdge, Fence, Wire } from "@perch/ui/wire.tsx";
import { mockBird, mockWire } from "../specimens.ts";
import { Code, Section, Specimen, Usage } from "../usage.tsx";

const machineHome = mockWire("Machine & Home");
const projects = mockWire("Projects");

/** A wire whose birds are all content: the tally reads "all settled". */
const settledWire: WireModel = {
  name: "Quiet",
  birds: ["undev/spool", "obsidian/Pocket", "dev/perch"].map(
    (id, position) => ({
      ...mockBird(id),
      position,
    }),
  ),
};

function WireScene({ wire, night }: { wire: WireModel; night: boolean }) {
  return (
    <Scene
      phase={night ? "night" : "day"}
      width={sceneWidth}
      height={340}
      label={`The ${wire.name} wire`}
    >
      <Wire wire={wire} y={230} width={sceneWidth} night={night} />
    </Scene>
  );
}

export function WirePage() {
  return (
    <>
      <Section
        title="The wire · your priority"
        rule={`Wires are set in config, an ordered named list; a bird never changes wire by itself. Along the wire the bird places itself: leftmost needs you first. The wire's name is painted large and quiet on the sky behind the wire and its birds, cut back round each bird by a rim of sky. The tally hangs under the wire's left end in front, a line per word group in its colour: who needs attention, who drifts. The birds start ${columnEdge} units in whatever the name or tally says.`}
        min={900}
      >
        <Specimen
          label="Machine & Home"
          rule="Two restless birds, one content."
        >
          <WireScene wire={machineHome} night={false} />
        </Specimen>
        <Specimen
          label="Projects"
          rule="Distressed leftmost, then restless, then content; within a mood by name."
        >
          <WireScene wire={projects} night={false} />
        </Specimen>
        <Specimen
          label="All settled"
          rule="Hand-built: when nobody is restless or distressed the tally says so."
        >
          <WireScene wire={settledWire} night={false} />
        </Specimen>
      </Section>

      <Section
        title="The fence · not adopted"
        rule="The fence below holds the unadopted, dimmed, ordered by name: it holds no priority. Names share one baseline while neighbours have room; once they sit closer they alternate between two, and closer still they step down a size."
        min={900}
      >
        <Specimen
          label="By day"
          rule="Three situations: one disk only, found and undecided, forge only."
        >
          <Scene phase="day" width={sceneWidth} height={260} label="The fence">
            <Fence
              fence={mockAviary.fence}
              y={150}
              width={sceneWidth}
              height={260}
              night={false}
            />
          </Scene>
        </Specimen>
        <Specimen label="At night" rule="The fence sleeps.">
          <Scene
            phase="night"
            width={sceneWidth}
            height={260}
            label="The fence at night"
          >
            <Fence
              fence={mockAviary.fence}
              y={150}
              width={sceneWidth}
              height={260}
              night={true}
            />
          </Scene>
        </Specimen>
      </Section>

      <Section
        title="Together at night"
        rule="Night is cosmetic: positions and colours hold. Content birds that are not edited sleep; the rest stay awake, and Perch sings."
        min={900}
      >
        <Specimen
          label="The whole mock aviary"
          rule="Both wires and the fence in one scene."
        >
          <Scene
            phase="night"
            width={sceneWidth}
            height={980}
            label="The mock aviary at night"
          >
            <Wire wire={machineHome} y={300} width={sceneWidth} night={true} />
            <Wire wire={projects} y={590} width={sceneWidth} night={true} />
            <Fence
              fence={mockAviary.fence}
              y={850}
              width={sceneWidth}
              height={980}
              night={true}
            />
          </Scene>
        </Specimen>
      </Section>

      <Usage
        component="<Wire> and <Fence>"
        props={[
          {
            name: "wire",
            type: "Wire",
            what: "Wire only: one priority band from the view model, its birds ordered leftmost first.",
          },
          {
            name: "fence",
            type: "Fence",
            what: "Fence only: every bird config does not adopt.",
          },
          {
            name: "y",
            type: "number",
            what: "The wire's ends, or the fence rail, in scene units.",
          },
          {
            name: "width",
            type: "number",
            what: "The scene's width, sceneWidth (2000).",
          },
          {
            name: "height",
            type: "number",
            what: "Fence only: the scene's height, so the posts reach the bottom.",
          },
          {
            name: "night",
            type: "boolean",
            what: "Passed to every bird for sleep.",
          },
        ]}
      >
        <p>
          Both draw into a <Code>Scene</Code>, in scene units. The wires come
          from <Code>aviary.wires</Code> in config order, the fence from{" "}
          <Code>aviary.fence</Code>. Birds are spread evenly from the column
          edge, {columnEdge} units in, to the right margin, at most 340 units
          apart on a wire and 205 on the fence, and turned to face the middle.
          Where each name sits comes from <Code>namePlace</Code>, by its index
          and how far apart its neighbours are. Splitting a crowded wire over
          two rows, the arrival and hover tips belong to <Code>AviaryView</Code>
          , which draws the same pieces: <Code>PaintedName</Code> behind
          everything, cut round the birds it is given, then{" "}
          <Code>WireLine</Code> and <Code>FenceRail</Code>, the birds, and{" "}
          <Code>WireTally</Code> in front.
        </p>
      </Usage>
    </>
  );
}
