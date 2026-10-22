import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { LaunchCommands } from "@perch/core/config.ts";
import type { LaunchAction } from "@perch/core/viewmodel.ts";
import { describe, expect, it, vi } from "vitest";
import { isWebUrl } from "./external-links.ts";
import {
  createSpawnDetached,
  fillCommand,
  type LaunchDeps,
  launch,
  runningSessions,
  type Spawn,
} from "./launch.ts";

const commands: LaunchCommands = {
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
  vscode: ["code", "{path}"],
  folder: ["dolphin", "{path}"],
  obsidian: ["xdg-open", "obsidian://open?vault={vault}"],
};

const zellijTab: LaunchAction = {
  kind: "zellij-tab",
  verb: "Open the zellij tab",
  session: "home",
  tab: "perch",
  cwd: "/home/owner/dev/perch",
};

/** Launch dependencies that record every command and answer zellij's questions from a script. */
function recorder(answers: Record<string, string>) {
  const run = vi.fn(async (argv: string[]) => {
    const answer = answers[argv.join(" ")];
    if (answer === undefined) return "";
    return answer;
  });
  const spawnDetached = vi.fn(async (_argv: string[]) => {});
  const deps: LaunchDeps = { run, spawnDetached };
  return { deps, run, spawnDetached };
}

describe("launch actions", () => {
  it("fill each placeholder and leave the rest of the command alone", () => {
    expect(
      fillCommand(["code", "--new-window", "{path}"], { path: "/a b" }),
    ).toEqual(["code", "--new-window", "/a b"]);
  });

  it("open VS Code and the folder on the project's directory", async () => {
    const { deps, spawnDetached } = recorder({});

    await launch(
      { kind: "vscode", verb: "Open in VS Code", path: "/home/owner/dev/a" },
      commands,
      deps,
    );
    await launch(
      { kind: "folder", verb: "Open the folder", path: "/home/owner/dev/a" },
      commands,
      deps,
    );

    expect(spawnDetached.mock.calls).toEqual([
      [["code", "/home/owner/dev/a"]],
      [["dolphin", "/home/owner/dev/a"]],
    ]);
  });

  it("open a vault in Obsidian by its name, encoded for the URI", async () => {
    const { deps, spawnDetached } = recorder({});

    await launch(
      { kind: "obsidian", verb: "Open in Obsidian", vault: "Home Notes" },
      commands,
      deps,
    );

    expect(spawnDetached).toHaveBeenCalledWith([
      "xdg-open",
      "obsidian://open?vault=Home%20Notes",
    ]);
  });

  it("go to the project's tab when its session has one", async () => {
    const { deps, run, spawnDetached } = recorder({
      "zellij list-sessions --no-formatting":
        "home [Created 2h ago] (current)\nundev [Created 1h ago]\n",
      "zellij --session home action query-tab-names": "dotfiles\nperch\n",
    });

    await launch(zellijTab, commands, deps);

    expect(run).toHaveBeenLastCalledWith([
      "zellij",
      "--session",
      "home",
      "action",
      "go-to-tab-name",
      "perch",
    ]);
    expect(spawnDetached).not.toHaveBeenCalled();
  });

  it("open a tab named after the project in its directory when the session has none", async () => {
    const { deps, run } = recorder({
      "zellij list-sessions --no-formatting": "home [Created 2h ago]\n",
      "zellij --session home action query-tab-names": "dotfiles\n",
    });

    await launch(zellijTab, commands, deps);

    expect(run).toHaveBeenLastCalledWith([
      "zellij",
      "--session",
      "home",
      "action",
      "new-tab",
      "--name",
      "perch",
      "--cwd",
      "/home/owner/dev/perch",
    ]);
  });

  it("open a terminal on a session that is not running", async () => {
    const { deps, run, spawnDetached } = recorder({
      "zellij list-sessions --no-formatting":
        "home [Created 2h ago] (EXITED - attach to resurrect)\n",
    });

    await launch(zellijTab, commands, deps);

    expect(run).toHaveBeenCalledTimes(1);
    expect(spawnDetached).toHaveBeenCalledWith([
      "alacritty",
      "--working-directory",
      "/home/owner/dev/perch",
      "-e",
      "zellij",
      "attach",
      "-c",
      "home",
    ]);
  });

  it("read a session listing's running names", () => {
    expect(
      runningSessions(
        "home [Created 1h ago] (current)\nold [Created 3d ago] (EXITED - attach to resurrect)\n\n",
      ),
    ).toEqual(["home"]);
  });

  it("refuse an action whose command config leaves out", async () => {
    const { deps } = recorder({});

    await expect(
      launch(
        { kind: "folder", verb: "Open the folder", path: "/a" },
        { ...commands, folder: null },
        deps,
      ),
    ).rejects.toThrow("no command in config for Open the folder");
  });
});

/** A child process that starts, or fails to, on the next tick. */
function fakeChild(outcome: "spawn" | Error) {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
  setTimeout(() => {
    if (outcome === "spawn") child.emit("spawn");
    else child.emit("error", outcome);
  }, 0);
  return child;
}

describe("starting a detached program", () => {
  it("spawns it detached with no stdio, and lets go once it starts", async () => {
    const child = fakeChild("spawn");
    const spawn = vi.fn(() => child as unknown as ChildProcess);
    const env = { PATH: "/usr/bin" };

    await createSpawnDetached(spawn as Spawn, { cwd: "/home/owner", env })([
      "code",
      "/home/owner/dev/a",
    ]);

    expect(spawn).toHaveBeenCalledWith("code", ["/home/owner/dev/a"], {
      cwd: "/home/owner",
      env,
      detached: true,
      stdio: "ignore",
    });
    expect(child.unref).toHaveBeenCalled();
  });

  it("rejects when the program cannot start", async () => {
    const spawn = vi.fn(
      () =>
        fakeChild(new Error("spawn nope ENOENT")) as unknown as ChildProcess,
    );

    await expect(
      createSpawnDetached(spawn as Spawn, { cwd: "/", env: {} })(["nope"]),
    ).rejects.toThrow("spawn nope ENOENT");
  });
});

describe("links out", () => {
  it("leave for the browser only when they are web pages", () => {
    expect(isWebUrl("https://github.com/finch/perch")).toBe(true);
    expect(isWebUrl("http://192.0.2.10:3000/finch/perch")).toBe(true);
    expect(isWebUrl("file:///etc/passwd")).toBe(false);
    expect(isWebUrl("docs/spec.md")).toBe(false);
    expect(isWebUrl("javascript:alert(1)")).toBe(false);
  });
});
