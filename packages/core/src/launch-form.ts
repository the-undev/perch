// The launch actions as the settings page edits them: the presets the shelf offers, a card's
// values and name, and what a card's fields cannot be. Commands are list lines, session roots are
// written with ~. No Node modules, so the renderer may import it.

import {
  type LaunchActionConfig,
  launchCommandProblem,
  launchPlaceholders,
} from "./config.ts";
import { listLine, listOf, parseListLine } from "./list-line.ts";

/** A zellij session and the root directory whose items it holds. */
export interface SessionRoot {
  /** The root as shown: a path under the home directory starts with ~. */
  root: string;
  session: string;
}

/** One launch action's card: its verb and each command as a list line. */
export type LaunchActionValues =
  | { kind: "command"; verb: string; command: string }
  | {
      kind: "zellij";
      verb: string;
      zellij: string;
      terminal: string;
      session: string;
      sessions: SessionRoot[];
    };

/** A preset on the shelf: its name, what it does, what adding it asks, and the card it fills. */
export interface LaunchPreset {
  name: string;
  what: string;
  needs: string;
  values: LaunchActionValues;
}

/** The presets the shelf offers, in its order; adding one drops a card already filled in. */
export const launchPresets: readonly LaunchPreset[] = [
  {
    name: "VS Code",
    what: "Opens the project folder in VS Code.",
    needs: "filled in",
    values: {
      kind: "command",
      verb: "Open in VS Code",
      command: listLine(["code", "{path}"]),
    },
  },
  {
    name: "zellij tab",
    what: "Goes to the project's tab in its session, or opens one.",
    needs: "filled in · once",
    values: {
      kind: "zellij",
      verb: "Open the zellij tab",
      zellij: listLine(["zellij"]),
      terminal: listLine([
        "alacritty",
        "--working-directory",
        "{cwd}",
        "-e",
        "zellij",
        "attach",
        "-c",
        "{session}",
      ]),
      session: "main",
      sessions: [],
    },
  },
  {
    name: "nvim",
    what: "Opens nvim in the project folder, in a new terminal window.",
    needs: "filled in",
    values: {
      kind: "command",
      verb: "Open in nvim",
      command: listLine([
        "alacritty",
        "--working-directory",
        "{path}",
        "-e",
        "nvim",
        ".",
      ]),
    },
  },
  {
    name: "Folder",
    what: "Opens the folder in the file manager.",
    needs: "filled in",
    values: {
      kind: "command",
      verb: "Open the folder",
      command: listLine(["xdg-open", "{path}"]),
    },
  },
  {
    name: "Obsidian",
    what: "Opens the item in Obsidian.",
    needs: "Obsidian only",
    values: {
      kind: "command",
      verb: "Open in Obsidian",
      command: listLine(["xdg-open", "obsidian://open?vault={obsidian}"]),
    },
  },
  {
    name: "Custom command",
    what: "A verb and a command of your own.",
    needs: "you write it",
    values: { kind: "command", verb: "", command: "" },
  },
];

const customPreset = launchPresets[launchPresets.length - 1] as LaunchPreset;

/** Whether two list lines hold the same strings; a line that does not parse matches nothing. */
function sameLine(a: string, b: string): boolean {
  const left = parseListLine(a);
  const right = parseListLine(b);
  if ("problem" in left || "problem" in right) return false;
  return JSON.stringify(left.list) === JSON.stringify(right.list);
}

/**
 * The preset a card shows it came from: zellij's for the zellij action, else the preset running the
 * same command, else the custom command.
 */
export function presetOf(action: LaunchActionValues): LaunchPreset {
  const match = launchPresets.find(({ values }) => {
    if (values.kind === "zellij") return action.kind === "zellij";
    return (
      action.kind === "command" && sameLine(values.command, action.command)
    );
  });
  return match ?? customPreset;
}

/** Whether the shelf holds a preset back: zellij once a zellij action exists. */
export function presetTaken(
  actions: readonly LaunchActionValues[],
  preset: LaunchPreset,
): boolean {
  return (
    preset.values.kind === "zellij" &&
    actions.some((action) => action.kind === "zellij")
  );
}

/** The actions with a card of the preset added at the end, its values a copy. */
export function withPresetAdded(
  actions: readonly LaunchActionValues[],
  preset: LaunchPreset,
): LaunchActionValues[] {
  return [...actions, structuredClone(preset.values)];
}

/** A config action as its card's values, roots shown through path. */
export function launchValuesOf(
  action: LaunchActionConfig,
  path: (stored: string) => string,
): LaunchActionValues {
  if (action.kind === "command") {
    return {
      kind: "command",
      verb: action.verb,
      command: listLine(action.command),
    };
  }
  return {
    kind: "zellij",
    verb: action.verb,
    zellij: listLine(action.zellij),
    terminal: listLine(action.terminal),
    session: action.session,
    sessions: Object.entries(action.sessions).map(([root, session]) => ({
      root: path(root),
      session,
    })),
  };
}

/** A card's values as a config action, roots stored through path; the card has no problems. */
export function launchConfigOf(
  values: LaunchActionValues,
  path: (shown: string) => string,
): LaunchActionConfig {
  if (values.kind === "command") {
    return {
      kind: "command",
      verb: values.verb,
      command: listOf(values.command),
    };
  }
  return {
    kind: "zellij",
    verb: values.verb,
    zellij: listOf(values.zellij),
    terminal: listOf(values.terminal),
    session: values.session,
    sessions: Object.fromEntries(
      values.sessions.map(({ root, session }) => [path(root), session]),
    ),
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

/** Why a command line cannot be written with the placeholders allowed, or null when it can. */
function commandLineProblem(
  line: string,
  allowed: readonly string[],
): string | null {
  if (isBlank(line)) return "needs a command";
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
    add(
      "verb",
      isBlank(action.verb) ? "needs words for the bird's page" : null,
    );
    if (action.kind === "command") {
      add(
        "command",
        commandLineProblem(action.command, launchPlaceholders.command),
      );
      return;
    }
    add(
      "zellij",
      zellijSeen
        ? "a second zellij action; there may be one"
        : commandLineProblem(action.zellij, launchPlaceholders.zellij),
    );
    add(
      "terminal",
      commandLineProblem(action.terminal, launchPlaceholders.terminal),
    );
    add("session", isBlank(action.session) ? "needs a session name" : null);
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
