import { mockAviary } from "@perch/core/mock.ts";
import type { Wire as WireModel } from "@perch/core/viewmodel.ts";
import { Scene, sceneWidth } from "@perch/ui/scene.tsx";
import { columnEdgeFor, Fence, Wire } from "@perch/ui/wire.tsx";
import {
  byDay,
  mockBird,
  mockWire,
  smallHours,
  snoozedUntil,
} from "../specimens.ts";
import { Code, Section, Specimen, Usage } from "../usage.tsx";

const machineHome = mockWire("Machine & Home");
const projects = mockWire("Projects");

/** A wire whose birds are all content: the tally reads "all content". */
const contentWire: WireModel = {
  name: "Quiet",
  birds: ["undev/spool", "obsidian/Pocket", "dev/perch"].map(
    (id, position) => ({
      ...mockBird(id),
      position,
    }),
  ),
};

/** Projects with its distressed Prism and its restless Skiff snoozed, the others as they are. */
const snoozedWire: WireModel = {
  ...projects,
  birds: projects.birds.map((bird) =>
    ["undev/prism", "undev/skiff"].includes(bird.id)
      ? snoozedUntil(bird, null)
      : bird,
  ),
};

/** Projects with Skiff's snooze run out by the scene's clock: it counts by its mood again. */
const runOutWire: WireModel = {
  ...projects,
  birds: projects.birds.map((bird) =>
    bird.id === "undev/skiff" ? snoozedUntil(bird, "2026-10-22") : bird,
  ),
};

function WireScene({ wire }: { wire: WireModel }) {
  return (
    <Scene
      phase="day"
      width={sceneWidth}
      height={340}
      label={`The ${wire.name} wire`}
    >
      <Wire wire={wire} y={230} width={sceneWidth} now={byDay} />
    </Scene>
  );
}

export function WirePage() {
  return (
    <>
      <Section
        title="The wire · your priority"
        rule={`Wires are set in config, an ordered named list; a bird never changes wire by itself. Along the wire the birds sit in name order. The wire's name is painted large and quiet on the sky behind the wire and its birds, cut back round each bird by a rim of sky. The tally hangs under the wire's left end in front, a line per word group in its colour: who is distressed, who is restless, who is snoozed. A snoozed bird is counted as snoozed only, and a snooze that has run out counts by its mood again. The birds start ${columnEdgeFor(sceneWidth)} units in at full width whatever the name or tally says.`}
        min={900}
      >
        <Specimen
          label="Machine & Home"
          rule="Two restless birds, one content."
        >
          <WireScene wire={machineHome} />
        </Specimen>
        <Specimen
          label="Projects"
          rule="By name, whatever the moods of its birds."
        >
          <WireScene wire={projects} />
        </Specimen>
        <Specimen
          label="All content"
          rule="Hand-built: when nobody is restless or distressed the tally says so."
        >
          <WireScene wire={contentWire} />
        </Specimen>
        <Specimen
          label="Snoozed"
          rule="Prism and Skiff snoozed: the tally counts them as snoozed after restless, and not as distressed or restless."
        >
          <WireScene wire={snoozedWire} />
        </Specimen>
        <Specimen
          label="Snooze run out"
          rule="Skiff snoozed until 22 October, drawn that afternoon: counted as restless again."
        >
          <WireScene wire={runOutWire} />
        </Specimen>
      </Section>

      <Section
        title="The fence · not adopted"
        rule="The fence below holds the unadopted, dimmed, ordered by name: it holds no priority. Its name is painted behind the rail's left end as a wire's is, the count hangs in front beneath the rail, and its birds start from the same column. Names share one baseline while neighbours have room; once they sit closer they alternate between two, and closer still they step down a size."
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
              now={byDay}
            />
          </Scene>
        </Specimen>
        <Specimen
          label="Midnight to 06:00"
          rule="Every fence bird sleeps, whatever its health."
        >
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
              now={smallHours}
            />
          </Scene>
        </Specimen>
      </Section>

      <Section
        title="Together in the small hours"
        rule="The sky shows night as the backdrop only; positions and colours hold. Sleep follows its own hours: from midnight to 06:00 every bird sleeps but the distressed and the edited, and the edited sing."
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
            <Wire
              wire={machineHome}
              y={300}
              width={sceneWidth}
              now={smallHours}
            />
            <Wire wire={projects} y={590} width={sceneWidth} now={smallHours} />
            <Fence
              fence={mockAviary.fence}
              y={850}
              width={sceneWidth}
              height={980}
              now={smallHours}
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
            what: "Wire only: one priority band from the view model, its birds ordered by name.",
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
            name: "now",
            type: "Date",
            what: "The render's clock, passed to every bird for its look.",
          },
        ]}
      >
        <p>
          Both draw into a <Code>Scene</Code>, in scene units. The wires come
          from <Code>aviary.wires</Code> in config order, the fence from{" "}
          <Code>aviary.fence</Code>. Birds are spread evenly from the column
          edge, {columnEdgeFor(sceneWidth)} units in at full width, to the right
          margin, at most 340 units apart on a wire and 205 on the fence, and
          turned to face the middle. Where each name sits comes from{" "}
          <Code>namePlace</Code>, by its index and how far apart its neighbours
          are. Splitting a crowded wire over two rows, the arrival and hover
          tips belong to <Code>AviaryView</Code>, which draws the same pieces:{" "}
          <Code>PaintedName</Code> behind everything, cut round the birds it is
          given, then <Code>WireLine</Code> and <Code>FenceRail</Code>, the
          birds, and <Code>WireTally</Code> and <Code>FenceCount</Code> in
          front.
        </p>
      </Usage>
    </>
  );
}
