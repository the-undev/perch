// The camera: the app's whole navigation. Zoomed in it is the aviary; opening a bird pulls the
// camera back, the sky collapsing into a strip that shows the bird's own wire while its wire-mates
// fly there, and the detail rises beneath. The header's tabs, in the scene's own order, are the
// only switcher: The Aviary, one tab per wire, On the fence. Each wire tab remembers the bird last
// open on it. Moving from one bird's page to another pans the ground under the still strip, the
// page left sliding out as the chosen bird's slides in. The brand, The Aviary and Escape ride the
// camera home. The header's last word leaves for the settings page.
//
// Where the camera points is the caller's: it arrives as `place` and every move leaves through
// `onNavigate`, so an app can bind it to its router.

import type {
  Aviary,
  Bird,
  ChipKind,
  LaunchAction,
  Mood,
} from "@perch/core/viewmodel.ts";
import {
  type ReactNode,
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
import { sceneWidthFor, skyBackground } from "./scene.tsx";
import { isNight, type SkyPhase, skyPhase } from "./sky.ts";
import { recentWords } from "./time.ts";
import {
  byPosition,
  columnEdge,
  edgeMargin,
  labelX,
  namePlace,
  PaintedName,
  placeAt,
  placeSpacing,
  Tally,
  tallyText,
} from "./wire.tsx";

/**
 * Where the camera points: the whole aviary, or one bird's detail page, its papers unfolded or
 * not, and the chip pressed in its aviary bubble, whose ledger row the page lands on.
 */
export type CameraPlace =
  | { at: "aviary" }
  | {
      at: "detail";
      birdId: string;
      papers: boolean;
      chip: ChipKind | null;
    };

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
    : { at: "detail", birdId: bird.id, papers: false, chip: null };
}

function findBird(aviary: Aviary, id: string): Bird | undefined {
  return [
    ...aviary.wires.flatMap((wire) => wire.birds),
    ...aviary.fence.birds,
  ].find((bird) => bird.id === id);
}

/** Which way the camera travels between two birds' pages. */
export type PanDirection = "left" | "right";

/**
 * The way from one bird to another along the strips laid end to end in the tabs' order: right
 * towards a bird later along its wire, on a later wire or on the fence, left otherwise.
 */
export function panDirection(
  tabs: CameraTab[],
  fromId: string,
  toId: string,
): PanDirection {
  const order = tabs.flatMap((tab) =>
    tab.kind === "aviary" ? [] : tab.birds.map((bird) => bird.id),
  );
  return order.indexOf(toId) > order.indexOf(fromId) ? "right" : "left";
}

// The strip: the open bird's wire as a tab row, in its own units, 124 tall and as wide as the
// aviary's scene in the same window: 2000, or fewer below the floor. The wire's name is painted on
// the sky behind its left end, the tally beneath it in front, and the birds perch from the column.

/** The strip's height in pixels and in its own units: it is drawn at most at full size, and never below the floor. */
export const stripHeight = 124;

/** The wire's line in the strip, and the size its birds are drawn at, smaller on the fence. */
export const stripWireY = 76;
const stripScale = { wire: 1, fence: 0.8 };

/** The tally's baseline, beneath the wire's left end. */
const stripTallyY = stripWireY + 16;

/** The most birds in the strip sit apart; a crowded tab squeezes them closer. */
const stripGap = 175;

/** The tally beneath the strip's name: the wire's moods, or how many sit on the fence. */
function stripTally(tab: BirdTab): string {
  return tab.kind === "fence"
    ? `${tab.birds.length} not adopted`
    : tallyText(tab.birds);
}

/** Where the strip draws a tab: each bird's x and facing in the room right of the column. */
export interface StripLayout {
  /** The middle of the birds' room, which they are centred on and face. */
  middle: number;
  spacing: number;
  places: { bird: Bird; x: number; facing: Facing }[];
}

/**
 * The tab's layout in a strip `width` units wide: the birds are spread at most `stripGap` apart,
 * centred in the room from the column edge to the scene's edge margin, whatever the name or tally.
 */
