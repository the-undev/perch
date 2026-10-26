// The camera: the app's whole navigation. Zoomed in it is the aviary; opening a bird pulls the
// camera back, the sky collapsing into a strip that shows the bird's own wire while its wire-mates
// fly there, and the detail rises beneath. The header's tabs, in the scene's own order, are the
// only switcher: The Aviary, one tab per wire, On the fence. Each wire tab remembers the bird last
// open on it. The brand, The Aviary and Escape ride the camera home. The header's last word leaves
// for the settings page.
//
// Where the camera points is the caller's: it arrives as `place` and every move leaves through
// `onNavigate`, so an app can bind it to its router.

import type {
  Aviary,
  Bird,
  LaunchAction,
  Mood,
} from "@perch/core/viewmodel.ts";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  layoutAviary,
  type PlacedBird,
  pixelsPerUnit,
  placedBirds,
  toPixels,
} from "./aviary-layout.ts";
import { AviaryScene, sourceErrorWords } from "./aviary-view.tsx";
import { BirdFigure, birdLook, type Facing } from "./bird.tsx";
import { DetailView, type EntryControls } from "./detail-view.tsx";
import {
  type PixelSize,
  useElementSize,
  usePrefersReducedMotion,
} from "./hooks.ts";
import type { KeyFileSheet } from "./paper.tsx";
import { sceneWidth, skyBackground } from "./scene.tsx";
import { isNight, type SkyPhase, skyPhase } from "./sky.ts";
import { agoWords } from "./time.ts";
import { byPosition, facingAt, namePlace, Tally, tallyGap } from "./wire.tsx";

/** Where the camera points: the whole aviary, or one bird's detail page, its papers unfolded or not. */
export type CameraPlace =
  | { at: "aviary" }
  | { at: "detail"; birdId: string; papers: boolean };

/** A header tab: the aviary, one wire, or the fence. */
export type CameraTab =
  | { kind: "aviary"; label: string }
  | { kind: "wire"; label: string; birds: Bird[] }
  | { kind: "fence"; label: string; birds: Bird[] };

/** A tab that holds birds: a wire's or the fence's. */
export type BirdTab = Exclude<CameraTab, { kind: "aviary" }>;

/** The header's tabs in the scene's own order: The Aviary, the wires top to bottom, the fence. */
export function cameraTabs(aviary: Aviary): CameraTab[] {
  return [
    { kind: "aviary", label: "The Aviary" },
    ...aviary.wires.map(
      (wire): CameraTab => ({
        kind: "wire",
        label: wire.name,
        birds: byPosition(wire.birds),
      }),
    ),
    {
      kind: "fence",
      label: "On the fence",
      birds: byPosition(aviary.fence.birds),
    },
  ];
}

/** The key a tab remembers its last-open bird under. */
function memoryKey(tab: CameraTab): string {
  return tab.kind === "wire" ? `wire:${tab.label}` : tab.kind;
}

/** The tab a bird belongs to: its wire's, or the fence's. */
function tabOf(tabs: CameraTab[], bird: Bird): BirdTab | undefined {
  return tabs
    .filter((tab): tab is BirdTab => tab.kind !== "aviary")
    .find((tab) => tab.birds.some((candidate) => candidate.id === bird.id));
}

/**
 * Where pressing a tab goes: home for The Aviary; for a wire or the fence, the bird last open
 * there while it still sits there, else the leftmost, which needs attention first. Null for a
 * wire with no birds, whose tab says "empty" and cannot be pressed.
 */
export function tabDestination(
  tab: CameraTab,
  remembered: Record<string, string>,
): CameraPlace | null {
  if (tab.kind === "aviary") return { at: "aviary" };
  const last = remembered[memoryKey(tab)];
  const bird =
    tab.birds.find((candidate) => candidate.id === last) ?? tab.birds[0];
  return bird === undefined
    ? null
    : { at: "detail", birdId: bird.id, papers: false };
}

function findBird(aviary: Aviary, id: string): Bird | undefined {
  return [
    ...aviary.wires.flatMap((wire) => wire.birds),
    ...aviary.fence.birds,
  ].find((bird) => bird.id === id);
}

// The strip: the open bird's wire as a tab row, in its own units, 2000 by 198.

/** The strip's height in pixels and in its own units: it is drawn at most at full size. */
export const stripHeight = 198;

