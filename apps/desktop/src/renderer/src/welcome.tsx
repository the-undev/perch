// The window without a config file: what perch needs, where it reads it, and the two ways on.

const buttonClass =
  "inline-flex cursor-pointer items-center rounded-lg px-3.5 py-2 font-body font-semibold text-[13px] focus-visible:outline-2 focus-visible:outline-ink-accent focus-visible:outline-offset-1";

export interface WelcomeProps {
  problems: string[];
  onWriteStarter: () => void;
  onCheckAgain: () => void;
}

/** Shown while no config file exists: nothing scans until one does. */
export function Welcome({
  problems,
  onWriteStarter,
  onCheckAgain,
}: WelcomeProps) {
  return (
    <main
      aria-labelledby="welcome-title"
      className="flex h-full flex-col items-center justify-center bg-bg px-4 text-ink"
    >
      <div className="flex max-w-[58ch] flex-col gap-3 font-body text-[14px] text-ink-muted leading-relaxed">
        <h1
          id="welcome-title"
          className="m-0 font-bold font-display text-[26px] text-ink"
        >
          perch
        </h1>
        <p className="m-0">
          Birds need a wire before they can perch. perch reads where to look
          from one file, and it is not there yet:
        </p>
        <code className="self-start rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-[13px] text-ink">
          ~/.config/perch/config.toml
        </code>
        <p className="m-0">
          A starter config looks in <code className="font-mono">~/dev</code> and{" "}
          <code className="font-mono">~/.dotfiles</code>. Edit it to suit: perch
          reads it again before every scan.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onWriteStarter}
            className={`${buttonClass} bg-paper text-paper-head hover:bg-paper-dim`}
          >
            Write a starter config
          </button>
          <button
            type="button"
            onClick={onCheckAgain}
            className={`${buttonClass} border border-edge text-ink-muted hover:bg-panel hover:text-ink`}
          >
            Check again
          </button>
        </div>
        {problems.map((problem) => (
          <p key={problem} className="m-0 text-[12px] text-amber">
            {problem}
          </p>
        ))}
      </div>
    </main>
  );
}
