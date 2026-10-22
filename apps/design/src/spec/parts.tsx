// The pieces the Spec pages are built from: code as it is in the repository, declarations
// excerpted by name, and tables of the functions a module exports.

import type { ReactNode } from "react";
import {
  declaration,
  exportedFunctions,
  headerComment,
  signature,
} from "../excerpt.ts";
import { type CoreFile, coreFiles } from "./code.ts";

/** A block of code, a comment line toned down so the declarations read first. */
export function CodeBlock({ code, title }: { code: string; title: string }) {
  return (
    <figure className="m-0 min-w-0">
      <figcaption className="mb-1.5 font-mono text-[12px] text-ink-faint">
        {title}
      </figcaption>
      <pre className="m-0 overflow-x-auto rounded-lg border border-edge bg-panel px-4 py-3 font-mono text-[12.5px] text-ink leading-relaxed">
        {code.split("\n").map((line, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: lines of a fixed text, in order.
            key={index}
            className={
              /^\s*(\/\/|\/\*\*|\*|#)/.test(line)
                ? "block text-ink-faint"
                : "block"
            }
          >
            {line === "" ? " " : line}
          </span>
        ))}
      </pre>
    </figure>
  );
}

/** A grid of code blocks that flows into more columns on a wide window. */
export function CodeGrid({
  min,
  children,
}: {
  min: number;
  children: ReactNode;
}) {
  return (
    <div
      className="mt-4 grid items-start gap-5"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(min(${min}px, 100%), 1fr))`,
      }}
    >
      {children}
    </div>
  );
}

/** The named declarations from one core file, each as the repository holds it. */
export function Declarations({
  file,
  names,
}: {
  file: CoreFile;
  names: readonly string[];
}) {
  return (
    <CodeGrid min={520}>
      {names.map((name) => (
        <CodeBlock
          key={name}
          title={`packages/core/${file} · ${name}`}
          code={declaration(coreFiles[file], name)}
        />
      ))}
    </CodeGrid>
  );
}

/** The named functions from one core file, by signature and comment, bodies left out. */
export function Signatures({
  file,
  names,
}: {
  file: CoreFile;
  names: readonly string[];
}) {
  return (
    <CodeGrid min={520}>
      {names.map((name) => (
        <CodeBlock
          key={name}
          title={`packages/core/${file} · ${name}`}
          code={signature(coreFiles[file], name)}
        />
      ))}
    </CodeGrid>
  );
}

/** Every function a core file exports, with what its comment says it does. */
export function FunctionTable({ file }: { file: CoreFile }) {
  const functions = exportedFunctions(coreFiles[file]);
  return (
    <table className="mt-3 w-full max-w-[1400px] border-collapse text-[13px]">
      <tbody>
        {functions.map((entry) => (
          <tr key={entry.name} className="border-edge border-t align-top">
            <td className="w-64 py-2 pr-4 font-mono text-[12.5px] text-ink">
              {entry.name}
            </td>
            <td className="py-2 text-ink-muted">{entry.doc ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A module's opening comment, as the prose it is. */
export function ModuleNote({ file }: { file: CoreFile }) {
  return (
    <p className="mt-1 mb-0 max-w-[90ch] text-[13.5px] text-ink-muted leading-relaxed">
      <code className="font-mono text-[12.5px] text-ink-accent">
        packages/core/{file}
      </code>
      : {headerComment(coreFiles[file])}
    </p>
  );
}

/** A heading and its prose for one part of a Spec page. */
export function Part({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-11">
      <h2 className="m-0 font-bold font-display text-[20px]">{title}</h2>
      {children}
    </section>
  );
}

/** Prose under a part's heading. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1.5 max-w-[90ch] space-y-2 text-[13.5px] text-ink-muted leading-relaxed">
      {children}
    </div>
  );
}

/** A value from the mock dataset, as JSON. */
export function MockValue({ title, value }: { title: string; value: unknown }) {
  return (
    <CodeGrid min={520}>
      <CodeBlock title={title} code={JSON.stringify(value, null, 2)} />
    </CodeGrid>
  );
}
