// The settings page's Sources: one card per configured source table, in config order, each
// opening with its last scan in words, and the picker that adds a card of any kind.
// Presentational: the sources in, every change out, the scan records and the moment passed in.

import type { GithubSourceConfig, SourcesConfig } from "@perch/core/config.ts";
import {
  type KeyringCalls,
  pickerKinds,
  type SourceCardValues,
  type SourceField,
  type SourceProblem,
  type SourceTestValues,
  sourceCardId,
  sourceCardsOf,
  sourceFieldLabels,
  sourceHeading,
  sourceProblems,
  withForgejoBaseUrl,
  withSourceAdded,
  withSourceCard,
  withSourceRemoved,
} from "@perch/core/sources-form.ts";
import type {
  SourceCard,
  SourceCardKind,
  SourceCardResult,
} from "@perch/core/viewmodel.ts";
import { type ReactNode, useId, useState } from "react";
import {
  buttonClass,
  FormNotes,
  monoInputClass,
  primaryClass,
  quietClass,
  SettingsPageHead,
  StringList,
  secondaryClass,
} from "./form-parts.tsx";
import { recentWords } from "./time.ts";

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** What a card's last scan says in its head, and the dot beside it. */
export interface ScanWords {
  tone: "ok" | "never" | "failed";
  text: string;
  /** A second line: a local card's folders not found, or when a failed card last read. */
  detail: string | null;
}

/** A card's last scan in words; a card with no record yet reads as never scanned. */
export function scanWords(
  kind: SourceCardKind,
  result: SourceCardResult | null,
  now: Date,
): ScanWords {
  if (result === null || result.state === "never-scanned") {
    return { tone: "never", text: "never scanned yet", detail: null };
  }
  if (result.state === "failed") {
    return {
      tone: "failed",
      text: `failed: ${result.message}`,
      detail:
        result.lastSucceededAt === null
          ? null
          : `last read ${recentWords(result.lastSucceededAt, now)}`,
    };
  }
  const found = {
    local: `found ${plural(result.count, "repository", "repositories")}`,
    github: `read ${plural(result.count, "repository", "repositories")}`,
    forgejo: `read ${plural(result.count, "repository", "repositories")}`,
    kuma: `read ${plural(result.count, "monitor", "monitors")}`,
  }[kind];
  return {
    tone: "ok",
    text: `${found} · ${recentWords(result.at, now)}`,
    detail:
      result.missingIncludes.length === 0
        ? null
        : `not found: ${result.missingIncludes.join(", ")}`,
  };
}

const dotTone: Record<ScanWords["tone"], string> = {
  ok: "bg-green",
  never: "bg-edge-hi",
  failed: "bg-red",
};

/** A labelled field on a card, with its problems beneath. */
function CardField({
  label,
  sub,
  problems,
  children,
}: {
  label: string;
  /** A quiet second half of the label, or nothing. */
  sub: string;
  problems: string[];
  children: (labelId: string) => ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <span id={labelId} className="text-[12px] text-ink-faint">
        {label}
        {sub !== "" && ` · ${sub}`}
      </span>
      {children(labelId)}
      <FormNotes notes={problems} />
    </div>
  );
}

/** One line of text on a card, labelled by its field. */
function TextField({
  field,
  sub,
  value,
  placeholder,
  problems,
  onChange,
}: {
  field: SourceField;
  sub: string;
  value: string;
  placeholder: string;
  problems: string[];
  onChange: (value: string) => void;
}) {
  return (
    <CardField label={sourceFieldLabels[field]} sub={sub} problems={problems}>
      {() => (
        <input
          type="text"
          aria-label={sourceFieldLabels[field]}
          placeholder={placeholder}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={monoInputClass}
        />
      )}
    </CardField>
  );
}

/** A list of strings on a card, labelled by its field. */
function ListField({
  field,
  sub,
  noun,
  placeholder,
  values,
  problems,
  onChange,
}: {
  field: SourceField;
  sub: string;
  noun: string;
  placeholder: string;
  values: string[];
  problems: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <CardField label={sourceFieldLabels[field]} sub={sub} problems={problems}>
      {() => (
        <StringList
          noun={noun}
          placeholder={placeholder}
          values={values}
          onChange={onChange}
        />
      )}
    </CardField>
  );
}