/** The wire's line in the strip, and the size its birds are drawn at, smaller on the fence. */
const stripWireY = 150;
const stripScale = { wire: 1, fence: 0.8 };

/** How far apart birds in the strip sit: at most 175, inside a 200 margin. */
function stripSpacing(count: number): number {
  return Math.min(175, (sceneWidth - 400) / Math.max(count - 1, 1));
}

/** The x of the index-th of count birds in the strip, the row centred. */
function stripX(index: number, count: number): number {
  const span = stripSpacing(count) * (count - 1);
  return (sceneWidth - span) / 2 + stripSpacing(count) * index;
}

/** A strip bird's near baseline, beneath its perch: the lower one still clears the strip's foot. */
const stripNameDrop = 22;

/** The strip's name sizes, full and a step smaller. */
const stripNameSize = { full: "text-[13px]", small: "text-[11.5px]" };

/** A point and a bird's drawn scale, in pixels, for a flight's ends. */
interface FlightEnd {
  x: number;
  y: number;
  scale: number;
}

interface Flight {
  bird: Bird;
  dim: boolean;
  facing: Facing;
  from: FlightEnd;
  to: FlightEnd;
}

/** A bird's perch in the aviary, in pixels from the scene's top left, at its drawn scale. */
function aviaryEnd(
  placed: PlacedBird,
  layout: ReturnType<typeof layoutAviary>,
  size: PixelSize,
): FlightEnd {
  const at = toPixels(
    { x: placed.x, y: placed.y - 3 * placed.scale },
    layout,
    size,
  );
  return { ...at, scale: placed.scale * pixelsPerUnit(layout, size) };
}

/** A bird's perch in the strip, in pixels, the strip centred across the window's width. */
function stripEnd(
  index: number,
  count: number,
  dim: boolean,
  width: number,
): FlightEnd {
  const k = Math.min(width / sceneWidth, 1);
  const base = dim ? stripScale.fence : stripScale.wire;
  return {
    x: (width - sceneWidth * k) / 2 + stripX(index, count) * k,
    y: (stripHeight - stripHeight * k) / 2 + (stripWireY - 3 * base) * k,
    scale: base * k,
  };
}

/** The flights of a tab's birds between the aviary and the strip, outwards or home. */
function flightsFor(
  tab: BirdTab,
  aviary: Aviary,
  size: PixelSize,
  outwards: boolean,
): Flight[] {
  const layout = layoutAviary(aviary, size);
  const placed = placedBirds(layout);
  const dim = tab.kind === "fence";
  return tab.birds.flatMap((bird, index) => {
    const perch = placed.find((entry) => entry.bird.id === bird.id);
    if (perch === undefined) return [];
    const inAviary = aviaryEnd(perch, layout, size);
    const inStrip = stripEnd(index, tab.birds.length, dim, size.width);
    return [
      {
        bird,
        dim,
        facing: outwards
          ? facingAt(stripX(index, tab.birds.length), sceneWidth)
          : perch.facing,
        from: outwards ? inAviary : inStrip,
        to: outwards ? inStrip : inAviary,
      },
    ];
  });
}

const flightMs = 850;
const flightEasing = "cubic-bezier(0.4, 0, 0.2, 1)";

function flightTransform(end: FlightEnd): string {
  return `translate(${end.x - 50}px, ${end.y - 62}px) scale(${end.scale})`;
}

/** One bird in flight, drawn above everything, gone when it lands. */
function Flyer({
  flight,
  night,
  onLanded,
}: {
  flight: Flight;
  night: boolean;
  onLanded: (flight: Flight) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const animation = element.animate(
      [
        { transform: flightTransform(flight.from) },
        { transform: flightTransform(flight.to) },
      ],
      { duration: flightMs, easing: flightEasing, fill: "forwards" },
    );
    animation.finished.then(
      () => onLanded(flight),
      () => {},
    );
    return () => animation.cancel();
  }, [flight, onLanded]);
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      data-flyer={flight.bird.id}
      viewBox="-50 -62 100 70"
      width={100}
      height={70}
      className="absolute top-0 left-0 overflow-visible"
      style={{
        transformOrigin: "50px 62px",
        transform: flightTransform(flight.from),
      }}
    >
      <g transform={`scale(${flight.facing === "right" ? 1 : -1} 1)`}>
        <BirdFigure
          look={birdLook(flight.bird, night)}
          id={flight.bird.id}
          speaking={false}
          idle
        />
      </g>
    </svg>
  );
}

