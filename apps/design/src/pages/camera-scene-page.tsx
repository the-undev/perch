import { mockAviary } from "@perch/core/mock.ts";
import { type CameraPlace, CameraView } from "@perch/ui/camera.tsx";
import { useState } from "react";
import { birdSheets } from "../key-files.ts";
import { aviaryWith, mockBird, mockEntryForm } from "../specimens.ts";
import {
  Choice,
  Code,
  Pressed,
  SceneFrame,
  Section,
  Usage,
} from "../usage.tsx";
import { clockFor, clockOptions } from "./aviary-scene-page.tsx";

type Clock = Parameters<typeof clockFor>[0];

type Scanning = "idle" | "scanning";

type Wires = "mock" | "withEmpty";

const wiresOptions: { value: Wires; label: string }[] = [
  { value: "mock", label: "The mock's" },
  { value: "withEmpty", label: "With an empty wire" },
];

/** The mock aviary with a configured wire no bird sits on yet. */
const withEmptyWire = aviaryWith([
  ...mockAviary.wires,
  { name: "Servers", birds: [] },
]);

const scanningOptions: { value: Scanning; label: string }[] = [
  { value: "idle", label: "Idle" },
  { value: "scanning", label: "Scanning" },
];

function placeWords(place: CameraPlace): string {
  return place.at === "aviary"
    ? "{ at: aviary }"
    : `{ at: detail, birdId: ${place.birdId}, papers: ${place.papers} }`;
}

export function CameraScenePage() {
  const [place, setPlace] = useState<CameraPlace>({ at: "aviary" });
  const [clock, setClock] = useState<Clock>("clock");
  const [scanning, setScanning] = useState<Scanning>("idle");
  const [wires, setWires] = useState<Wires>("mock");
  const [pressed, setPressed] = useState("nothing yet");
  const sheets =
    place.at === "detail" ? birdSheets(mockBird(place.birdId)) : [];
  return (
    <>
      <Section
        title="The camera, end to end"
        rule="Click a bird and press Tell me the full story: the camera pulls back, the sky collapses into a strip of the bird's own wire as its wire-mates fly there, and the detail rises beneath. The strip is 124px: the wire's name is painted on the sky behind the line's left end, cut round the birds that cross it, the tally beneath in front, and the birds, standing at their wire size, centre in the room right of the 240-unit column, the open one bright. Pressing another bird in the strip, or any move from one bird's page to another, pans the ground under the still strip: the old page slides out as the chosen bird's slides in, from the right for a bird further along the strip or on a later tab, from the left otherwise, and instantly with reduced motion. The header's tabs switch wires; each remembers the bird last open on it, and an empty wire's tab says so. The brand, The Aviary and Escape ride home. The scan line at the right says how old the scan is and scans again when pressed; settings, beside it, leaves for the settings page."
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
            options={scanningOptions}
            value={scanning}
            onChange={setScanning}
          />
          <Choice
            label="Wires"
            options={wiresOptions}
            value={wires}
            onChange={setWires}
          />
          <p className="m-0 text-[12.5px] text-ink-faint">
            place:{" "}
            <code className="font-mono text-ink-muted">
              {placeWords(place)}
            </code>
          </p>
        </div>
      </Section>
      <SceneFrame height="max(640px, calc(100vh - 260px))">
        <CameraView
          aviary={wires === "mock" ? mockAviary : withEmptyWire}
          now={clockFor(clock)}
          place={place}
          onNavigate={(next) => {
            setPressed(`onNavigate(${placeWords(next)})`);
            setPlace(next);
          }}
          onLaunch={(action) => setPressed(`onLaunch(${action.verb})`)}
          sheets={sheets}
          scanning={scanning === "scanning"}
          onRescan={() => setPressed("onRescan()")}
          onSettings={() => setPressed("onSettings()")}
          onLocalSources={() => setPressed("onLocalSources()")}
          onCopy={async (text) => setPressed(`onCopy(${text})`)}
          entry={{
            form: place.at === "detail" ? mockEntryForm(place.birdId) : null,
            onSave: (birdId) => setPressed(`entry.onSave(${birdId})`),
            onRemove: (birdId) => setPressed(`entry.onRemove(${birdId})`),
          }}
          problems={[]}
        />
      </SceneFrame>
      <Pressed text={pressed} />

      <Usage
        component="<CameraView>"
        props={[
          {
            name: "aviary",
            type: "Aviary",
            what: "The whole view model.",
          },
          {
            name: "now",
            type: "Date",
            what: "The render's clock, for the sky, sleep and every age.",
          },
          {
            name: "place",
            type: '{ at: "aviary" } | { at: "detail"; birdId: string; papers: boolean }',
            what: "Where the camera points. The caller holds it; a bird the aviary no longer holds shows the aviary.",
          },
          {
            name: "onNavigate",
            type: "(place: CameraPlace) => void",
            what: "Every move: a tab, a strip bird, a bubble's full story, the brand, Escape.",
          },
          {
            name: "onLaunch",
            type: "(action: LaunchAction) => void",
            what: "A launch action was pressed, in a bubble or on the detail page.",
          },
          {
            name: "sheets",
            type: "KeyFileSheet[]",
            what: "The open bird's key files with what was read from each.",
          },
          {
            name: "scanning",
            type: "boolean",
            what: "A scan is running: the header says scanning, quietly, and its scan line waits.",
          },
          {
            name: "onRescan",
            type: "() => void",
            what: "The header's scan line, which reads the phase, the scan's time and its age, was pressed.",
          },
          {
            name: "onSettings",
            type: "() => void",
            what: "The header's last word, settings, was pressed: the app leaves for its settings page.",
          },
          {
            name: "onLocalSources",
            type: "() => void",
            what: "A no-clone slip's Open Sources was pressed: the app opens the settings page on Sources, the local cards unfolded.",
          },
          {
            name: "onCopy",
            type: "(text: string) => Promise<void>",
            what: "A no-clone slip's Copy was pressed: the app puts the clone address on the clipboard.",
          },
          {
            name: "entry",
            type: "EntryControls",
            what: "The open bird's entry form and the calls that save or remove its entry, for the detail page's papers.",
          },
          {
            name: "problems",
            type: "string[]",
            what: "The main process's problems, a refused write among them, which the open bird's papers show above their signature.",
          },
        ]}
      >
        <p>
          Navigation is a controlled prop so the desktop app can bind{" "}
          <Code>place</Code> to its router: this page holds it in state and
          prints it above. What the camera keeps for itself is the bird last
          open under each tab, and the bird left on the ground while it rides
          home. Tabs follow <Code>cameraTabs(aviary)</Code>; a wire with no
          birds keeps its tab, which says empty and cannot be pressed. The
          ground beneath the strip never scrolls: the bird&apos;s page fills it,
          and only its record and paper panes move their contents.{" "}
          <Code>stripLayout(tab, width)</Code> places the strip&apos;s birds in
          a strip as many units wide as the aviary&apos;s scene in the same
          window, from the same column edge as the aviary&apos;s wires, and the
          flights land on the same places.
        </p>
      </Usage>
    </>
  );
}
