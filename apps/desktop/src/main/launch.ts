// Launch actions open things and change nothing perch reads. Each runs the command config gives
// it, with the action's own values filled in, without a shell.

import type { ChildProcess, SpawnOptions } from "node:child_process";
import type { LaunchCommands } from "@perch/core/config.ts";
import type { LaunchAction } from "@perch/core/viewmodel.ts";

export interface LaunchDeps {
  /** Runs a short command to completion and resolves with its output; rejects when it fails. */
  run: (argv: string[]) => Promise<string>;
  /** Starts a program that outlives the call, detached from perch; rejects when it cannot start. */
  spawnDetached: (argv: string[]) => Promise<void>;
}

/** A command template with each {placeholder} replaced by its value. */
export function fillCommand(
  template: readonly string[],
  values: Record<string, string>,
): string[] {
  return template.map((part) =>
    part.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole),
  );
}

/** The sessions `zellij list-sessions --no-formatting` names as running; exited ones are not. */
export function runningSessions(listing: string): string[] {
  return listing
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.includes("EXITED"))
    .map((line) => line.trim().split(/\s+/)[0] ?? "");
}

function commandFor(command: string[] | null, action: LaunchAction): string[] {
  if (command === null) {
    throw new Error(`no command in config for ${action.verb}`);
  }
  return command;
}

/**
 * Goes to the project's tab in its zellij session, or opens one there in its directory. A session
 * that is not running opens in a terminal. A failed listing counts as none running.
 */
async function openZellijTab(
  action: Extract<LaunchAction, { kind: "zellij-tab" }>,
  commands: LaunchCommands,
  deps: LaunchDeps,
): Promise<void> {
  const zellij = commandFor(commands.zellij, action);
  const terminal = commandFor(commands.terminal, action);
  const listing = await deps
    .run([...zellij, "list-sessions", "--no-formatting"])
    .catch(() => "");
  if (!runningSessions(listing).includes(action.session)) {
    await deps.spawnDetached(
      fillCommand(terminal, { session: action.session, cwd: action.cwd }),
    );
    return;
  }
  const inSession = [...zellij, "--session", action.session, "action"];
  const tabs = (await deps.run([...inSession, "query-tab-names"]))
    .split("\n")
    .map((line) => line.trim());
  if (tabs.includes(action.tab)) {
    await deps.run([...inSession, "go-to-tab-name", action.tab]);
    return;
  }
  await deps.run([
    ...inSession,
    "new-tab",
    "--name",
    action.tab,
    "--cwd",
    action.cwd,
  ]);
}

/** Performs one launch action with the commands from config. */
export async function launch(
  action: LaunchAction,
  commands: LaunchCommands,
  deps: LaunchDeps,
): Promise<void> {
  switch (action.kind) {
    case "zellij-tab":
      return openZellijTab(action, commands, deps);
    case "vscode":
      return deps.spawnDetached(
        fillCommand(commandFor(commands.vscode, action), { path: action.path }),
      );
    case "folder":
      return deps.spawnDetached(
        fillCommand(commandFor(commands.folder, action), { path: action.path }),
      );
    case "obsidian":
      return deps.spawnDetached(
        fillCommand(commandFor(commands.obsidian, action), {
          vault: encodeURIComponent(action.vault),
        }),
      );
  }
}

/** Node's spawn, as far as starting a detached program needs it. */
export type Spawn = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;

/**
 * Starts programs detached in their own process group with no stdio, so they outlive perch and
 * perch never waits on them. Resolves once the program has started.
 */
export function createSpawnDetached(
  spawn: Spawn,
  options: { cwd: string; env: NodeJS.ProcessEnv },
): LaunchDeps["spawnDetached"] {
  return ([program, ...args]) =>
    new Promise((resolve, reject) => {
      if (program === undefined) {
        reject(new Error("an empty command"));
        return;
      }
      const child = spawn(program, args, {
        cwd: options.cwd,
        env: options.env,
        detached: true,
        stdio: "ignore",
      });
      child.once("error", reject);
      child.once("spawn", () => {
        child.unref();
        resolve();
      });
    });
}
