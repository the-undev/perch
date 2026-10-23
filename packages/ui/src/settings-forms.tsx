// The settings page's groups, one per part of config, and the editor that holds them: local
// paths, wires, thresholds, scan, importance, launch, forges, server, and the presence lists.
// Each group is presentational, its value in and every change out; the editor holds the draft.

import {
  type LaunchCommandName,
  launchPlaceholders,
} from "@perch/core/config.ts";
import { thresholdWindows } from "@perch/core/entry-form.ts";
import {
  type ForgeValues,
  type ServerValues,
  type SettingsForm,
  type SettingsValues,
  settingsProblems,
  tierWarnings,
  wireWarnings,
} from "@perch/core/settings-form.ts";
import { type ReactNode, useState } from "react";
import {
  FormNotes,
  FormRow,
  inputClass,
  monoInputClass,
  NumberInput,
  PillChoice,
  panelClass,
  primaryClass,
  quietClass,
  StringList,
  secondaryClass,
  ThresholdField,
} from "./form-parts.tsx";

/** One part of config: its title, the table it writes, and a quiet note beneath its rows. */
function SettingsGroup({
  title,
  table,
  note,
  children,
}: {
  title: string;
  table: string;
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`${panelClass} mb-5 break-inside-avoid`}
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="m-0 font-body font-semibold text-[13.5px] text-ink-faint">
          {title}
        </h2>
        <code className="font-mono text-[12px] text-ink-faint">{table}</code>
      </div>
      {children}
      <p className="mt-2 mb-0 max-w-[70ch] text-[12px] text-ink-faint leading-normal">
        {note}
      </p>
    </section>
  );
}

/**
 * The default kept with its name: when the one entry edited in place was the default, the
 * default follows the new text.
 */
function followDefault(
  before: string[],
  after: string[],
  current: string,
): string {
  if (before.length !== after.length) return current;
  const index = before.findIndex((name, at) => name !== after[at]);
  if (index < 0 || before[index] !== current) return current;
  return after[index] ?? current;
}

/** An ordered list of names and the default picked from them, wires or tiers. */
function NamesWithDefault({
  noun,
  placeholder,
  value,
  onChange,
}: {
  noun: string;
  placeholder: string;
  value: { names: string[]; default: string };
  onChange: (value: { names: string[]; default: string }) => void;
}) {
  const label = `${noun[0]?.toUpperCase()}${noun.slice(1)}s`;
  return (
    <>
      <FormRow label={label} sub="In order, first at the top">
        <StringList
          noun={noun}
          placeholder={placeholder}
          values={value.names}
          ordered={true}
          onChange={(names) =>
            onChange({
              names,
              default: followDefault(value.names, names, value.default),
            })
          }
        />
      </FormRow>
      <FormRow label="Default" sub={`The ${noun} an entry naming none takes`}>
        <PillChoice
          label={`Default ${noun}`}
          options={value.names.filter((name) => name.trim() !== "")}
          value={value.default}
          onChange={(chosen) => onChange({ ...value, default: chosen })}
        />
      </FormRow>
    </>
  );
}

export interface GroupProps<T> {
  value: T;
  onChange: (value: T) => void;
}

/** The include and ignore paths, shown as typed with ~. */
export function LocalPathsGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["local"]>) {
  return (
    <SettingsGroup
      title="Local paths"
      table="[local]"
      note="Each path starts with / or ~, the home directory. A path under the home directory is saved with ~."
    >
      <FormRow label="Include" sub="Repositories, or folders searched for them">
        <StringList
          noun="include path"
          placeholder="~/dev"
          values={value.include}
          ordered={false}
          onChange={(include) => onChange({ ...value, include })}
        />
      </FormRow>
      <FormRow label="Ignore" sub="Nothing at or below is searched">
        <StringList
          noun="ignore path"
          placeholder="~/dev/archived"
          values={value.ignore}
          ordered={false}
          onChange={(ignore) => onChange({ ...value, ignore })}
        />
      </FormRow>
    </SettingsGroup>
  );
}

