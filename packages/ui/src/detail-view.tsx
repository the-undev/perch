// Tier C: a bird's full page. The mood and speech continue from the bubble, then the launch
// actions, links out and the config entry's verb, then the ledger and its sections beside the
// key files on paper. Only what exists is shown. The view fetches nothing: key-file contents,
// launching and the entry's form and writes are the caller's.

import { emptyEntryValues } from "@perch/core/entry-form.ts";
import type { Bird, LaunchAction } from "@perch/core/viewmodel.ts";
import { useState } from "react";
import { actionClass, LaunchActions, LinksOut } from "./actions.tsx";
import { DetailIntro } from "./detail-intro.tsx";
import { AdoptForm, type EntryControls, EntryEditor } from "./entry-forms.tsx";
import { Icon } from "./icons.tsx";
import {
  BranchLines,
  FlagLines,
  Ledger,
  NewestCommits,
  PullRequestLines,
  SourceProblems,
} from "./ledger.tsx";
import { KeyFilePaper, type KeyFileSheet } from "./paper.tsx";
import { isNight, skyPhase } from "./sky.ts";

export interface DetailViewProps {
  bird: Bird;
  /** The render's clock: ages are measured to it, and at night a sleeping bird's speech is woken. */
  now: Date;
  onLaunch: (action: LaunchAction) => void;
  /** The bird's key files with what was read from each; empty until the caller has read them. */
  sheets: KeyFileSheet[];
  /** Adopting the bird or editing its config entry. */
  entry: EntryControls;
}

/**
 * The config entry's verb and, once pressed, its form: Adopt for a fence bird, Edit entry for an
 * adopted one. Nothing shows until the form's values are read and agree with the bird.
 */
function EntryPart({ bird, entry }: { bird: Bird; entry: EntryControls }) {
  const [open, setOpen] = useState(false);
  const { form } = entry;
  if (form === null || (form.values !== null) !== bird.adopted) return null;
  const close = () => setOpen(false);
  const entryKey = form.key ?? bird.id;
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`${actionClass} ${open ? "border-edge bg-panel text-ink" : ""}`}
      >
        <Icon name={form.values === null ? "adopt" : "edit"} size={15} />
        {form.values === null ? "Adopt" : "Edit entry"}
      </button>
      {open && (
        <div className="basis-full">
          {form.values === null ? (
            <AdoptForm
              entryKey={entryKey}
              scannedName={form.scannedName}
              wires={form.options.wires}
              defaultWire={form.options.defaultWire}
              onAdopt={(adoption) => {
                entry.onSave(bird.id, { ...emptyEntryValues(), ...adoption });
                close();
              }}
              onCancel={close}
            />
          ) : (
            <EntryEditor
              entryKey={entryKey}
              scannedName={form.scannedName}
              values={form.values}
              options={form.options}
              onSave={(values) => {
                entry.onSave(bird.id, values);
                close();
              }}
              onUnadopt={() => {
                entry.onRemove(bird.id);
                close();
              }}
              onCancel={close}
            />
          )}
        </div>
      )}
    </>
  );
}

/** The whole project page, centred as one block; the ledger and paper sit side by side when wide. */
export function DetailView({
  bird,
  now,
  onLaunch,
  sheets,
  entry,
}: DetailViewProps) {
  const { detail } = bird;
  return (
    <article
      aria-label={`${bird.name} in full`}
      className="@container mx-auto max-w-390 motion-safe:animate-swap"
    >
      <DetailIntro bird={bird} night={isNight(skyPhase(now))} />
      <div className="mt-3.5 flex flex-wrap items-center gap-1">
        <LaunchActions actions={detail.actions} onLaunch={onLaunch} />
        <LinksOut links={detail.links} />
        <EntryPart bird={bird} entry={entry} />
      </div>
      <div className="mt-4 grid items-start gap-10 @min-[1040px]:grid-cols-[minmax(330px,430px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Ledger entries={detail.ledger} now={now} />
          {detail.branches.length > 0 && (
            <BranchLines branches={detail.branches} now={now} />
          )}
          {detail.newestCommits.map((commits) => (
            <NewestCommits key={commits.forge} commits={commits} now={now} />
          ))}
          {detail.pullRequests.length > 0 && (
            <PullRequestLines pullRequests={detail.pullRequests} now={now} />
          )}
          {detail.flags.length > 0 && <FlagLines flags={detail.flags} />}
          {detail.problems.length > 0 && (
            <SourceProblems problems={detail.problems} />
          )}
        </div>
        <KeyFilePaper sheets={sheets} />
      </div>
    </article>
  );
}
