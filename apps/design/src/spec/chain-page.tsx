// The model chain: raw facts, the snapshot, the view model, and the renderer, with the rule that
// keeps each stage to its inputs and the real names of the types and functions at each.

import type { ReactNode } from "react";
import { Code } from "../usage.tsx";
import { gatherRounds } from "./code.ts";
import {
  Declarations,
  FunctionTable,
  ModuleNote,
  Part,
  Prose,
} from "./parts.tsx";

interface Stage {
  name: string;
  where: string;
  writtenBy: string;
  types: string[];
  reads: string;
}

const stages: Stage[] = [
  {
    name: "Raw facts",
    where: ".scan/raw/<source>.json and status.json",
    writtenBy: "pnpm gather · src/gather.ts and src/sources/",
    types: ["RawFiles", "RawSourceFile", "StatusFile"],
    reads: "This machine and the forge accounts. Nothing judged.",
  },
  {
    name: "Snapshot",
    where: ".scan/snapshot.json",
    writtenBy:
      "pnpm aggregate · src/aggregate.ts, src/join.ts, src/derivations.ts",
    types: ["Snapshot", "Item", "ItemSourceData"],
    reads:
      "The raw files and the config only; the previous snapshot for first-seen times.",
  },
  {
    name: "View model",
    where: "in memory, at render",
    writtenBy: "deriveAviary · src/viewmodel.ts, src/speech.ts",
    types: ["Aviary", "Wire", "Fence", "Bird", "Bubble", "Detail"],
    reads: "One snapshot and the config, by pure functions.",
  },
  {
    name: "Renderer",
    where: "packages/ui, apps/desktop",
    writtenBy: "AviaryView, DetailView, CameraView",
    types: [],
    reads: "The view model only, and the clock for the sky.",
  },
];

function StageCard({ stage, last }: { stage: Stage; last: boolean }) {
  return (
    <div className="flex min-w-0 items-stretch gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl border border-edge bg-linear-[172deg] from-panel to-band px-4.5 pt-4 pb-3.5">
        <h3 className="m-0 font-bold font-display text-[19px]">{stage.name}</h3>
        <span className="font-mono text-[12px] text-ink-accent">
          {stage.where}
        </span>
        <span className="text-[12.5px] text-ink-faint">{stage.writtenBy}</span>
        <span className="text-[13px] text-ink-muted">{stage.reads}</span>
        {stage.types.length > 0 && (
          <span className="mt-auto pt-1 font-mono text-[12px] text-ink">
            {stage.types.join(" · ")}
          </span>
        )}
      </div>
      {!last && (
        <span
          aria-hidden="true"
          className="hidden self-center text-[22px] text-ink-faint lg:block"
        >
          →
        </span>
      )}
    </div>
  );
}

function Rule({ children }: { children: ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

export function ChainPage() {
  return (
    <>
      <div className="mt-8 grid gap-3 lg:grid-cols-4">
        {stages.map((stage, index) => (
          <StageCard
            key={stage.name}
            stage={stage}
            last={index === stages.length - 1}
          />
        ))}
      </div>

      <Part title="The two-stage rule">
        <Prose>
          <ul className="m-0 list-disc space-y-1 pl-5">
            <Rule>
              Gathering observes and never judges: no ages, thresholds, levels
              or states in the raw files, and every absent value states why.
            </Rule>
            <Rule>
              Aggregation reads only the raw files and the config, and the
              previous snapshot as the first-seen record for unmet expectations.
              The same raw files always give the same snapshot: ages are
              measured to each file&apos;s <Code>gatheredAt</Code>.
            </Rule>
            <Rule>
              Every judgement lives in <Code>src/derivations.ts</Code>, so a
              rule can change without touching how the machine is read.
            </Rule>
            <Rule>
              The renderer reads only the view model, never the raw or snapshot
              types. The view model imports no Node module, so the renderer can
              import it.
            </Rule>
          </ul>
        </Prose>
      </Part>

      <Part title="The gather's rounds">
        <Prose>
          <p>
            As <Code>gatherRounds</Code> in <Code>src/gather.ts</Code> declares
            them. Sources within a round run together; enrichers read what the
            earlier rounds wrote.
          </p>
          <ol className="m-0 list-decimal space-y-1 pl-5">
            {gatherRounds.map((round, index) => (
              <li key={round.join()}>
                {index === 0 ? "Root collectors" : "Enrichers"}:{" "}
                {round.map((source, at) => (
                  <span key={source}>
                    {at > 0 && ", "}
                    <Code>{source}</Code>
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </Prose>
      </Part>

      <Part title="Raw facts">
        <ModuleNote file="src/raw.ts" />
        <Declarations
          file="src/raw.ts"
          names={[
            "RawSourceFile",
            "RawFiles",
            "RawData",
            "StatusFile",
            "SourceStatus",
            "Observed",
            "Entry",
          ]}
        />
      </Part>

      <Part title="The snapshot">
        <ModuleNote file="src/snapshot.ts" />
        <Declarations
          file="src/snapshot.ts"
          names={["Snapshot", "Item", "ItemSourceData", "SourceStatus"]}
        />
        <h3 className="mt-7 mb-0 font-semibold text-[14px] text-ink-faint">
          Where each derivation lives
        </h3>
        <ModuleNote file="src/join.ts" />
        <FunctionTable file="src/join.ts" />
        <p className="mt-4 mb-0 font-mono text-[12.5px] text-ink-accent">
          packages/core/src/aggregate.ts
        </p>
        <FunctionTable file="src/aggregate.ts" />
        <div className="mt-4">
          <ModuleNote file="src/derivations.ts" />
        </div>
        <FunctionTable file="src/derivations.ts" />
      </Part>

      <Part title="The view model">
        <ModuleNote file="src/viewmodel.ts" />
        <FunctionTable file="src/viewmodel.ts" />
        <div className="mt-4">
          <ModuleNote file="src/speech.ts" />
        </div>
        <FunctionTable file="src/speech.ts" />
        <Declarations
          file="src/viewmodel.ts"
          names={["Aviary", "Wire", "Fence", "Bird", "Bubble", "Detail"]}
        />
      </Part>
    </>
  );
}