/** The wires top to bottom and the default; removing a wire entries name says what moves. */
export function WiresGroup({
  value,
  named,
  onChange,
}: GroupProps<SettingsValues["wires"]> & {
  /** The entry keys naming each wire. */
  named: Record<string, string[]>;
}) {
  return (
    <SettingsGroup
      title="Wires"
      table="[wires]"
      note="The owner's priority bands, top to bottom. An adopted bird sits on the wire its entry names, else on the default."
    >
      <NamesWithDefault
        noun="wire"
        placeholder="Someday"
        value={value}
        onChange={onChange}
      />
      <FormNotes notes={wireWarnings(named, value)} />
    </SettingsGroup>
  );
}

/** The six global thresholds, amber before red in each window. */
export function ThresholdsGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["thresholds"]>) {
  return (
    <SettingsGroup
      title="Thresholds"
      table="[thresholds]"
      note="Amber at the first, red at the second, each a whole number above zero. A bird's entry may override any of them."
    >
      {thresholdWindows.map((window) => (
        <FormRow key={window.label} label={window.label} sub={window.unit}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {(["amber", "red"] as const).map((level) => {
              const key = window[level];
              return (
                <ThresholdField
                  key={level}
                  window={window}
                  level={level}
                  value={value[key]}
                  placeholder=""
                  onChange={(next) => onChange({ ...value, [key]: next })}
                />
              );
            })}
          </div>
        </FormRow>
      ))}
    </SettingsGroup>
  );
}

/** The two scan intervals. */
export function ScanGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["scan"]>) {
  return (
    <SettingsGroup
      title="Scan"
      table="[scan]"
      note="Every source is scanned on the interval, counted from the end of the last scan. The archived interval is read by nothing yet."
    >
      <FormRow label="Interval" sub="minutes">
        <NumberInput
          label="Scan interval in minutes"
          value={value.intervalMinutes}
          placeholder=""
          onChange={(intervalMinutes) =>
            onChange({ ...value, intervalMinutes })
          }
        />
      </FormRow>
      <FormRow label="Archived interval" sub="hours">
        <NumberInput
          label="Archived scan interval in hours"
          value={value.archivedIntervalHours}
          placeholder=""
          onChange={(archivedIntervalHours) =>
            onChange({ ...value, archivedIntervalHours })
          }
        />
      </FormRow>
    </SettingsGroup>
  );
}

/** The importance tiers, most important first, and the default. */
export function ImportanceGroup({
  value,
  named,
  onChange,
}: GroupProps<SettingsValues["importance"]> & {
  /** The entry keys naming each tier. */
  named: Record<string, string[]>;
}) {
  const wires = { names: value.tiers, default: value.default };
  return (
    <SettingsGroup
      title="Importance"
      table="[importance]"
      note="Tiers set a bird's size, the most important first. A bird whose entry names none takes the default."
    >
      <NamesWithDefault
        noun="tier"
        placeholder="projects"
        value={wires}
        onChange={(next) =>
          onChange({ tiers: next.names, default: next.default })
        }
      />
      <FormNotes notes={tierWarnings(named, value)} />
    </SettingsGroup>
  );
}