const quietLineClass =
  "m-0 max-w-[62ch] text-[12.5px] text-ink-faint leading-normal";

/** The keyring key suggested for an account: the kind, then the account. */
const suggestedKey = (kind: "github" | "forgejo", account: string) =>
  account.trim() === "" ? "" : `${kind}-${account.trim()}`;

/** What a keyring call answered, or that it is running, as the card's quiet sentence. */
interface KeyringAnswer {
  tone: "busy" | "ok" | "failed";
  text: string;
}

const answerTone: Record<KeyringAnswer["tone"], string> = {
  busy: "text-ink-faint",
  ok: "text-ink-muted",
  failed: "text-red",
};

/**
 * The write-only token field, with Store and Test beside a sentence saying what the last call
 * answered. The field is never filled from anywhere and empties once its token is stored.
 */
function TokenRow({
  values,
  keyring,
}: {
  /** The card's draft values: the key the token goes under, and what a test reads. */
  values: SourceTestValues;
  keyring: KeyringCalls;
}) {
  const [token, setToken] = useState("");
  const [answer, setAnswer] = useState<KeyringAnswer | null>(null);
  const busy = answer?.tone === "busy";
  const keyed = values.key.trim() !== "";
  const testable =
    keyed &&
    values.account.trim() !== "" &&
    (values.kind === "github" || values.baseUrl.trim() !== "");
  const failed = (error: unknown) => ({
    ok: false as const,
    problem: `the call did not reach the main process: ${error instanceof Error ? error.message : String(error)}`,
  });
  const store = () => {
    const key = values.key;
    setAnswer({ tone: "busy", text: "storing in the keyring" });
    void keyring
      .storeToken(key, token)
      .catch(failed)
      .then((stored) => {
        if (!stored.ok) {
          setAnswer({ tone: "failed", text: stored.problem });
          return;
        }
        setToken("");
        setAnswer({ tone: "ok", text: `stored in the keyring under ${key}` });
      });
  };
  const test = () => {
    const account = values.account.trim();
    setAnswer({ tone: "busy", text: "testing" });
    void keyring
      .testSource(values)
      .catch(failed)
      .then((tested) =>
        setAnswer(
          tested.ok
            ? {
                tone: "ok",
                text: `${account}: ${plural(tested.count, "repository", "repositories")} readable`,
              }
            : { tone: "failed", text: tested.problem },
        ),
      );
  };
  return (
    <>
      <CardField
        label="Token"
        sub="paste once, kept only in the system keyring"
        problems={[]}
      >
        {() => (
          <input
            type="password"
            aria-label="Token"
            autoComplete="off"
            spellCheck={false}
            placeholder="paste the token here"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className={monoInputClass}
          />
        )}
      </CardField>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <button
          type="button"
          disabled={busy || !keyed || token.trim() === ""}
          onClick={store}
          className={primaryClass}
        >
          Store in the keyring
        </button>
        <button
          type="button"
          disabled={busy || !testable}
          onClick={test}
          className={secondaryClass}
        >
          Test
        </button>
        <span
          role="status"
          className={`ml-1 text-[12.5px] ${answer === null ? "" : answerTone[answer.tone]}`}
        >
          {answer?.text}
        </span>
      </div>
    </>
  );
}