export function stripLayout(tab: BirdTab, width: number): StripLayout {
  const count = tab.birds.length;
  const middle = columnEdge + Math.max(0, width - edgeMargin - columnEdge) / 2;
  return {
    middle,
    spacing: placeSpacing(count, stripGap, width),
    places: tab.birds.map((bird, index) => {
      const x = placeAt(index, count, stripGap, width);
      return { bird, x, facing: x < middle ? "right" : "left" };
    }),
  };
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

/** A bird's perch in the strip at x in its units, in pixels, the strip centred across the window's width. */
function stripEnd(x: number, dim: boolean, pixels: number): FlightEnd {
  const width = sceneWidthFor(pixels);
  const k = Math.min(pixels / width, 1);
  const base = dim ? stripScale.fence : stripScale.wire;
  return {
    x: (pixels - width * k) / 2 + x * k,
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
  const strip = stripLayout(tab, sceneWidthFor(size.width));
  return strip.places.flatMap(({ bird, x, facing }) => {
    const perch = placed.find((entry) => entry.bird.id === bird.id);
    if (perch === undefined) return [];
    const inAviary = aviaryEnd(perch, layout, size);
    const inStrip = stripEnd(x, dim, size.width);
    return [
      {
        bird,
        dim,
        facing: outwards ? facing : perch.facing,
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
          pose="standing"
          speaking={false}
          idle
        />
      </g>
    </svg>
  );
}

/** What a bird's page is drawn from beyond the clock and the calls; the page panned away from keeps its last. */
interface PageProps {
  bird: Bird;
  sheets: KeyFileSheet[];
  entry: EntryControls;
  problems: string[];
  openPapers: boolean;
  arrivalChip: ChipKind | null;
}

/** A page on the ground: its props, and which arrival on a bird it is, so each arrival mounts afresh. */
interface GroundPage {
  visit: number;
  props: PageProps;
}

/** A pan between birds' pages: the page left, as last drawn, and the way to the chosen bird. */
interface Pan {
  leaving: GroundPage;
  direction: PanDirection;
}

const panMs = 600;

/** The track's offset at each end of a pan: the pages sit left to right, the leaving one first when travelling right. */
function panOffsets(direction: PanDirection): { from: string; to: string } {
  return direction === "right"
    ? { from: "translateX(0%)", to: "translateX(-100%)" }
    : { from: "translateX(-100%)", to: "translateX(0%)" };
}

/** The ground's pages side by side, slid across one page's width while a pan runs and still otherwise. */
function PanTrack({
  pan,
  onSettled,
  children,
}: {
  pan: Pan | null;
  onSettled: (pan: Pan) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null || pan === null) return;
    const { from, to } = panOffsets(pan.direction);
    const animation = element.animate(
      [{ transform: from }, { transform: to }],
      { duration: panMs, easing: flightEasing, fill: "forwards" },
    );
    animation.finished.then(
      () => onSettled(pan),
      () => {},
    );
    return () => animation.cancel();
  }, [pan, onSettled]);
  return (
    <div
      ref={ref}
      data-part="pan-track"
      data-pan={pan?.direction}
      className="flex min-h-0 w-full flex-1"
      style={
        pan === null ? undefined : { transform: panOffsets(pan.direction).from }
      }
    >
      {children}
    </div>
  );
}

/** The open bird's wire as the tab row: its name painted behind, its birds from the column, the open one bright, and its tally in front. */
function Strip({
  tab,
  width,
  openId,
  night,
  flyingIds,
  onOpen,
}: {
  tab: BirdTab;
  /** The strip's width in its units: the aviary scene's in the same window. */
  width: number;
  openId: string;
  night: boolean;
  flyingIds: ReadonlySet<string>;
  onOpen: (bird: Bird) => void;
}) {
  const dim = tab.kind === "fence";
  const base = dim ? stripScale.fence : stripScale.wire;
  const layout = stripLayout(tab, width);
  return (
    <svg
      viewBox={`0 0 ${width} ${stripHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 block h-full w-full"
    >
      <title>{`${tab.label}, as a tab row`}</title>
      <PaintedName
        name={tab.label}
        end={stripWireY}
        width={width}
        cuts={layout.places
          .filter(({ bird }) => !flyingIds.has(bird.id))
          .map(({ bird, x, facing }) => ({
            id: bird.id,
            x,
            y: stripWireY,
            scale: base,
            facing,
          }))}
      />
      {dim ? (
        <line
          x1={0}
          y1={stripWireY}
          x2={width}
          y2={stripWireY}
          stroke="var(--color-post)"
          strokeWidth={5}
        />
      ) : (
        <path
          d={`M -20 ${stripWireY} Q ${width / 2} ${stripWireY + 8} ${width + 20} ${stripWireY}`}
          stroke="var(--color-wire)"
          strokeWidth={3}
          fill="none"
        />
      )}
      {layout.places.map(({ bird, x, facing }, index) => {
        const face = facing === "right" ? 1 : -1;
        const open = bird.id === openId;
        const name = namePlace(index, layout.spacing, stripNameDrop);
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
            visibility={flyingIds.has(bird.id) ? "hidden" : undefined}
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
                pose="standing"
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
      <text
        data-part="strip-tally"
        x={labelX}
        y={stripTallyY}
        className="fill-ink-faint font-body text-[13px]"
      >
        {dim ? stripTally(tab) : <Tally birds={tab.birds} />}
      </text>
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
        {phase}, scanned {time}, {recentWords(aviary.scannedAt, now)}
      </button>
      {failing > 0 && (
        <span
          className="text-amber"
          title={aviary.sourceErrors
            .map((error) => sourceErrorWords(error, now))
            .join("\n")}
        >
          couldn't read {failing} {failing === 1 ? "source" : "sources"}
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
  /** The no-clone slip's Open Sources was pressed: open the settings page on Sources, the local cards unfolded. */
  onLocalSources: () => void;
  /** Puts the no-clone slip's clone address on the clipboard, settling once it is there. */
  onCopy: (text: string) => Promise<void>;
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
  onLocalSources,
  onCopy,
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
  const [visit, setVisit] = useState(0);
  const [pan, setPan] = useState<Pan | null>(null);
  // The page as last committed, which a pan keeps drawing as it slides away: by then the caller's
  // sheets and entry are the chosen bird's.
  const lastPage = useRef<GroundPage | null>(null);
  const shown =
    bird ?? (shownId === null ? undefined : findBird(aviary, shownId));
  const shownTab = shown === undefined ? undefined : tabOf(tabs, shown);

  if (bird !== undefined && bird.id !== shownId) {
    setShownId(bird.id);
    setVisit(visit + 1);
    // Only a move from one bird's page to another pans; the zoom from the aviary keeps its swap.
    const leaving = lastPage.current;
    setPan(
      !reduce &&
        !zoomed &&
        !wasZoomed &&
        leaving !== null &&
        leaving.props.bird.id === shownId
        ? {
            leaving,
            direction: panDirection(tabs, leaving.props.bird.id, bird.id),
          }
        : null,
    );
  }
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
  const panSettled = useCallback(
    (settled: Pan) =>
      setPan((current) => (current === settled ? null : current)),
    [],
  );

  const page: GroundPage | null =
    shown === undefined
      ? null
      : {
          visit,
          props: {
            bird: shown,
            sheets,
            entry,
            problems,
            openPapers: place.at === "detail" && place.papers,
            arrivalChip: place.at === "detail" ? place.chip : null,
          },
        };
  useLayoutEffect(() => {
    lastPage.current = page;
  });

  const flyingIds = new Set(flights.map((flight) => flight.bird.id));

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
                  onNavigate({
                    at: "detail",
                    birdId: chosen.id,
                    papers: false,
                    chip: null,
                  })
                }
                onAdopt={(chosen) =>
                  onNavigate({
                    at: "detail",
                    birdId: chosen.id,
                    papers: true,
                    chip: null,
                  })
                }
                onChip={(chosen, chip) =>
                  onNavigate({
                    at: "detail",
                    birdId: chosen.id,
                    papers: false,
                    chip,
                  })
                }
                flyingIds={flyingIds}
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
                  width={sceneWidthFor(size.width)}
                  openId={shown.id}
                  night={night}
                  flyingIds={flyingIds}
                  onOpen={(chosen) =>
                    onNavigate({
                      at: "detail",
                      birdId: chosen.id,
                      papers: false,
                      chip: null,
                    })
                  }
                />
              )}
            </div>
          </div>
          <div
            data-part="ground"
            inert={zoomed}
            className="flex min-h-0 flex-1 flex-col overflow-hidden border-horizon border-t-2 bg-ground"
          >
            {page !== null && (
              <div
                className={`flex min-h-0 flex-1 flex-col transition-[translate,opacity] duration-550 ease-[cubic-bezier(0.25,0.9,0.3,1)] motion-reduce:transition-none ${zoomed ? "translate-y-14 opacity-0 delay-0" : "delay-350"}`}
              >
                <PanTrack pan={pan} onSettled={panSettled}>
                  {(pan === null
                    ? [page]
                    : pan.direction === "right"
                      ? [pan.leaving, page]
                      : [page, pan.leaving]
                  ).map((groundPage) => {
                    const leaving = groundPage === pan?.leaving;
                    return (
                      // The page left is inert and hidden from the tree while it slides away.
                      <div
                        key={groundPage.visit}
                        data-page={groundPage.props.bird.id}
                        inert={leaving}
                        aria-hidden={leaving ? "true" : undefined}
                        className="flex min-h-0 w-full flex-none flex-col px-7.5 pt-5.5"
                      >
                        <DetailView
                          {...groundPage.props}
                          now={now}
                          onLaunch={onLaunch}
                          onSettings={onSettings}
                          onLocalSources={onLocalSources}
                          onCopy={onCopy}
                          panning={pan !== null}
                        />
                      </div>
                    );
                  })}
                </PanTrack>
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