/** Rows of a few text fields each, removable, one more added at the end. */
function RecordRows<Field extends string>({
  noun,
  fields,
  rows,
  onChange,
}: {
  /** What one row is, for its fields and buttons. */
  noun: string;
  fields: { key: Field; label: string; placeholder: string }[];
  rows: Record<Field, string>[];
  onChange: (rows: Record<Field, string>[]) => void;
}) {
  const blank = Object.fromEntries(
    fields.map(({ key }) => [key, ""]),
  ) as Record<Field, string>;
  return (
    <>
      {rows.length > 0 && (
        <ul className="m-0 flex w-full list-none flex-col gap-1 p-0">
          {rows.map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place, so the position is the row's identity.
            <li key={index} className="flex items-center gap-1">
              {fields.map((field) => (
                <input
                  key={field.key}
                  type="text"
                  aria-label={`${noun} ${index + 1}, ${field.label}`}
                  placeholder={field.placeholder}
                  value={row[field.key]}
                  onChange={(event) =>
                    onChange(
                      rows.map((candidate, at) =>
                        at === index
                          ? { ...candidate, [field.key]: event.target.value }
                          : candidate,
                      ),
                    )
                  }
                  className={monoInputClass}
                />
              ))}
              <button
                type="button"
                aria-label={`Remove ${noun} ${index + 1}`}
                onClick={() => onChange(rows.filter((_, at) => at !== index))}
                className={quietClass}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => onChange([...rows, blank])}
        className={`${secondaryClass} px-2.75 py-1.5`}
      >
        Add {noun}
      </button>
    </>
  );
}

/** Each launch command's name on the page, with what its action does. */
const commandWords: Record<LaunchCommandName, { label: string; does: string }> =
  {
    zellij: { label: "zellij", does: "Finds or opens the item's tab" },
    terminal: { label: "Terminal", does: "Attaches a session not running" },
    vscode: { label: "VS Code", does: "Open in VS Code" },
    folder: { label: "Folder", does: "Open the folder" },
    obsidian: { label: "Obsidian", does: "Open in Obsidian" },
  };

/** The zellij sessions and the commands behind the launch actions, each a list line. */
export function LaunchGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["launch"]>) {
  return (
    <SettingsGroup
      title="Launch"
      table="[launch]"
      note={
        <>
          Each command is a list in brackets of strings in double quotes, as in
          the config file, with JSON's escapes:{" "}
          <code className="font-mono">["code", "{"{path}"}"]</code>. Arguments
          are never split on spaces, and a command runs without a shell. An
          empty field removes the action.
        </>
      }
    >
      <FormRow label="Zellij session" sub="For an item nothing else assigns">
        <input
          type="text"
          aria-label="Zellij session"
          value={value.zellijSession}
          onChange={(event) =>
            onChange({ ...value, zellijSession: event.target.value })
          }
          className={`${monoInputClass} max-w-60`}
        />
      </FormRow>
      <FormRow label="Sessions by root" sub="The longest root holding the item">
        <RecordRows
          noun="session root"
          fields={[
            { key: "root", label: "root", placeholder: "~/work" },
            { key: "session", label: "session", placeholder: "work" },
          ]}
          rows={value.zellijSessions}
          onChange={(zellijSessions) => onChange({ ...value, zellijSessions })}
        />
      </FormRow>
      {(Object.keys(launchPlaceholders) as LaunchCommandName[]).map((name) => {
        const placeholders = launchPlaceholders[name];
        return (
          <FormRow
            key={name}
            label={commandWords[name].label}
            sub={
              placeholders.length === 0
                ? commandWords[name].does
                : `${commandWords[name].does}; ${placeholders.map((entry) => `{${entry}}`).join(", ")}`
            }
          >
            <input
              type="text"
              aria-label={`${commandWords[name].label} command`}
              placeholder="Not offered"
              spellCheck={false}
              value={value.commands[name]}
              onChange={(event) =>
                onChange({
                  ...value,
                  commands: { ...value.commands, [name]: event.target.value },
                })
              }
              className={monoInputClass}
            />
          </FormRow>
        );
      })}
    </SettingsGroup>
  );
}

/** One forge's hosts, accounts and tracked forks. */
function ForgeRows({
  forge,
  value,
  onChange,
}: {
  forge: string;
  value: ForgeValues;
  onChange: (value: ForgeValues) => void;
}) {
  return (
    <>
      <FormRow label="Hosts" sub="Remote hosts and SSH aliases">
        <StringList
          noun={`${forge} host`}
          placeholder="github.com"
          values={value.hosts}
          ordered={false}
          onChange={(hosts) => onChange({ ...value, hosts })}
        />
      </FormRow>
      <FormRow label="Accounts" sub="Each with its keyring key">
        <RecordRows
          noun={`${forge} account`}
          fields={[
            { key: "account", label: "name", placeholder: "owner" },
            { key: "key", label: "keyring key", placeholder: "forge-owner" },
          ]}
          rows={value.accounts}
          onChange={(accounts) => onChange({ ...value, accounts })}
        />
      </FormRow>
      <FormRow label="Tracked forks" sub="owner/name; others skipped">
        <StringList
          noun={`${forge} tracked fork`}
          placeholder="owner/name"
          values={value.trackedForks}
          ordered={false}
          onChange={(trackedForks) => onChange({ ...value, trackedForks })}
        />
      </FormRow>
    </>
  );
}

function ForgeHeading({ children }: { children: string }) {
  return (
    <h3 className="mt-3 mb-0 border-edge border-t pt-2.5 font-body font-semibold text-[13px] text-ink">
      {children}
    </h3>
  );
}

/** The finalised commit count and each forge's hosts, accounts and tracked forks. */
export function ForgesGroup({
  value,
  onChange,
}: GroupProps<SettingsValues["forges"]>) {
  return (
    <SettingsGroup
      title="Forges"
      table="[forges]"
      note="Tokens live in the desktop keyring under service perch, never in this file: each account names the key that holds its read-only token."
    >
      <FormRow label="Finalised commits" sub="Read on each default branch">
        <NumberInput
          label="Finalised commits"
          value={value.finalisedCommits}
          placeholder=""
          onChange={(finalisedCommits) =>
            onChange({ ...value, finalisedCommits })
          }
        />
      </FormRow>
      <ForgeHeading>GitHub</ForgeHeading>
      <ForgeRows
        forge="GitHub"
        value={value.github}
        onChange={(github) => onChange({ ...value, github })}
      />
      <ForgeHeading>Forgejo</ForgeHeading>
      <FormRow label="Address" sub="The instance's base URL">
        <input
          type="text"
          aria-label="Forgejo address"
          value={value.forgejo.baseUrl}
          onChange={(event) =>
            onChange({
              ...value,
              forgejo: { ...value.forgejo, baseUrl: event.target.value },
            })
          }
          className={monoInputClass}
        />
      </FormRow>
      <ForgeRows
        forge="Forgejo"
        value={value.forgejo}
        onChange={(forgejo) =>
          onChange({
            ...value,
            forgejo: { ...forgejo, baseUrl: value.forgejo.baseUrl },
          })
        }
      />
    </SettingsGroup>
  );
}

const serverFields: {
  key: keyof ServerValues;
  label: string;
  placeholder: string;
}[] = [
  { key: "name", label: "Name", placeholder: "Silo" },
  {
    key: "kumaBaseUrl",
    label: "Uptime Kuma address",
    placeholder: "http://forge.example.lan:3001",
  },
  { key: "kumaStatusPage", label: "Status page", placeholder: "perch" },
];

/** The server to monitor, or none: absent until enabled, and disabled back to none. */
export function ServerGroup({
  value,
  onChange,
}: GroupProps<ServerValues | null>) {
  return (
    <SettingsGroup
      title="Server"
      table="[server]"
      note="With a server set, each scan reads its Uptime Kuma status page. The scene does not show it yet."
    >
      {value === null ? (
        <div className="flex flex-wrap items-center gap-3 py-2">
          <span className="text-[13px] text-ink-faint">
            No server is monitored.
          </span>
          <button
            type="button"
            onClick={() =>
              onChange({ name: "", kumaBaseUrl: "", kumaStatusPage: "" })
            }
            className={`${secondaryClass} px-2.75 py-1.5`}
          >
            Monitor a server
          </button>
        </div>
      ) : (
        <>
          {serverFields.map((field) => (
            <FormRow key={field.key} label={field.label} sub="">
              <input
                type="text"
                aria-label={`Server ${field.label.toLowerCase()}`}
                placeholder={field.placeholder}
                value={value[field.key]}
                onChange={(event) =>
                  onChange({ ...value, [field.key]: event.target.value })
                }
                className={field.key === "name" ? inputClass : monoInputClass}
              />
            </FormRow>
          ))}
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`${quietClass} mt-1`}
          >
            Stop monitoring
          </button>
        </>
      )}
    </SettingsGroup>
  );
}

