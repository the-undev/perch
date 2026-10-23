// The home scene: the sky by the clock, the wires in config order with crowded ones over two rows,
// the fence beneath, and the birds on them. Hovering a bird shows its tip; clicking it opens its
// bubble against its beak. The flock flies in on mount and again on a large change.

import type { PolledSourceName } from "@perch/core/snapshot.ts";
import type {
  Aviary,
  Bird as BirdModel,
  LaunchAction,
  SourceError,
} from "@perch/core/viewmodel.ts";
import {
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AviaryLayout,
  arrangementKey,
  arrivalOrder,
  arrivalStepMs,
  layoutAviary,
  type PlacedBird,
  placeBubble,
  placedBirds,
  toPixels,
} from "./aviary-layout.ts";
import { Bird } from "./bird.tsx";
import { Bubble } from "./bubble.tsx";
import { type PixelSize, useElementSize } from "./hooks.ts";
import type { CustomProperties } from "./motion.ts";
import { SkyDrawing, sceneWidth, skyBackground } from "./scene.tsx";
import { isNight, skyPhase } from "./sky.ts";
import { agoWords } from "./time.ts";
import { FenceRail, WireLine } from "./wire.tsx";

/** Each polled source by name, as the scene's notices say it. */
export const sourceLabel: Record<PolledSourceName, string> = {
  local: "Local repositories",
  githubAccounts: "GitHub accounts",
  forgejoAccounts: "Forgejo accounts",
  kuma: "Uptime Kuma",
  roadmap: "Roadmaps",
  claudeSessions: "Claude sessions",
  github: "GitHub repositories",
  forgejo: "Forgejo repositories",
};

/** What a failing source says: its name, how long since it was last read, and its error. */
export function sourceErrorWords(error: SourceError, now: Date): string {
  const age =
    error.lastSucceededAt === null
      ? "never read"
      : `last read ${agoWords(error.lastSucceededAt, now)}`;
  return `${sourceLabel[error.source]} not read, ${age}`;
}

/** The hover tip's second line: the numbers the bird carries, else when it last moved. */
export function tipLine(bird: BirdModel, now: Date): string | null {
  if (bird.bubble.chips.length > 0) {
    return bird.bubble.chips.map((chip) => chip.label).join(" · ");
  }
  const lastCommit = bird.detail.ledger.find(
    (entry) => entry.kind === "time" && entry.label === "last commit",
  );
  return lastCommit?.kind === "time"
    ? `last commit ${agoWords(lastCommit.at, now)}`
    : null;
}

interface PerchedBirdProps {
  placed: PlacedBird;
  night: boolean;
  arrival: number;
  speaking: boolean;
  onSpeak: (bird: BirdModel) => void;
  onHover: (bird: BirdModel, event: PointerEvent) => void;
  onLeave: () => void;
}

/** One bird in the aviary: it lands in its turn, lifts on hover, and speaks when pressed. */
function PerchedBird({
  placed,
  night,
  arrival,
  speaking,
  onSpeak,
  onHover,
  onLeave,
}: PerchedBirdProps) {
  const { bird } = placed;
  const arrive: CustomProperties = {
    "--arrive-delay": `${arrival * arrivalStepMs}ms`,
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: an svg group cannot be a button element.
    <g
      role="button"
      tabIndex={0}
      aria-label={`${bird.name}, ${bird.bubble.stateWord}`}
      aria-pressed={speaking}
      data-arrival={arrival}
      className="group cursor-pointer outline-none"
      onClick={(event) => {
        event.stopPropagation();
        onSpeak(bird);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onSpeak(bird);
      }}
      onPointerMove={(event) => onHover(bird, event)}
      onPointerLeave={onLeave}
    >
      <g className="motion-safe:animate-arrive" style={arrive}>
        <g
          className="transition-transform duration-700 ease-in-out motion-reduce:transition-none"
          style={{ transform: `translate(${placed.x}px, ${placed.y}px)` }}
        >
          <g className="transition-[translate] duration-200 group-hover:-translate-y-1">
            <Bird
              bird={bird}
              x={0}
              y={0}
              facing={placed.facing}
              night={night}
              namePlace={placed.namePlace}
              speaking={speaking}
            />
          </g>
        </g>
      </g>
    </g>
  );
}

