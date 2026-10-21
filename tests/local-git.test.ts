import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aggregate } from "../src/aggregate.ts";
import { parseConfig } from "../src/config.ts";
import { fileMtime } from "../src/fs.ts";
import { createLocalSource } from "../src/sources/local.ts";
import {
  fixtureGit,
  initRepo,
  makeTempDir,
  removeDir,
} from "./helpers/git-fixture.ts";
import {
  gatheredAt,
  localPresence,
  okStatus,
  rawFiles,
} from "./helpers/raw.ts";

let home: string;
beforeEach(() => {
  home = makeTempDir();
});
afterEach(() => {
  removeDir(home);
});

function source(include: string[], ignore: string[]) {
  return createLocalSource({
    home,
    include,
    ignore,
    runGit: fixtureGit,
    mtimeOf: fileMtime,
    concurrency: 2,
  });
}

describe("local source", () => {
  it("searches include directories, skips ignore paths and hidden folders, and records each include", async () => {
    initRepo(join(home, "dev", "perch"));
    initRepo(join(home, "dev", "all", "finch", "antler"));
    initRepo(join(home, "dev", "archived", "old"));
    initRepo(join(home, "dev", ".cache", "hidden"));
    initRepo(join(home, ".dotfiles"));

    const data = await source(
      [join(home, "dev"), join(home, ".dotfiles"), join(home, "missing")],
      [join(home, "dev", "archived")],
    ).gather({});

    expect(data.includes).toEqual({
      [join(home, "dev")]: { state: "observed", value: "directory" },
      [join(home, ".dotfiles")]: { state: "observed", value: "repo" },
      [join(home, "missing")]: { state: "absent", reason: "path-not-found" },
    });
    expect(
      Object.entries(data.presences).map(([id, presence]) => [
        id,
        presence.include,
      ]),
    ).toEqual([
      [".dotfiles", join(home, ".dotfiles")],
      ["dev/all/finch/antler", join(home, "dev")],
      ["dev/perch", join(home, "dev")],
    ]);
  });

  it("observes a vault by its .obsidian folder and records the LiveSync plugin folder", async () => {
    initRepo(join(home, "notes"));
    mkdirSync(
      join(home, "notes", ".obsidian", "plugins", "obsidian-livesync"),
      {
        recursive: true,
      },
    );
    initRepo(join(home, "plain"));

    const data = await source(
      [join(home, "notes"), join(home, "plain")],
      [],
    ).gather({});

    expect(data.presences.notes?.obsidian).toEqual({
      folder: true,
      livesyncPlugin: true,
    });
    expect(data.presences.plain?.obsidian).toEqual({
      folder: false,
      livesyncPlugin: false,
    });
  });

  it("keeps a presence whose git cannot be read, with the error as its git entry", async () => {
    const broken = join(home, "dev", "broken");
    mkdirSync(broken, { recursive: true });
    writeFileSync(join(broken, ".git"), "not a git file\n");

    const data = await source([join(home, "dev")], []).gather({});

    expect(data.presences["dev/broken"]?.git.state).toBe("error");
  });
});

describe("not set up", () => {
  it("flags red a repository found in an include directory that config does not know", async () => {
    const config = parseConfig(
      (
        await readFile(
          join(import.meta.dirname, "..", "config.example.toml"),
          "utf8",
        )
      ).replace("[forges]\n", '[items."dev/known"]\n\n[forges]\n'),
      "/home/test",
    );
    const files = rawFiles({
      includes: {
        "/home/test/dev": "directory",
        "/home/test/.dotfiles": "repo",
      },
      locals: {
        "dev/known": localPresence("/home/test/dev/known", {
          include: "/home/test/dev",
        }),
        "dev/stray": localPresence("/home/test/dev/stray", {
          include: "/home/test/dev",
        }),
        ".dotfiles": localPresence("/home/test/.dotfiles", {
          include: "/home/test/.dotfiles",
        }),
      },
      forges: {},
    });

    const snapshot = aggregate(
      { status: okStatus({}), files },
      { config, configPath: "c", liveSources: [] },
      new Date(gatheredAt),
    );
    const flags = Object.fromEntries(
      snapshot.items.map((item) => [item.id, item.flags]),
    );

    expect(flags["dev/stray"]).toEqual([
      {
        flag: "not-set-up",
        level: "red",
        detail: "found under /home/test/dev with no entry in config items",
      },
    ]);
    expect(flags["dev/known"]).toEqual([]);
    expect(flags[".dotfiles"]).toEqual([]);
  });
});
