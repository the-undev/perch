// The launch actions as the settings page edits them: a card's values, the kind's defaults it shows
// until overridden, and what a card's fields cannot be. A field left empty on a kind's card holds
// the kind's default; a custom command has no defaults but its icon. Commands are list lines,
// session roots are written with ~. No Node modules, so the renderer may import it.

import {
  type LaunchActionConfig,
  launchCommandProblem,
  placeholdersIn,
} from "./config.ts";
import {
  type CommandKind,
  commandKinds,
  customKind,
  type IconName,
  type LaunchKind,
  zellijKind,
} from "./launch-kinds.ts";
import { listLine, listOf, parseListLine } from "./list-line.ts";

/** A zellij session and the root directory whose items it holds. */
export interface SessionRoot {
  /** The root as shown: a path under the home directory starts with ~. */
  root: string;
  session: string;
}

/** One launch action's card: its kind, its verb and each command as a list line, empty for the default. */
export type LaunchActionValues =
  | { kind: CommandKind; verb: string; command: string }
  | { kind: "command"; verb: string; command: string; icon: IconName }
  | {
      kind: "zellij";
      verb: string;
      zellij: string;
      terminal: string;
      session: string;
      sessions: SessionRoot[];
    };

/** A fresh card of a kind: just its kind, everything else its defaults, a custom command blank. */
export function newCard(kind: LaunchKind): LaunchActionValues {
  if (kind === "command") {
    return { kind, verb: "", command: "", icon: customKind.icon };
  }
  if (kind === "zellij") {
    return {
      kind,
      verb: "",
      zellij: "",
      terminal: "",
      session: "",
      sessions: [],
    };
  }
  return { kind, verb: "", command: "" };
}

/** Whether the shelf holds a kind back: zellij once a zellij action exists. */
export function kindTaken(
  actions: readonly LaunchActionValues[],
  kind: LaunchKind,
): boolean {
  return kind === "zellij" && actions.some((action) => action.kind === kind);
}

/** The actions with a fresh card of the kind added at the end. */
export function withKindAdded(
  actions: readonly LaunchActionValues[],
  kind: LaunchKind,
): LaunchActionValues[] {
  return [...actions, newCard(kind)];
}

/** What a kind's fields hold until overridden, as the card shows them; empty where it has none. */
export function launchDefaults(
  kind: LaunchKind,
): Record<"verb" | "command" | "zellij" | "terminal" | "session", string> {
  const none = { verb: "", command: "", zellij: "", terminal: "", session: "" };
  if (kind === "command") return none;
  if (kind === "zellij") {
    return {
      ...none,
      verb: zellijKind.verb,
      zellij: listLine(zellijKind.zellij),
      terminal: listLine(zellijKind.terminal),
      session: zellijKind.session,
    };
  }
  const defaults = commandKinds[kind];
  return {
    ...none,
    verb: defaults.verb,
    command: listLine(defaults.command),
  };
}

/** The words the bird's page will show for a card: its own, else its kind's. */
export function cardVerb(action: LaunchActionValues): string {
  return action.verb === "" ? launchDefaults(action.kind).verb : action.verb;
}

/** The icon a card wears: a custom command's picked icon, else its kind's. */
export function cardIcon(action: LaunchActionValues): IconName {
  if (action.kind === "command") return action.icon;
  if (action.kind === "zellij") return zellijKind.icon;
  return commandKinds[action.kind].icon;
}

/** Whether a card is offered on Obsidian birds only: the Obsidian kind, or a custom command using {obsidian}. */
export function cardObsidianOnly(action: LaunchActionValues): boolean {
  if (action.kind === "zellij") return false;
  if (action.kind !== "command") return commandKinds[action.kind].obsidianOnly;
  const parsed = parseListLine(action.command);
  return "list" in parsed && placeholdersIn(parsed.list).includes("obsidian");
}

/** A config value as a card shows it: empty when it is the kind's default. */
function shown(value: string, fallback: string): string {
  return value === fallback ? "" : value;
}

/** A config action as its card's values, roots shown through path. */
export function launchValuesOf(
  action: LaunchActionConfig,
  path: (stored: string) => string,
): LaunchActionValues {
  const defaults = launchDefaults(action.kind);
  if (action.kind === "command") {
    return {
      kind: action.kind,
      verb: action.verb,
      command: listLine(action.command),
      icon: action.icon,
    };
  }
  if (action.kind === "zellij") {
    return {
      kind: action.kind,
      verb: shown(action.verb, defaults.verb),
      zellij: shown(listLine(action.zellij), defaults.zellij),
      terminal: shown(listLine(action.terminal), defaults.terminal),
      session: shown(action.session, defaults.session),
      sessions: Object.entries(action.sessions).map(([root, session]) => ({
        root: path(root),
        session,
      })),
    };
  }
  return {
    kind: action.kind,
    verb: shown(action.verb, defaults.verb),
    command: shown(listLine(action.command), defaults.command),
  };
}