interface AnchoredBubbleProps {
  placed: PlacedBird;
  layout: AviaryLayout;
  size: PixelSize;
  night: boolean;
  onLaunch: (action: LaunchAction) => void;
  onFullStory: () => void;
}

/** The speaking bird's bubble, its tail tip on the beak tip. */
function AnchoredBubble({
  placed,
  layout,
  size,
  night,
  onLaunch,
  onFullStory,
}: AnchoredBubbleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const measured = ref.current?.offsetHeight ?? 0;
    if (measured !== height) setHeight(measured);
  });
  const beak = toPixels(placed.beak, layout, size);
  const placement = placeBubble(beak, placed.facing, size, height);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: stops a click inside the bubble closing it.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the bubble's own buttons carry the keyboard.
    <div
      ref={ref}
      className="absolute z-20"
      style={{
        left: placement.left,
        top: placement.top,
        width: placement.width,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <Bubble
        key={placed.bird.id}
        bubble={placed.bird.bubble}
        night={night}
        actions={placed.bird.detail.actions}
        onLaunch={onLaunch}
        onFullStory={onFullStory}
        tail={placement.tail}
      />
    </div>
  );
}

/** Where the pointer is over a bird, in pixels from the scene's top left. */
interface TipAt {
  bird: BirdModel;
  x: number;
  y: number;
}

function Tip({ tip, size, now }: { tip: TipAt; size: PixelSize; now: Date }) {
  const line = tipLine(tip.bird, now);
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 max-w-75 rounded-lg border border-tip-edge bg-tip px-3 py-2.25 text-[12.5px] text-ink-muted shadow-bubble"
      style={{
        left: Math.min(tip.x + 16, size.width - 310),
        top: Math.min(tip.y + 18, size.height - 90),
      }}
    >
      <b className="font-semibold text-ink">{tip.bird.name}</b> ·{" "}
      {tip.bird.bubble.stateWord}
      {line !== null && <div>{line}</div>}
    </div>
  );
}

/** Sources whose latest gather failed, with their age, and the scan's warnings: top left in the sky. */
function SkyNotices({ aviary, now }: { aviary: Aviary; now: Date }) {
  return (
    <div
      data-part="notices"
      className="absolute top-3 left-5 z-10 max-w-[90ch] text-[12px] leading-normal"
    >
      {aviary.sourceErrors.map((error) => (
        <p key={error.source} className="m-0 text-amber">
          {sourceErrorWords(error, now)}
          {error.error !== null && (
            <span className="text-ink-faint">: {error.error}</span>
          )}
        </p>
      ))}
      {aviary.warnings.map((warning) => (
        <p key={warning} className="m-0 text-ink-faint">
          {warning}
        </p>
      ))}
    </div>
  );
}

function Swatch({ colour }: { colour: string }) {
  return (
    <i
      className="inline-block size-2.25 rounded-full"
      style={{ background: colour }}
    />
  );
}

/** The legend along the bottom of the sky: what the colours and places mean. */
function SkyLegend() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-wrap justify-center gap-x-5 gap-y-1 px-4 text-[11px] text-ink-faint">
      <span className="inline-flex items-center gap-1.5">
        <Swatch colour="var(--color-red)" />
        attention
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch colour="var(--color-amber)" />
        drifting
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch colour="var(--color-green)" />
        settled
      </span>
      <span>
        higher wire = more important · leftmost = needs you first · plumper =
        more outstanding work · ♪ = being edited
      </span>
      <span>click a bird to hear from it</span>
    </div>
  );
}

