// A bird seen on its forges with no local repository on this machine says so where its key files
// would be: a paper slip cut short, stamped with the cause, the fact, the routes to a local
// repository, Open Sources and the address to clone from. The meta line carries the cause in three
// words. The slip copies nothing itself and opens nothing: the caller puts the address on the
// clipboard and opens Sources.

import type { NoLocalRepository } from "@perch/core/viewmodel.ts";
import { useEffect, useId, useState } from "react";

/** How long the copy control says what happened before it reads Copy again. */
const copySayMs = 1600;

type CopyOutcome = "idle" | "copied" | "failed";

const copyWords: Record<CopyOutcome, string> = {
  idle: "Copy",
  copied: "Copied",
  failed: "Couldn't copy",
};

/** The SSH address in mono, cut short when narrow, and the control that copies it. */
function SshAddress({
  address,
  onCopy,
}: {
  address: string;
  onCopy: (text: string) => Promise<void>;
}) {
  const [outcome, setOutcome] = useState<CopyOutcome>("idle");
  useEffect(() => {
    if (outcome === "idle") return;
    const timer = setTimeout(() => setOutcome("idle"), copySayMs);
    return () => clearTimeout(timer);
  }, [outcome]);
  return (
    <span
      data-part="ssh-address"
      className="flex min-w-0 max-w-full items-center gap-1.5 font-mono text-[11.5px] text-paper-quiet"
    >
      <code
        title={address}
        className="min-w-0 truncate rounded bg-paper-dim px-1.5 py-0.5"
      >
        {address}
      </code>
      <button
        type="button"
        onClick={() =>
          void onCopy(address).then(
            () => setOutcome("copied"),
            () => setOutcome("failed"),
          )
        }
        className="cursor-pointer whitespace-nowrap font-body font-semibold text-[11.5px] text-paper-ink hover:underline focus-visible:outline-2 focus-visible:outline-paper-head focus-visible:outline-offset-1"
      >
        <span aria-live="polite">{copyWords[outcome]}</span>
      </button>
    </span>
  );
}

export interface NoLocalRepositorySlipProps {
  slip: NoLocalRepository;
  /** Open Sources was pressed: the settings page opens on Sources, the local cards unfolded. */
  onLocalSources: () => void;
  /** Puts the SSH address on the clipboard, settling once it is there. */
  onCopy: (text: string) => Promise<void>;
}

/** The slip at its reading width: the stamp, the fact, the routes, Open Sources and the address when known. */
export function NoLocalRepositorySlip({
  slip,
  onLocalSources,
  onCopy,
}: NoLocalRepositorySlipProps) {
  const stampId = useId();
  return (
    <section
      aria-labelledby={stampId}
      data-part="no-local-repository-slip"
      className="perch-slip relative ml-4.5 max-w-[46ch] rounded-md bg-paper px-5 pt-4.5 pb-4 text-paper-ink shadow-paper"
    >
      <h3
        id={stampId}
        className="perch-stamp m-0 mb-3 inline-block rounded-md border-2 border-paper-stamp px-2.5 py-1 font-bold font-display text-[14.5px] text-paper-stamp leading-tight tracking-[0.01em] opacity-85"
      >
        No local repository on this machine
      </h3>
      <p className="m-0 mb-2 text-[13.5px] leading-normal">
        This repository is on {slip.forges}. No local repository was found.
      </p>
      <p className="m-0 text-[12.5px] text-paper-quiet leading-normal">
        Add a directory to search, or the local repository's folder itself, in
        Sources. A local repository whose remote points at{" "}
        <code className="whitespace-nowrap rounded bg-paper-dim px-1.25 py-px font-mono text-[12px]">
          {slip.reference}
        </code>{" "}
        is linked to this bird on the next scan.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onLocalSources}
          className="cursor-pointer rounded-lg border border-paper-ink bg-paper-ink px-3 py-1.5 font-body font-semibold text-[12.5px] text-paper hover:bg-paper-head focus-visible:outline-2 focus-visible:outline-paper-head focus-visible:outline-offset-2"
        >
          Open Sources
        </button>
        {slip.sshAddress !== null && (
          <SshAddress address={slip.sshAddress} onCopy={onCopy} />
        )}
      </div>
    </section>
  );
}

/** The meta line's clause where the launch actions would sit, in the faint voice. */
export function NoLocalRepositoryClause() {
  return (
    <span
      data-part="no-local-repository"
      className="px-1 font-body text-[12.5px] text-ink-faint"
    >
      no local repository
    </span>
  );
}