/** The presence lists: joins, each a list line, and the presences ignored. */
export function PresencesGroup({
  value,
  onChange,
}: GroupProps<Pick<SettingsValues, "joins" | "ignore">>) {
  return (
    <SettingsGroup
      title="Joins and ignores"
      table="joins, ignore"
      note="A presence is local: and a path under the home directory, github:owner/name or forgejo:owner/name. A join is a list line, as a launch command is."
    >
      <FormRow label="Joins" sub="Presences that are one project">
        <StringList
          noun="join"
          placeholder='["github:owner/notes", "forgejo:owner/notes"]'
          values={value.joins}
          ordered={false}
          onChange={(joins) => onChange({ ...value, joins })}
        />
      </FormRow>
      <FormRow label="Ignore" sub="Left off the main view">
        <StringList
          noun="ignored presence"
          placeholder="github:owner/name"
          values={value.ignore}
          ordered={false}
          onChange={(ignore) => onChange({ ...value, ignore })}
        />
      </FormRow>
    </SettingsGroup>
  );
}

/** Two values are the same when they serialise alike: they are plain data. */
function same(a: SettingsValues, b: SettingsValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface SettingsEditorProps {
  /** The config as the file holds it now; the draft starts here and follows it while untouched. */
  form: SettingsForm;
  /** Save was pressed with values that changed and can be written. */
  onSave: (values: SettingsValues) => void;
}

/**
 * Every group in config's order, with Save and Discard beneath. While the draft is untouched it
 * follows the file; once edited, a change to the file is noted and saving writes over it.
 */
export function SettingsEditor({ form, onSave }: SettingsEditorProps) {
  const [base, setBase] = useState(form.values);
  const [draft, setDraft] = useState(form.values);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  if (form.values !== base) {
    setBase(form.values);
    if (saving || same(draft, base)) {
      setDraft(form.values);
      setSaving(false);
      setStale(false);
    } else {
      setStale(true);
    }
  }
  const dirty = !same(draft, base);
  const problems = settingsProblems(draft);
  const update = (change: Partial<SettingsValues>) => {
    setDraft({ ...draft, ...change });
    setSaving(false);
  };
  return (
    <form
      aria-label="Settings"
      onSubmit={(event) => {
        event.preventDefault();
        if (!dirty || problems.length > 0) return;
        setSaving(true);
        onSave(draft);
      }}
    >
      <div className="columns-[36rem] gap-5">
        <LocalPathsGroup
          value={draft.local}
          onChange={(local) => update({ local })}
        />
        <WiresGroup
          value={draft.wires}
          named={form.named.wires}
          onChange={(wires) => update({ wires })}
        />
        <ThresholdsGroup
          value={draft.thresholds}
          onChange={(thresholds) => update({ thresholds })}
        />
        <ScanGroup value={draft.scan} onChange={(scan) => update({ scan })} />
        <ImportanceGroup
          value={draft.importance}
          named={form.named.tiers}
          onChange={(importance) => update({ importance })}
        />
        <LaunchGroup
          value={draft.launch}
          onChange={(launch) => update({ launch })}
        />
        <ForgesGroup
          value={draft.forges}
          onChange={(forges) => update({ forges })}
        />
        <ServerGroup
          value={draft.server}
          onChange={(server) => update({ server })}
        />
        <PresencesGroup
          value={{ joins: draft.joins, ignore: draft.ignore }}
          onChange={(presences) => update(presences)}
        />
      </div>
      <div className="sticky bottom-0 -mx-7.5 border-edge border-t bg-rail px-7.5 py-3">
        {stale && (
          <p className="mt-0 mb-1 text-[12.5px] text-ink-muted">
            The config file changed since this form was edited. Saving writes
            the form over it; Discard takes the file's values.
          </p>
        )}
        <FormNotes notes={problems} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!dirty || problems.length > 0}
            className={primaryClass}
          >
            Save
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => {
              setDraft(base);
              setStale(false);
            }}
            className={secondaryClass}
          >
            Discard changes
          </button>
          <span className="text-[12px] text-ink-faint">
            {dirty ? "Unsaved changes" : "As the config file holds it"}
          </span>
        </div>
      </div>
    </form>
  );
}