export interface AviarySceneProps {
  aviary: Aviary;
  /** The render's clock: the sky's phase and every age are read from it. */
  now: Date;
  /** The window the scene fills, in pixels. */
  size: PixelSize;
  onLaunch: (action: LaunchAction) => void;
  /** A bubble's "Tell me the full story" was pressed. */
  onFullStory: (bird: BirdModel) => void;
}

/** The aviary drawn into a window of a known size; AviaryView measures its own. */
export function AviaryScene({
  aviary,
  now,
  size,
  onLaunch,
  onFullStory,
}: AviarySceneProps) {
  const phase = skyPhase(now);
  const night = isNight(phase);
  const layout = useMemo(() => layoutAviary(aviary, size), [aviary, size]);
  const placed = useMemo(() => placedBirds(layout), [layout]);
  const arrival = useMemo(() => arrivalOrder(aviary), [aviary]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [tip, setTip] = useState<TipAt | null>(null);
  const speaker = placed.find((entry) => entry.bird.id === speakingId);

  useEffect(() => {
    if (speakingId === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSpeakingId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [speakingId]);

  const hover = (bird: BirdModel, event: PointerEvent) => {
    const rect = rootRef.current?.getBoundingClientRect();
    setTip({
      bird,
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    });
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a click on the open sky closes the bubble.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes the bubble from the keyboard.
    <div
      ref={rootRef}
      data-phase={phase}
      className="relative h-full w-full overflow-hidden select-none"
      style={{ background: skyBackground }}
      onClick={() => setSpeakingId(null)}
    >
      <svg
        viewBox={`0 0 ${sceneWidth} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 block h-full w-full"
      >
        <title>Projects as birds on wires</title>
        <SkyDrawing phase={phase} height={layout.height} />
        {layout.rows.map((row) => (
          <WireLine
            key={`${row.wire.name} ${row.index}`}
            y={row.y}
            width={sceneWidth}
            label={
              row.index === 0
                ? { name: row.wire.name, birds: row.wire.birds }
                : null
            }
          />
        ))}
        <FenceRail
          y={layout.fence.y}
          width={sceneWidth}
          height={layout.height}
          count={aviary.fence.birds.length}
        />
        <g key={arrangementKey(aviary)}>
          {placed.map((entry) => (
            <PerchedBird
              key={entry.bird.id}
              placed={entry}
              night={night}
              arrival={arrival.get(entry.bird.id) ?? 0}
              speaking={entry.bird.id === speakingId}
              onSpeak={(bird) => {
                setTip(null);
                setSpeakingId(bird.id);
              }}
              onHover={hover}
              onLeave={() => setTip(null)}
            />
          ))}
        </g>
      </svg>
      <SkyNotices aviary={aviary} now={now} />
      <SkyLegend />
      {tip !== null && tip.bird.id !== speakingId && (
        <Tip tip={tip} size={size} now={now} />
      )}
      {speaker !== undefined && (
        <AnchoredBubble
          placed={speaker}
          layout={layout}
          size={size}
          night={night}
          onLaunch={onLaunch}
          onFullStory={() => {
            setSpeakingId(null);
            onFullStory(speaker.bird);
          }}
        />
      )}
    </div>
  );
}

/** Until the first measurement the scene assumes a small monitor's window. */
const assumedSize: PixelSize = { width: 1400, height: 800 };

export interface AviaryViewProps {
  aviary: Aviary;
  /** The render's clock: the sky's phase and every age are read from it. */
  now: Date;
  onLaunch: (action: LaunchAction) => void;
  /** A bubble's "Tell me the full story" was pressed. */
  onFullStory: (bird: BirdModel) => void;
}

/** Tiers A and B: the whole home scene, filling its parent and redrawn as it resizes. */
export function AviaryView(props: AviaryViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const size = useElementSize(ref, assumedSize);
  return (
    <div ref={ref} className="h-full w-full">
      <AviaryScene {...props} size={size} />
    </div>
  );
}
