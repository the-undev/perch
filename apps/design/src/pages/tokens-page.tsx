import type { SkyPhase } from "@perch/ui/sky.ts";
import { useEffect, useRef, useState } from "react";
import { Code, Section, Specimen, Usage } from "../usage.tsx";

/** One colour token: a swatch, its name, and the value it resolves to where it is drawn. */
function Swatch({ token }: { token: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  useEffect(() => {
    if (ref.current === null) return;
    setValue(
      getComputedStyle(ref.current).getPropertyValue(`--color-${token}`).trim(),
    );
  }, [token]);
  return (
    <div className="flex items-center gap-3">
      <div
        ref={ref}
        className="size-11 shrink-0 rounded-lg border border-edge-hi"
        style={{ background: `var(--color-${token})` }}
      />
      <div className="min-w-0">
        <div className="font-mono text-[12.5px] text-ink">--color-{token}</div>
        <div className="font-mono text-[11.5px] text-ink-faint">{value}</div>
      </div>
    </div>
  );
}

function Swatches({ tokens }: { tokens: string[] }) {
  return (
    <div className="grid gap-3">
      {tokens.map((token) => (
        <Swatch key={token} token={token} />
      ))}
    </div>
  );
}

const phases: SkyPhase[] = ["dawn", "day", "dusk", "night"];

const phaseHours: Record<SkyPhase, string> = {
  dawn: "6 to 9",
  day: "9 to 17",
  dusk: "17 to 21",
  night: "21 to 6",
};

export function TokensPage() {
  return (
    <>
      <Section
        title="The ground"
        rule="Dark, warm and not harsh: crisp edges, no glow or blur. Surfaces step up from the page to the panels; edges separate them."
        min={260}
      >
        <Specimen
          label="Surfaces"
          rule="Page, header rail, bands, panels, the detail page's ground."
        >
          <Swatches
            tokens={["bg", "rail", "band", "panel", "panel-hi", "ground"]}
          />
        </Specimen>
        <Specimen
          label="Edges"
          rule="Hairlines between surfaces; the brighter one on hover."
        >
          <Swatches tokens={["edge", "edge-hi"]} />
        </Specimen>
        <Specimen
          label="Ink"
          rule="Writing on the ground, strongest first. The accent strokes icons, the beak and the song."
        >
          <Swatches
            tokens={[
              "ink",
              "ink-muted",
              "ink-faint",
              "ink-accent",
              "ink-fence",
            ]}
          />
        </Specimen>
      </Section>

      <Section
        title="Health"
        rule="Green content, amber restless, red distressed. Red must be rare to mean anything: it is kept for CI failures, bugs and unsafe work gone stale."
        min={260}
      >
        <Specimen
          label="Mood colours"
          rule="The breast, the mood word, ledger tones and wire tallies all read these three."
        >
          <Swatches tokens={["green", "amber", "red"]} />
        </Specimen>
        <Specimen
          label="The bird's own parts"
          rule="Plumage, its dimmed fence variant, the dimmed breast, legs and the open eye."
        >
          <Swatches
            tokens={["plumage", "plumage-dim", "breast-dim", "leg", "eye"]}
          />
        </Specimen>
      </Section>

      <Section
        title="Sky phases"
        rule={
          <>
            The sky follows the clock. Each phase redefines the same five tokens
            under <Code>data-phase</Code>, so anything drawn inside a scene
            follows it.
          </>
        }
        min={260}
      >
        {phases.map((phase) => (
          <Specimen
            key={phase}
            label={phase}
            rule={`From ${phaseHours[phase]} on the local clock.`}
          >
            <div
              data-phase={phase}
              className="rounded-xl border border-edge p-4"
              style={{
                background:
                  "linear-gradient(var(--color-sky-top), var(--color-sky-low) 78%, var(--color-horizon))",
              }}
            >
              <Swatches
                tokens={["sky-top", "sky-low", "horizon", "wire", "post"]}
              />
            </div>
          </Specimen>
        ))}
        <Specimen
          label="Lights"
          rule="Sun by day, low sun at dawn, the moon and stars at dusk and night."
        >
          <Swatches tokens={["sun", "sun-low", "moon", "star"]} />
        </Specimen>
      </Section>

      <Section
        title="Paper"
        rule="The bubble and the key files share one material: paper-light against the dark, with its own darker inks and severity tones."
        min={260}
      >
        <Specimen
          label="Sheets"
          rule="The page, the dimmed tab behind it, code blocks and rules."
        >
          <Swatches
            tokens={["paper", "paper-dim", "paper-code", "paper-rule"]}
          />
        </Specimen>
        <Specimen
          label="Inks on paper"
          rule="Body, headings, the strongest name, quiet asides, tab labels."
        >
          <Swatches
            tokens={[
              "paper-ink",
              "paper-text",
              "paper-head",
              "paper-strong",
              "paper-quiet",
              "paper-tab",
            ]}
          />
        </Specimen>
        <Specimen
          label="Stamp"
          rule="The no-clone slip's stamp: a dusty blue far from the judgement colours, since a bird with no clone here may be perfectly healthy."
        >
          <Swatches tokens={["paper-stamp"]} />
        </Specimen>
        <Specimen
          label="Mood on paper"
          rule="The bubble's state word, darker so it reads on the light sheet."
        >
          <Swatches tokens={["paper-green", "paper-amber", "paper-red"]} />
        </Specimen>
        <Specimen
          label="Chips"
          rule="Plain for facts not judged, amber and red by severity."
        >
          <Swatches
            tokens={[
              "chip",
              "chip-ink",
              "chip-amber",
              "chip-amber-ink",
              "chip-red",
              "chip-red-ink",
            ]}
          />
        </Specimen>
        <Specimen
          label="Keys on paper"
          rule="The bubble's dark buttons and the full-story key."
        >
          <Swatches tokens={["key", "key-hi", "key-strong"]} />
        </Specimen>
      </Section>

      <Section
        title="Type"
        rule="Bricolage Grotesque for display, Figtree for everything else, the system monospace for paths and code."
        min={320}
      >
        <Specimen label="Display" rule="Names, page titles, headings on paper.">
          <div className="font-bold font-display text-[42px] leading-none tracking-[-0.02em]">
            Hothouse Vault
          </div>
        </Specimen>
        <Specimen label="Body" rule="Speech, ledgers, labels.">
          <p className="m-0 text-[16.5px] text-ink-muted">
            Six changes have sat uncommitted for 30 hours. Past a day now.
          </p>
        </Specimen>
        <Specimen label="Mono" rule="Paths, file tabs, commit hashes.">
          <code className="font-mono text-[13px]">
            docs/roadmap.md · af0893d
          </code>
        </Specimen>
      </Section>

      <Usage
        component="@perch/ui/theme.css"
        props={[
          {
            name: "--color-*",
            type: "colour token",
            what: "Every colour above; Tailwind utilities like bg-panel or text-ink-muted read them.",
          },
          {
            name: "--font-display, --font-body, --font-mono",
            type: "font token",
            what: "The three faces, as font-display, font-body and font-mono.",
          },
          {
            name: "data-phase",
            type: '"dawn" | "day" | "dusk" | "night"',
            what: "On any element: redefines the sky tokens for everything inside it.",
          },
          {
            name: "--animate-*",
            type: "animation token",
            what: "bird-bob, tail-flick, song, twinkle, bubble-pop; used behind motion-safe.",
          },
        ]}
      >
        <p>
          Each app imports <Code>tailwindcss</Code> and then{" "}
          <Code>@perch/ui/theme.css</Code> in its own stylesheet. The theme
          replaces Tailwind&apos;s default palette, maps shadcn&apos;s semantic
          tokens onto these, and tells Tailwind to scan the ui package&apos;s
          components.
        </p>
      </Usage>
    </>
  );
}
