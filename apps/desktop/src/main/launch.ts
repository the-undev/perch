// Launch actions open things and change nothing perch reads. Each runs the commands it carries
// from config, its placeholders filled in with the action's own values, without a shell. The
// config file opens the same way, by an action chosen here from config's own.

import type { ChildProcess, SpawnOptions } from "node:child_process";
import { dirname } from "node:path";
import type {
  KindActionConfig,
  LaunchActionConfig,
} from "@perch/core/config.ts";
import { commandKinds } from "@perch/core/launch-kinds.ts";
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

/**
 * Goes to the project's tab in its zellij session, or opens one there in its directory. A session
 * that is not running opens in a terminal. A failed listing counts as none running.
 */
async function openZellijTab(
  action: Extract<LaunchAction, { kind: "zellij" }>,
  deps: LaunchDeps,
): Promise<void> {
  const listing = await deps
    .run([...action.zellij, "list-sessions", "--no-formatting"])
    .catch(() => "");
  if (!runningSessions(listing).includes(action.session)) {
    await deps.spawnDetached(
      fillCommand(action.terminal, {
        session: action.session,
        cwd: action.cwd,
      }),
    );
    return;
  }
  const inSession = [...action.zellij, "--session", action.session, "action"];
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

/**
 * Performs one launch action: {path} takes the item's directory as it is, {obsidian} the Obsidian
 * vault's folder name encoded for a URI, and the zellij action finds or opens its tab.
 */
export async function launch(
  action: LaunchAction,
  deps: LaunchDeps,
): Promise<void> {
  switch (action.kind) {
    case "zellij":
      return openZellijTab(action, deps);
    case "command":
      return deps.spawnDetached(
        fillCommand(action.command, { path: action.path }),
      );
    case "obsidian":
      return deps.spawnDetached(
        fillCommand(action.command, {
          path: action.path,
          obsidian: encodeURIComponent(action.obsidianVault),
        }),
      );
  }
}

/** The words a failure to open the config file is reported under. */
export const configFileVerb = "Open the config file";

/**
 * The action that opens the config file: the first VS Code action with the file filling {path},
 * else the first folder action's command, or the folder kind's default, on the file's directory.
 */
export function configFileAction(
  actions: readonly LaunchActionConfig[],
  configPath: string,
): LaunchAction {
  const kindAction = (kind: "vscode" | "folder") =>
    actions.find((action): action is KindActionConfig => action.kind === kind);
  const vscode = kindAction("vscode");
  if (vscode !== undefined) {
    return {
      kind: "command",
      verb: configFileVerb,
      icon: commandKinds.vscode.icon,
      command: vscode.command,
      path: configPath,
    };
  }
  return {
    kind: "command",
    verb: configFileVerb,
    icon: commandKinds.folder.icon,
    command: kindAction("folder")?.command ?? [...commandKinds.folder.command],
    path: dirname(configPath),
  };
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