/** A forge card's fields: the account and its keyring key, the token, then its hosts and tracked forks. */
function AccountFields<Source extends GithubSourceConfig>({
  kind,
  source,
  testValues,
  keyring,
  problems,
  onChange,
}: {
  kind: "github" | "forgejo";
  source: Source;
  /** What a connection test reads from the card. */
  testValues: SourceTestValues;
  keyring: KeyringCalls;
  problems: (field: SourceField) => string[];
  onChange: (source: Source) => void;
}) {
  const key = source.key.trim() === "" ? "<key>" : source.key;
  return (
    <>
      <div className="grid gap-2.5 @min-[520px]:grid-cols-2">
        <TextField
          field="account"
          sub={kind === "github" ? "a user or organisation" : "a user"}
          value={source.account}
          placeholder="someone"
          problems={problems("account")}
          onChange={(account) =>
            onChange({
              ...source,
              account,
              // The key follows the account while it is empty or still the suggestion.
              key:
                source.key === "" ||
                source.key === suggestedKey(kind, source.account)
                  ? suggestedKey(kind, account)
                  : source.key,
            })
          }
        />
        <TextField
          field="key"
          sub="under service perch"
          value={source.key}
          placeholder={`${kind}-someone`}
          problems={problems("key")}
          onChange={(next) => onChange({ ...source, key: next })}
        />
      </div>
      <TokenRow values={testValues} keyring={keyring} />
      <p className={quietLineClass}>
        The read-only token lives in the system keyring under this key, never in
        the file, and is never shown again. A fine-grained token with read-only
        contents, metadata, actions and pull requests is enough. Prefer the
        terminal?{" "}
        <code className="rounded border border-edge bg-panel px-1.25 py-px font-mono text-[12px] text-ink">
          secret-tool store --label perch service perch key {key}
        </code>
      </p>
      <ListField
        field="hosts"
        sub="the remote hostnames and SSH aliases that reach the account; a clone joins its listing by them"
        noun="host"
        placeholder={kind === "github" ? "github.com" : "forge.example.lan"}
        values={source.hosts}
        problems={problems("hosts")}
        onChange={(hosts) => onChange({ ...source, hosts })}
      />
      <ListField
        field="trackedForks"
        sub="owner/name; every other fork is skipped"
        noun="tracked fork"
        placeholder="owner/name"
        values={source.trackedForks}
        problems={problems("trackedForks")}
        onChange={(trackedForks) => onChange({ ...source, trackedForks })}
      />
    </>
  );
}

/** A card's fields by its kind, each with its problems, and what its findings become. */
function CardBody({
  card,
  keyring,
  problems,
  onChange,
}: {
  card: SourceCardValues;
  keyring: KeyringCalls;
  problems: (field: SourceField) => string[];
  onChange: (card: SourceCardValues) => void;
}) {
  switch (card.kind) {
    case "local": {
      const { source } = card;
      const set = (next: typeof source) => onChange({ ...card, source: next });
      return (
        <>
          <ListField
            field="include"
            sub="a folder of repositories, or one repository"
            noun="folder"
            placeholder="~/dev"
            values={source.include}
            problems={problems("include")}
            onChange={(include) => set({ ...source, include })}
          />
          <ListField
            field="exclude"
            sub="nothing at or below these is searched"
            noun="excluded folder"
            placeholder="~/dev/archive"
            values={source.exclude}
            problems={problems("exclude")}
            onChange={(exclude) => set({ ...source, exclude })}
          />
          <p className={quietLineClass}>
            A repository found here appears on the fence until it is adopted
            onto a wire. An Obsidian vault is known by its folder and watched
            the same way.
          </p>
        </>
      );
    }
    case "github":
      return (
        <>
          <AccountFields
            kind="github"
            source={card.source}
            testValues={{
              kind: "github",
              account: card.source.account,
              key: card.source.key,
            }}
            keyring={keyring}
            problems={problems}
            onChange={(source) => onChange({ ...card, source })}
          />
          <p className={quietLineClass}>
            The account's own repositories appear on the fence until adopted. A
            clone here whose remote names one of the hosts joins the same bird.
          </p>
        </>
      );
    case "forgejo":
      return (
        <>
          <TextField
            field="baseUrl"
            sub="the server's address"
            value={card.source.baseUrl}
            placeholder="https://forge.example.lan"
            problems={problems("baseUrl")}
            onChange={(baseUrl) =>
              onChange({
                ...card,
                source: withForgejoBaseUrl(card.source, baseUrl),
              })
            }
          />
          <AccountFields
            kind="forgejo"
            source={card.source}
            testValues={{
              kind: "forgejo",
              account: card.source.account,
              key: card.source.key,
              baseUrl: card.source.baseUrl,
            }}
            keyring={keyring}
            problems={problems}
            onChange={(source) => onChange({ ...card, source })}
          />
          <p className={quietLineClass}>
            The account's own repositories on this server appear on the fence
            until adopted. A clone here whose remote names one of the hosts
            joins the same bird.
          </p>
        </>
      );
    case "kuma": {
      const { source } = card;
      const set = (next: typeof source) => onChange({ ...card, source: next });
      return (
        <>
          <div className="grid gap-2.5 @min-[520px]:grid-cols-2">
            <TextField
              field="name"
              sub="the server this source reads"
              value={source.name}
              placeholder="Server"
              problems={problems("name")}
              onChange={(name) => set({ ...source, name })}
            />
            <TextField
              field="statusPage"
              sub="its slug"
              value={source.statusPage}
              placeholder="perch"
              problems={problems("statusPage")}
              onChange={(statusPage) => set({ ...source, statusPage })}
            />
          </div>
          <TextField
            field="baseUrl"
            sub="Uptime Kuma's address"
            value={source.baseUrl}
            placeholder="http://forge.example.lan:3001"
            problems={problems("baseUrl")}
            onChange={(baseUrl) => set({ ...source, baseUrl })}
          />
          <p className={quietLineClass}>
            The page's monitors become one bird named for the server, on the
            fence until it is adopted.
          </p>
        </>
      );
    }
  }
}

