import { Scene, sceneWidth } from "@perch/ui/scene.tsx";
import type { SkyPhase } from "@perch/ui/sky.ts";
import { Wire } from "@perch/ui/wire.tsx";
import { mockWire } from "../specimens.ts";
import { Code, Section, Specimen, Usage } from "../usage.tsx";

const phases: { phase: SkyPhase; at: Date; rule: string }[] = [
  {
    phase: "dawn",
    at: new Date(2026, 9, 22, 7, 0),
    rule: "6 to 9: a low sun, warm horizon, the last stars.",
  },
  {
    phase: "day",
    at: new Date(2026, 9, 22, 12, 0),
    rule: "9 to 17: the sun, a lighter sky, no stars.",
  },
  {
    phase: "dusk",
    at: new Date(2026, 9, 22, 18, 0),
    rule: "17 to 21: the moon rises, stars come out.",
  },
  {
    phase: "night",
    at: new Date(2026, 9, 22, 22, 30),
    rule: "21 to 6: the darkest sky, more stars. Birds keep their own hours and sleep only from midnight, so at half past ten they are awake.",
  },
];

export function SkyPage() {
  const wire = mockWire("Machine & Home");
  return (
    <>
      <Section
        title="The sky · the scene is live"
        rule="The sky follows the real clock: four phases by the local hour. Nothing changes functionally; no fact is ever hidden for atmosphere."
        min={620}
      >
        {phases.map(({ phase, at, rule }) => (
          <Specimen key={phase} label={phase} rule={rule}>
            <Scene
              phase={phase}
              width={sceneWidth}
              height={420}
              label={`The sky at ${phase}`}
            >
              <Wire wire={wire} y={320} width={sceneWidth} now={at} />
            </Scene>
          </Specimen>
        ))}
      </Section>

      <Usage
        component="<Scene>"
        props={[
          {
            name: "phase",
            type: "SkyPhase",
            what: "dawn, day, dusk or night; skyPhase(date) computes it from a Date you pass.",
          },
          {
            name: "height",
            type: "number",
            what: "The scene's height in scene units; the width is always 2000.",
          },
          {
            name: "label",
            type: "string",
            what: "What the scene shows, for assistive technology.",
          },
          {
            name: "children",
            type: "ReactNode",
            what: "Wires, the fence and birds, drawn in scene units.",
          },
        ]}
      >
        <p>
          The view model carries no time. The caller reads the clock, calls{" "}
          <Code>skyPhase(new Date())</Code> from <Code>@perch/ui/sky.ts</Code>,
          and passes the phase to the scene and the time to the birds, which
          sleep by their own hours. The scene sets <Code>data-phase</Code>,
          which redefines the sky tokens for everything inside it, and scales
          its drawing to its width.
        </p>
      </Usage>
    </>
  );
}
