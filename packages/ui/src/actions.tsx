// The detail page's verbs and links: launch actions open things and change nothing; links out go
// to the bird's pages on its forges.

import type { LaunchAction, LinkOut } from "@perch/core/viewmodel.ts";
import { actionIcon, Icon } from "./icons.tsx";

/** A verb on the detail page's action row: quiet until hovered. */
export const actionClass =
  "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-3.25 py-2.25 font-body font-medium text-[13.5px] text-ink-muted no-underline hover:border-edge hover:bg-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-ink-accent focus-visible:outline-offset-1";

function Away() {
  return <span className="text-[11px] text-ink-faint">↗</span>;
}

export interface LaunchActionsProps {
  actions: LaunchAction[];
  onLaunch: (action: LaunchAction) => void;
}

/** The launch actions as verbs, each with its icon; pressing one hands it back to the caller. */
export function LaunchActions({ actions, onLaunch }: LaunchActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {actions.map((action, index) => (
        <button
          // biome-ignore lint/suspicious/noArrayIndexKey: a bird's actions are a fixed list in config order, and two may share a kind or a verb.
          key={index}
          type="button"
          onClick={() => onLaunch(action)}
          className={actionClass}
        >
          <Icon name={actionIcon[action.kind]} size={15} />
          {action.verb}
          <Away />
        </button>
      ))}
    </div>
  );
}

/** The bird's repositories on its forges, as links that leave the app. */
export function LinksOut({ links }: { links: LinkOut[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className={actionClass}
        >
          <Icon name="forge" size={15} />
          {link.label}
          <Away />
        </a>
      ))}
    </div>
  );
}
