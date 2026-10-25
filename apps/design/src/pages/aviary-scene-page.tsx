import { mockAviary } from "@perch/core/mock.ts";
import type { Aviary } from "@perch/core/viewmodel.ts";
import { AviaryView } from "@perch/ui/aviary-view.tsx";
import type { SkyPhase } from "@perch/ui/sky.ts";
import { useState } from "react";
import { withHelloAdopted } from "../specimens.ts";
import {
  Choice,
  Code,
  Pressed,
  SceneFrame,
  Section,
  Usage,
} from "../usage.tsx";

type Clock = "clock" | SkyPhase;

/** An hour inside each phase on the mock scan's day, local time. */
const phaseHour: Record<SkyPhase, number> = {
  dawn: 7,
  day: 12,
  dusk: 18,
  night: 23,
};

/** The render's clock: the real one, or an hour on the scan's day that sets a phase. */
export function clockFor(clock: Clock): Date {
  return clock === "clock"
    ? new Date()
    : new Date(2026, 9, 22, phaseHour[clock], 0);
}

export const clockOptions: { value: Clock; label: string }[] = [
  { value: "clock", label: "Follow the clock" },
  { value: "dawn", label: "Dawn" },
  { value: "day", label: "Day" },
  { value: "dusk", label: "Dusk" },
  { value: "night", label: "Night" },
];

type Scan = "mock" | "adopted";

const scans: Record<Scan, Aviary> = {
  mock: mockAviary,
  adopted: withHelloAdopted(),
};

export function AviaryScenePage() {
  const [clock, setClock] = useState<Clock>("clock");
  const [scan, setScan] = useState<Scan>("mock");
  const [flight, setFlight] = useState(0);
  const [pressed, setPressed] = useState("nothing yet");
  return (
    <>
      <Section
        title="The whole scene"
        rule="The sky follows the clock; the wires stack in config order with a crowded wire over two rows; the fence sits beneath. Hover a bird for its tip, click it to hear from it, press Escape or the open sky to close the bubble. Failing sources and the scan's warnings sit top left in the sky."
        min={600}
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Choice
            label="Sky"
            options={clockOptions}
            value={clock}
            onChange={setClock}
          />
          <Choice
            label="Scan"
            options={[
              { value: "mock", label: "The mock scan" },
              { value: "adopted", label: "Hello adopted onto Projects" },
            ]}
            value={scan}
            onChange={setScan}
          />
          <button
            type="button"
            onClick={() => setFlight(flight + 1)}
            className="cursor-pointer rounded-full border border-edge px-3.5 py-1.25 font-semibold text-[12.5px] text-ink-muted hover:border-edge-hi hover:text-ink"
          >
            Fly in again
          </button>
        </div>
      </Section>
      <SceneFrame height="max(560px, calc(100vh - 300px))">
        <AviaryView
          key={flight}
          aviary={scans[scan]}
          now={clockFor(clock)}
          onLaunch={(action) => setPressed(action.verb)}
          onFullStory={(bird) =>
            setPressed(`${bird.name}: Tell me the full story`)
          }
          onAdopt={(bird) => setPressed(`${bird.name}: Adopt`)}
        />
      </SceneFrame>
      <Pressed text={pressed} />

      <Usage
        component="<AviaryView>"
        props={[
          {
            name: "aviary",
            type: "Aviary",
            what: "deriveAviary(snapshot, config): the wires top to bottom, the fence, failing sources and warnings.",
          },
          {
            name: "now",
            type: "Date",
            what: "The render's clock. The sky's phase, sleep, and every age in the tips and notices read from it.",
          },
          {
            name: "onLaunch",
            type: "(action: LaunchAction) => void",
            what: "A bubble's launch action was pressed; the app asks the main process to open it.",
          },
          {
            name: "onFullStory",
            type: "(bird: Bird) => void",
            what: "A bubble's Tell me the full story was pressed; the camera rides down to the bird.",
          },
          {
            name: "onAdopt",
            type: "(bird: Bird) => void",
            what: "A fence bird's bubble's Adopt was pressed; the camera rides down to the bird with its adoption papers unfolded. An adopted bird's bubble has no adopt key.",
          },
        ]}
      >
        <p>
          The view fills its parent and lays itself out from its measured size:
          the scene keeps the window&apos;s aspect, the top wire leaves room
          above it for a bubble, and the fence keeps a fixed distance from the
          bottom. <Code>layoutAviary(aviary, size)</Code> in{" "}
          <Code>@perch/ui/aviary-layout.ts</Code> holds every placement rule.
        </p>
        <p>
          The arrival runs on mount, landing the worst first and the fence last.
          It runs again when a scan changes who sits on which wire or on the
          fence (switch the scan above); a bird that only moves along its wire
          glides to its new place. With reduced motion asked for, nothing flies
          or glides. The bubble&apos;s selection is the view&apos;s own state;
          inside the app, use <Code>CameraView</Code>, which holds this scene.
        </p>
      </Usage>
    </>
  );
}
