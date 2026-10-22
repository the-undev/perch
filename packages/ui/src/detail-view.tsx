// Tier C: a bird's full page. The mood and speech continue from the bubble, then the launch
// actions and links out, then the ledger and its sections beside the key files on paper. Only
// what exists is shown. The view fetches nothing: key-file contents and launching are the caller's.

import type { Bird, LaunchAction } from "@perch/core/viewmodel.ts";
import { LaunchActions, LinksOut } from "./actions.tsx";
import { DetailIntro } from "./detail-intro.tsx";
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
}

/** The whole project page, centred as one block; the ledger and paper sit side by side when wide. */
export function DetailView({ bird, now, onLaunch, sheets }: DetailViewProps) {
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