/** The open bird's wire as the tab row: its name big, its birds small, the open one bright. */
function Strip({
  tab,
  openId,
  night,
  onOpen,
}: {
  tab: BirdTab;
  openId: string;
  night: boolean;
  onOpen: (bird: Bird) => void;
}) {
  const dim = tab.kind === "fence";
  const base = dim ? stripScale.fence : stripScale.wire;
  const spacing = stripSpacing(tab.birds.length);
  return (
    <svg
      viewBox={`0 0 ${sceneWidth} ${stripHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 block h-full w-full"
    >
      <title>{`${tab.label}, as a tab row`}</title>
      {dim ? (
        <line
          x1={0}
          y1={stripWireY}
          x2={sceneWidth}
          y2={stripWireY}
          stroke="var(--color-post)"
          strokeWidth={5}
        />
      ) : (
        <path
          d={`M -20 ${stripWireY} Q ${sceneWidth / 2} ${stripWireY + 8} ${sceneWidth + 20} ${stripWireY}`}
          stroke="var(--color-wire)"
          strokeWidth={3}
          fill="none"
        />
      )}
      <text x={36} y={56} className="fill-ink-faint font-body text-[13px]">
        <tspan className="fill-ink font-bold font-display text-[30px] tracking-[-0.01em]">
          {tab.label}
        </tspan>
        {dim ? (
          <tspan dx={tallyGap}>{tab.birds.length} not adopted</tspan>
        ) : (
          <Tally birds={tab.birds} />
        )}
      </text>
      {tab.birds.map((bird, index) => {
        const x = stripX(index, tab.birds.length);
        const face = facingAt(x, sceneWidth) === "right" ? 1 : -1;
        const open = bird.id === openId;
        const name = namePlace(index, spacing, stripNameDrop);
        return (
          // biome-ignore lint/a11y/useSemanticElements: an svg group cannot be a button element.
          <g
            key={bird.id}
            role="button"
            tabIndex={0}
            aria-label={`Open ${bird.name}`}
            aria-current={open ? "page" : undefined}
            data-strip-bird={bird.id}
            transform={`translate(${x} ${stripWireY - 3 * base})`}
            className={`group cursor-pointer outline-none transition-opacity ${open ? "" : "opacity-55 hover:opacity-100"}`}
            onClick={() => onOpen(bird)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onOpen(bird);
            }}
          >
            <g transform={`scale(${base * face} ${base})`}>
              <BirdFigure
                look={birdLook(bird, night)}
                id={bird.id}
                speaking={false}
                idle
              />
            </g>
            <text
              y={name.drop}
              textAnchor="middle"
              data-name-size={name.size}
              className={`font-body font-medium ${stripNameSize[name.size]} group-hover:fill-ink group-focus-visible:fill-ink group-focus-visible:underline ${dim ? "fill-ink-fence" : "fill-ink-muted"}`}
            >
              {bird.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const totalTone: Record<Mood, { word: string; className: string }> = {
  distressed: { word: "attention", className: "text-red" },
  restless: { word: "drifting", className: "text-amber" },
  content: { word: "settled", className: "text-green" },
};

/** The header's totals over every adopted bird: how many need attention, drift, or are settled. */
function Totals({ aviary }: { aviary: Aviary }) {
  const adopted = aviary.wires.flatMap((wire) => wire.birds);
  const moods: Mood[] = ["distressed", "restless", "content"];
  return (
    <div className="flex gap-4 font-semibold text-[13px]">
      {moods.map((mood) => (
        <span key={mood} className={totalTone[mood].className}>
          {adopted.filter((bird) => bird.mood === mood).length}{" "}
          {totalTone[mood].word}
        </span>
      ))}
    </div>
  );
}

/**
 * The phase and the scan's moment and age at the header's right, quietly saying when a scan is
 * running, with any sources the scan could not read. Pressing the scan line scans now.
 */
function ScanLine({
  aviary,
  now,
  phase,
  scanning,
  onRescan,
}: {
  aviary: Aviary;
  now: Date;
  phase: SkyPhase;
  scanning: boolean;
  onRescan: () => void;
}) {
  const time = new Date(aviary.scannedAt).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const failing = aviary.sourceErrors.length;
  return (
    <div className="ml-auto flex items-baseline gap-2 text-[12px] text-ink-faint">
      {scanning && (
        <span role="status" className="motion-safe:animate-pulse">
          scanning
        </span>
      )}
      <button
        type="button"
        title="Scan now"
        disabled={scanning}
        onClick={onRescan}
        className="cursor-pointer hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink-accent disabled:cursor-default disabled:hover:text-ink-faint"
      >
        {phase}, scanned {time}, {agoWords(aviary.scannedAt, now)}
      </button>
      {failing > 0 && (
        <span
          className="text-amber"
          title={aviary.sourceErrors
            .map((error) => sourceErrorWords(error, now))
            .join("\n")}
        >
          {failing} {failing === 1 ? "source" : "sources"} not read
        </span>
      )}
    </div>
  );
}

export interface CameraViewProps {
  aviary: Aviary;
  /** The render's clock: the sky's phase and every age are read from it. */
  now: Date;
  /** Where the camera points; the caller holds it, so it can live in a router. */
  place: CameraPlace;
  /** Every move the camera is asked to make: a tab, a bird, the brand or Escape. */
  onNavigate: (place: CameraPlace) => void;
  onLaunch: (action: LaunchAction) => void;
  /** The open bird's key files with what was read from each; empty until read. */
  sheets: KeyFileSheet[];
  /** A scan is running; the header says so quietly. */
  scanning: boolean;
  /** The header's scan line was pressed: scan now. */
  onRescan: () => void;
  /** The header's settings control was pressed. */
  onSettings: () => void;
  /** Adopting the open bird or amending its papers, from its detail page. */
  entry: EntryControls;
  /** The main process's problems, which the open bird's papers show. */
  problems: string[];
}

/** Until the first measurement the camera assumes a small monitor's window. */
const assumedSize: PixelSize = { width: 1400, height: 800 };

/** The whole app view: header tabs, the aviary or the strip, and the detail beneath. */
export function CameraView({
  aviary,
  now,
  place,
  onNavigate,
  onLaunch,
  sheets,
  scanning,
  onRescan,
  onSettings,
  entry,
  problems,
}: CameraViewProps) {
  const phase = skyPhase(now);
  const night = isNight(phase);
  const tabs = cameraTabs(aviary);
  const bird =
    place.at === "detail" ? findBird(aviary, place.birdId) : undefined;
  const zoomed = bird === undefined;
  const mainRef = useRef<HTMLElement>(null);
  const size = useElementSize(mainRef, assumedSize);
  const reduce = usePrefersReducedMotion();

  // What the camera remembers between places: the bird last open, which stays on the ground as
  // the camera rides home, and the bird last open under each tab.
  const [shownId, setShownId] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<Record<string, string>>({});
  const [wasZoomed, setWasZoomed] = useState(zoomed);
  const [flights, setFlights] = useState<Flight[]>([]);
  const shown =
    bird ?? (shownId === null ? undefined : findBird(aviary, shownId));
  const shownTab = shown === undefined ? undefined : tabOf(tabs, shown);

  if (bird !== undefined && bird.id !== shownId) setShownId(bird.id);
  const birdTab = bird === undefined ? undefined : tabOf(tabs, bird);
  if (
    bird !== undefined &&
    birdTab !== undefined &&
    remembered[memoryKey(birdTab)] !== bird.id
  ) {
    setRemembered({ ...remembered, [memoryKey(birdTab)]: bird.id });
  }
  if (zoomed !== wasZoomed) {
    setWasZoomed(zoomed);
    const flyingTab = zoomed ? shownTab : birdTab;
    setFlights(
      reduce || flyingTab === undefined
        ? []
        : flightsFor(flyingTab, aviary, size, !zoomed),
    );
  }

  const landed = useCallback(
    (flight: Flight) =>
      setFlights((current) => current.filter((entry) => entry !== flight)),
    [],
  );

  useEffect(() => {
    if (zoomed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onNavigate({ at: "aviary" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed, onNavigate]);

  const home = () => onNavigate({ at: "aviary" });
  const currentTab = zoomed ? tabs[0] : birdTab;

  return (
    <div
      data-phase={phase}
      className="flex h-full w-full flex-col overflow-hidden bg-bg text-ink"
    >
      <header className="relative z-40 flex h-13.5 flex-none items-center gap-4.5 border-edge border-b bg-rail px-5">
        <button
          type="button"
          onClick={home}
          className="cursor-pointer font-bold font-display text-[19px] text-ink hover:text-ink-accent"
        >
          perch
        </button>
        <nav
          aria-label="The camera"
          className="flex gap-1 rounded-full border border-edge bg-band p-0.75"
        >
          {tabs.map((tab) => {
            const destination = tabDestination(tab, remembered);
            if (destination === null) {
              return (
                <span
                  key={memoryKey(tab)}
                  data-empty-tab=""
                  className="cursor-default px-4 py-1.5 font-semibold text-[12.5px] text-ink-faint"
                >
                  {tab.label}{" "}
                  <span className="font-normal text-ink-faint/80">empty</span>
                </span>
              );
            }
            const on = tab === currentTab;
            return (
              <button
                key={memoryKey(tab)}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => onNavigate(destination)}
                className={
                  on
                    ? "cursor-pointer rounded-full bg-panel-hi px-4 py-1.5 font-semibold text-[12.5px] text-ink"
                    : "cursor-pointer rounded-full px-4 py-1.5 font-semibold text-[12.5px] text-ink-muted transition-colors hover:text-ink"
                }
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        <Totals aviary={aviary} />
        <ScanLine
          aviary={aviary}
          now={now}
          phase={phase}
          scanning={scanning}
          onRescan={onRescan}
        />
        <button
          type="button"
          onClick={onSettings}
          className="cursor-pointer text-[12px] text-ink-faint hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink-accent"
        >
          settings
        </button>
      </header>
      <main ref={mainRef} className="relative min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <div
            data-part="sky"
            className="relative flex-none overflow-hidden transition-[height] duration-850 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
            style={{
              height: zoomed ? "100%" : stripHeight,
              background: skyBackground,
            }}
          >
            <div
              data-part="aviary"
              inert={!zoomed}
              className="absolute top-0 left-0 transition-opacity duration-300 motion-reduce:transition-none"
              style={{
                width: size.width,
                height: size.height,
                opacity: zoomed ? 1 : 0,
                transitionDelay: zoomed ? "500ms" : "0ms",
              }}
            >
              <AviaryScene
                aviary={aviary}
                now={now}
                size={size}
                onLaunch={onLaunch}
                onFullStory={(chosen) =>
                  onNavigate({ at: "detail", birdId: chosen.id, papers: false })
                }
                onAdopt={(chosen) =>
                  onNavigate({ at: "detail", birdId: chosen.id, papers: true })
                }
              />
            </div>
            <div
              data-part="strip"
              inert={zoomed}
              className="absolute inset-x-0 top-0 transition-opacity duration-250 motion-reduce:transition-none"
              style={{
                height: stripHeight,
                opacity: zoomed ? 0 : 1,
                transitionDelay: zoomed ? "0ms" : "620ms",
              }}
            >
              {shown !== undefined && shownTab !== undefined && (
                <Strip
                  tab={shownTab}
                  openId={shown.id}
                  night={night}
                  onOpen={(chosen) =>
                    onNavigate({
                      at: "detail",
                      birdId: chosen.id,
                      papers: false,
                    })
                  }
                />
              )}
            </div>
          </div>
          <div
            data-part="ground"
            inert={zoomed}
            className="min-h-0 flex-1 overflow-y-auto border-horizon border-t-2 bg-ground px-7.5 pt-5.5 pb-11"
          >
            {shown !== undefined && (
              <div
                className={`transition-[translate,opacity] duration-550 ease-[cubic-bezier(0.25,0.9,0.3,1)] motion-reduce:transition-none ${zoomed ? "translate-y-14 opacity-0 delay-0" : "delay-350"}`}
              >
                <DetailView
                  key={shown.id}
                  bird={shown}
                  now={now}
                  onLaunch={onLaunch}
                  sheets={sheets}
                  entry={entry}
                  problems={problems}
                  openPapers={place.at === "detail" && place.papers}
                />
              </div>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 z-30">
          {flights.map((flight) => (
            <Flyer
              key={flight.bird.id}
              flight={flight}
              night={night}
              onLanded={landed}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
