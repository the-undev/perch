// The kinds of launch action and what each carries in code: its name, its icon, its default verb
// and commands, the placeholders those may use, and where it is offered. Config names a kind and
// only what differs from these. No Node modules, so the renderer may import it.

/** The app's named line icons, which a launch action wears. */
export const lineIcons = [
  "terminal",
  "code",
  "folder",
  "forge",
  "obsidian",
  "adopt",
  "edit",
] as const;

export type IconName = (typeof lineIcons)[number];

/** A kind that runs one command, its defaults in code. */
export type CommandKind = "vscode" | "nvim" | "folder" | "obsidian";

/** Every kind of launch action: the command kinds, zellij, and the custom command. */
export type LaunchKind = CommandKind | "zellij" | "command";

/** A kind as the Launching page names it, and as its shelf row says what it does and asks. */
export interface KindWords {
  name: string;
  /** What the kind does, in one sentence. */
  what: string;
  /** What adding it asks of the owner. */
  needs: string;
}

/** A command kind's words, icon, defaults and the placeholders its command may use. */
export interface CommandKindDefaults extends KindWords {
  icon: IconName;
  verb: string;
  command: readonly string[];
  placeholders: readonly string[];
  /** Offered on Obsidian birds only. */
  obsidianOnly: boolean;
}

export const commandKinds: Record<CommandKind, CommandKindDefaults> = {
  vscode: {
    name: "VS Code",
    what: "Opens the project folder in VS Code.",
    needs: "defaults filled in",
    icon: "code",
    verb: "Open in VS Code",
    command: ["code", "{path}"],
    placeholders: ["path"],
    obsidianOnly: false,
  },
  nvim: {
    name: "nvim",
    what: "Opens nvim in the project folder, in a new terminal window.",
    needs: "defaults filled in",
    icon: "edit",
    verb: "Open in nvim",
    command: ["alacritty", "--working-directory", "{path}", "-e", "nvim", "."],
    placeholders: ["path"],
    obsidianOnly: false,
  },
  folder: {
    name: "Folder",
    what: "Opens the folder in the file manager.",
    needs: "defaults filled in",
    icon: "folder",
    verb: "Open the folder",
    command: ["xdg-open", "{path}"],
    placeholders: ["path"],
    obsidianOnly: false,
  },
  obsidian: {
    name: "Obsidian",
    what: "Opens the Obsidian vault in Obsidian.",
    needs: "Obsidian birds only",
    icon: "obsidian",
    verb: "Open in Obsidian",
    command: ["xdg-open", "obsidian://open?vault={obsidian}"],
    placeholders: ["path", "obsidian"],
    obsidianOnly: true,
  },
};

/** The zellij kind's words, icon and defaults, and the placeholders its two commands may use. */
export interface ZellijKindDefaults extends KindWords {
  icon: IconName;
  verb: string;
  zellij: readonly string[];
  terminal: readonly string[];
  session: string;
  placeholders: { zellij: readonly string[]; terminal: readonly string[] };
}

export const zellijKind: ZellijKindDefaults = {
  name: "zellij tab",
  what: "Goes to the project's tab in its session, or opens one.",
  needs: "defaults filled in · once",
  icon: "terminal",
  verb: "Open the zellij tab",
  zellij: ["zellij"],
  terminal: [
    "alacritty",
    "--working-directory",
    "{cwd}",
    "-e",
    "zellij",
    "attach",
    "-c",
    "{session}",
  ],
  session: "main",
  placeholders: { zellij: [], terminal: ["session", "cwd"] },
};

/** The custom command's words, the icon it wears unless one is picked, and its placeholders. */
export interface CustomKindDefaults extends KindWords {
  icon: IconName;
  placeholders: readonly string[];
}

export const customKind: CustomKindDefaults = {
  name: "Custom command",
  what: "A verb and a command of your own.",
  needs: "blank",
  icon: "folder",
  placeholders: ["path", "obsidian"],
};

/** Every kind in the shelf's order, the custom command last. */
export const launchKinds: readonly LaunchKind[] = [
  "vscode",
  "zellij",
  "nvim",
  "folder",
  "obsidian",
  "command",
];

/** A kind's words on the page. */
export function kindWords(kind: LaunchKind): KindWords {
  if (kind === "zellij") return zellijKind;
  if (kind === "command") return customKind;
  return commandKinds[kind];
}
