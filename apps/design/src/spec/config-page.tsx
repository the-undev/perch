// The config: config.example.toml as the repository holds it, table by table, each beside what
// parseConfig makes of it, then the config model's types and lookups.

import { type Config, parseConfig } from "@perch/core/config.ts";
import { type TomlTable, tomlTables } from "../excerpt.ts";
import { Code } from "../usage.tsx";
import { exampleConfigText } from "./code.ts";
import {
  CodeBlock,
  CodeGrid,
  Declarations,
  FunctionTable,
  Part,
  Prose,
} from "./parts.tsx";

/** The home directory a leading ~ expands against here, the mock's. */
const home = "/home/owner";

const bareKey = /^[a-z_]+$/;

/** A TOML key as the config model names it: snake case becomes camel case; quoted ids stay. */
function modelKey(key: string): string {
  return bareKey.test(key)
    ? key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
    : key;
}

function tableName(table: TomlTable): string {
  if (table.path.length === 0) return "top level";
  const keys = table.array ? table.path.slice(0, -1) : table.path;
  const name = keys
    .map((key) => (bareKey.test(key) ? key : `"${key}"`))
    .join(".");
  return table.array ? `[[${name}]]` : `[${name}]`;
}

/** What parseConfig made of one table: its part of the model, less the tables nested in it. */
function parsedTable(
  table: TomlTable,
  tables: TomlTable[],
  config: Config,
): unknown {
  const value = table.path.reduce<unknown>(
    (at, key) => (at as Record<string, unknown>)[modelKey(key)],
    config,
  );
  const nested = new Set(
    tables
      .filter(
        (other) =>
          other.path.length > table.path.length &&
          table.path.every((key, index) => other.path[index] === key),
      )
      .map((other) => modelKey(other.path[table.path.length] ?? "")),
  );
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([key]) => !nested.has(key),
    ),
  );
}

function modelPath(path: string[]): string {
  return path
    .map((key) =>
      bareKey.test(key)
        ? `.${modelKey(key)}`
        : /^\d+$/.test(key)
          ? `[${key}]`
          : `["${key}"]`,
    )
    .join("");
}

export function ConfigPage() {
  const tables = tomlTables(exampleConfigText);
  const config = parseConfig(exampleConfigText, home);
  return (
    <>
      <Part title="The file, table by table">
        <Prose>
          <p>
            <Code>config.example.toml</Code> at the repository root, cut at each
            table header; its comments say what each field asserts. Beside each
            table, what <Code>parseConfig(text, &quot;{home}&quot;)</Code> makes
            of it: snake case keys become the model&apos;s camel case, a leading{" "}
            <Code>~</Code> expands, and an absent per-item field takes its
            default.
          </p>
        </Prose>
        {tables.map((table) => (
          <CodeGrid key={table.path.join(".")} min={560}>
            <CodeBlock
              title={`config.example.toml · ${tableName(table)}`}
              code={table.text}
            />
            <CodeBlock
              title={`parseConfig(…)${modelPath(table.path)}`}
              code={JSON.stringify(parsedTable(table, tables, config), null, 2)}
            />
          </CodeGrid>
        ))}
      </Part>

      <Part title="The config model">
        <Prose>
          <p>
            As declared in <Code>packages/core/src/config.ts</Code>. Config
            holds only what leaves no trace on disk or on a forge; parsing uses
            no Node module, so the renderer may use the lookups.
          </p>
        </Prose>
        <Declarations
          file="src/config.ts"
          names={[
            "Config",
            "ItemEntry",
            "Thresholds",
            "ThresholdOverrides",
            "SourcesConfig",
            "LocalSourceConfig",
            "GithubSourceConfig",
            "ForgejoSourceConfig",
            "KumaSourceConfig",
          ]}
        />
        <FunctionTable file="src/config.ts" />
      </Part>
    </>
  );
}