/** A card's text, or its kind's default when the field is empty. */
function orDefault(value: string, fallback: string): string {
  return value.trim() === "" ? fallback : value;
}

/** A card's values as a config action, roots stored through path; the card has no problems. */
export function launchConfigOf(
  values: LaunchActionValues,
  path: (shown: string) => string,
): LaunchActionConfig {
  const defaults = launchDefaults(values.kind);
  if (values.kind === "command") {
    return {
      kind: values.kind,
      verb: values.verb,
      command: listOf(values.command),
      icon: values.icon,
    };
  }
  if (values.kind === "zellij") {
    return {
      kind: values.kind,
      verb: orDefault(values.verb, defaults.verb),
      zellij: listOf(orDefault(values.zellij, defaults.zellij)),
      terminal: listOf(orDefault(values.terminal, defaults.terminal)),
      session: orDefault(values.session, defaults.session),
      sessions: Object.fromEntries(
        values.sessions.map(({ root, session }) => [path(root), session]),
      ),
    };
  }
  return {
    kind: values.kind,
    verb: orDefault(values.verb, defaults.verb),
    command: listOf(orDefault(values.command, defaults.command)),
  };
}

/** A field of a launch action's card. */
export type LaunchField =
  | "verb"
  | "command"
  | "zellij"
  | "terminal"
  | "session"
  | "sessions";

/** Each field's label on its card. */
export const launchFieldLabels: Record<LaunchField, string> = {
  verb: "Action",
  command: "Command",
  zellij: "zellij command",
  terminal: "Terminal command",
  session: "Session",
  sessions: "Sessions by root",
};

/** Why one field of one card cannot be written. */
export interface LaunchProblem {
  index: number;
  field: LaunchField;
  problem: string;
}

const isBlank = (text: string) => text.trim() === "";

const isAbsolute = (path: string) =>
  path.startsWith("/") || path === "~" || path.startsWith("~/");

/**
 * Why a command line cannot be written with the placeholders allowed, or null when it can; an
 * empty line takes the kind's default, which a custom command has none of.
 */
function commandLineProblem(
  line: string,
  allowed: readonly string[],
  custom: boolean,
): string | null {
  if (isBlank(line)) return custom ? "needs a command" : null;
  const parsed = parseListLine(line);
  if ("problem" in parsed) return parsed.problem;
  return launchCommandProblem(parsed.list, allowed);
}

/** Why the session roots cannot be written, or null when they can. */
function sessionsProblem(sessions: readonly SessionRoot[]): string | null {
  if (!sessions.every(({ root }) => isAbsolute(root))) {
    return "each root must start with / or ~";
  }
  if (sessions.some(({ session }) => isBlank(session))) {
    return "every root needs a session name";
  }
  const roots = sessions.map(({ root }) => root);
  if (new Set(roots).size !== roots.length) return "each root once";
  return null;
}

/** Why the launch actions cannot be written, field by field; empty when they can. */
export function launchProblems(
  actions: readonly LaunchActionValues[],
): LaunchProblem[] {
  const problems: LaunchProblem[] = [];
  let zellijSeen = false;
  actions.forEach((action, index) => {
    const add = (field: LaunchField, problem: string | null) => {
      if (problem !== null) problems.push({ index, field, problem });
    };
    if (action.kind === "command") {
      add(
        "verb",
        isBlank(action.verb) ? "needs words for the bird's page" : null,
      );
      add(
        "command",
        commandLineProblem(action.command, customKind.placeholders, true),
      );
      return;
    }
    if (action.kind !== "zellij") {
      add(
        "command",
        commandLineProblem(
          action.command,
          commandKinds[action.kind].placeholders,
          false,
        ),
      );
      return;
    }
    add(
      "zellij",
      zellijSeen
        ? "a second zellij action; there may be one"
        : commandLineProblem(
            action.zellij,
            zellijKind.placeholders.zellij,
            false,
          ),
    );
    add(
      "terminal",
      commandLineProblem(
        action.terminal,
        zellijKind.placeholders.terminal,
        false,
      ),
    );
    add("sessions", sessionsProblem(action.sessions));
    zellijSeen = true;
  });
  return problems;
}

/** A launch problem as one line naming its card and field. */
export function launchProblemLine({
  index,
  field,
  problem,
}: LaunchProblem): string {
  const label = launchFieldLabels[field];
  return `Launch action ${index + 1}, ${label.charAt(0).toLowerCase()}${label.slice(1)}: ${problem}`;
}