/** What a card's head says beside its heading: how many folders a local card searches. */
function cardWhat(card: SourceCardValues): string {
  if (card.kind === "local") {
    return `${plural(card.source.include.length, "folder", "folders")} searched`;
  }
  if (card.kind === "forgejo") return card.source.account.trim();
  return "";
}

/** One source's card: its heading and last scan, opened to its fields, removed on a second press. */
function SourceCardView({
  card,
  result,
  now,
  keyring,
  problems,
  unfolded,
  onChange,
  onRemove,
}: {
  card: SourceCardValues;
  /** The card's scan record, or null when the snapshot holds none for it. */
  result: SourceCardResult | null;
  now: Date;
  keyring: KeyringCalls;
  problems: SourceProblem[];
  /** The page was opened asking for this card unfolded. */
  unfolded: boolean;
  onChange: (card: SourceCardValues) => void;
  onRemove: () => void;
}) {
  // A card that cannot be written yet, a new one among them, starts open, as does one asked for.
  const [open, setOpen] = useState(problems.length > 0 || unfolded);
  const [confirming, setConfirming] = useState(false);
  const headingId = useId();
  const bodyId = useId();
  const heading = sourceHeading(card);
  const scan = scanWords(card.kind, result, now);
  const what = cardWhat(card);
  const fieldProblems = (field: SourceField) =>
    problems
      .filter((problem) => problem.field === field)
      .map((problem) => problem.problem);
  return (
    <section
      aria-labelledby={headingId}
      className="mb-2.5 overflow-hidden rounded-[10px] border border-edge bg-panel"
    >
      <div className="relative flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3">
        <h3
          id={headingId}
          className="m-0 font-display font-semibold text-[14.5px] text-ink"
        >
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen(!open)}
            className="cursor-pointer text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-ink-accent"
          >
            {heading}
          </button>
        </h3>
        {what !== "" && (
          <span className="text-[12.5px] text-ink-faint">{what}</span>
        )}
        <span
          className={`ml-auto text-[12.5px] ${scan.tone === "failed" ? "text-red" : "text-ink-muted"}`}
        >
          <span
            aria-hidden="true"
            className={`mr-1.75 inline-block size-1.75 rounded-full align-[1px] ${dotTone[scan.tone]}`}
          />
          {scan.text}
        </span>
        {scan.detail !== null && (
          <span
            className={`basis-full text-right text-[12px] ${scan.tone === "ok" ? "text-amber" : "text-ink-faint"}`}
          >
            {scan.detail}
          </span>
        )}
      </div>
      {open && (
        <div
          id={bodyId}
          className="@container grid gap-3.5 border-edge border-t bg-band p-4"
        >
          <CardBody
            card={card}
            keyring={keyring}
            problems={fieldProblems}
            onChange={onChange}
          />
          <div className="flex flex-wrap items-center gap-2">
            {confirming ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    // The next card takes this one's place, so it must not inherit the question.
                    setConfirming(false);
                    setOpen(false);
                    onRemove();
                  }}
                  className={`${buttonClass} border border-red/60 text-red hover:bg-red/10`}
                >
                  Stop looking here
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className={quietClass}
                >
                  keep
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={`${buttonClass} px-0 text-ink-faint hover:text-red`}
              >
                Remove this source
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** The kinds of source the picker offers, each a row saying what it reads and needs, always offered. */
export function SourcePicker({
  onPick,
  onClose,
}: {
  onPick: (kind: SourceCardKind) => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-[10px] border border-edge-hi border-dashed">
      <ul aria-label="Kinds of source" className="m-0 list-none p-0">
        {pickerKinds.map((words) => (
          <li
            key={words.kind}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-edge border-b px-4 py-3.25"
          >
            <span className="min-w-27 font-display font-semibold text-[14px] text-ink">
              {words.name}
            </span>
            <span className="min-w-0 flex-[1_1_18rem] text-[13px] text-ink-muted">
              {words.reads}
            </span>
            <span className="ml-auto whitespace-nowrap text-[12px] text-ink-faint">
              {words.needs}
            </span>
            <button
              type="button"
              aria-label={`Add ${words.name}`}
              onClick={() => onPick(words.kind)}
              className="cursor-pointer font-body text-[13px] text-ink hover:text-ink-accent focus-visible:outline-2 focus-visible:outline-ink-accent"
            >
              Add
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2.75 text-[12.5px] text-ink-faint">
        <span>
          Every kind can be added again · more kinds are added in later
          versions.
        </span>
        <button type="button" onClick={onClose} className={quietClass}>
          close
        </button>
      </div>
    </div>
  );
}

/** Before any source exists: an empty wire and the invitation. */
function NowhereYet() {
  return (
    <div className="px-5 pt-8.5 pb-2.5 text-center">
      <svg
        className="mx-auto mb-4.5 block"
        width="220"
        height="44"
        viewBox="0 0 220 44"
        aria-hidden="true"
      >
        <line
          x1="0"
          y1="18"
          x2="220"
          y2="18"
          className="stroke-wire"
          strokeWidth="2"
        />
        <rect x="30" y="18" width="5" height="26" className="fill-post" />
        <rect x="185" y="18" width="5" height="26" className="fill-post" />
      </svg>
      <h3 className="m-0 mb-1 font-bold font-display text-[18px] text-ink">
        No sources yet
      </h3>
      <p className="m-0 mb-5 text-ink-muted">Add the first place to read.</p>
    </div>
  );
}

export interface SourcesPageProps {
  /** Config's source tables as the draft holds them, paths written with ~. */
  value: SourcesConfig;
  /** Each configured card's last scan from the latest snapshot; null until one holds them. */
  cards: SourceCard[] | null;
  /** The moment the scan times are measured to. */
  now: Date;
  /** Stores a forge card's pasted token and tests its connection. */
  keyring: KeyringCalls;
  /** The cards of this kind start unfolded, as a link to the page asks; null for none. */
  unfold: SourceCardKind | null;
  onChange: (value: SourcesConfig) => void;
}

/** The Sources page: every source's card in config order, then the picker that adds one. */
export function SourcesPage({
  value,
  cards,
  now,
  keyring,
  unfold,
  onChange,
}: SourcesPageProps) {
  const drafts = sourceCardsOf(value);
  const [picking, setPicking] = useState(drafts.length === 0);
  const problems = sourceProblems(value);
  const records = new Map((cards ?? []).map((card) => [card.id, card.result]));
  return (
    <section aria-label="Sources" className="pb-5">
      <SettingsPageHead
        title="Sources"
        table="[[sources.*]]"
        lead="The places every scan reads. A removed source is no longer read."
      />
      {drafts.length === 0 && <NowhereYet />}
      {drafts.map((card) => (
        <SourceCardView
          key={`${card.kind}-${card.index}`}
          card={card}
          result={records.get(sourceCardId(card)) ?? null}
          now={now}
          keyring={keyring}
          problems={problems.filter(
            (problem) =>
              problem.kind === card.kind && problem.index === card.index,
          )}
          unfolded={card.kind === unfold}
          onChange={(next) => onChange(withSourceCard(value, next))}
          onRemove={() =>
            onChange(withSourceRemoved(value, card.kind, card.index))
          }
        />
      ))}
      {picking ? (
        <SourcePicker
          onPick={(kind) => {
            onChange(withSourceAdded(value, kind));
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={secondaryClass}
        >
          Add a source
        </button>
      )}
    </section>
  );
}
