import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTextIfExists } from "@perch/core/fs.ts";
import { sourceRunHeld } from "@perch/core/settings-form.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  autostartPath,
  createAutostart,
  entryText,
  execTarget,
  removeFile,
  replaceFile,
} from "./autostart.ts";
import { parseArguments } from "./command-line.ts";

const image = "/home/owner/Applications/perch-0.2.0-x86_64.AppImage";

let dir: string;
let entryPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "perch-autostart-"));
  entryPath = join(dir, "autostart", "perch.desktop");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** The autostart entry on the temp directory, for a run from the image or, given null, from source. */
const autostart = (running: string | null) =>
  createAutostart({
    path: entryPath,
    image: running,
    readText: readTextIfExists,
    writeText: replaceFile,
    remove: removeFile,
  });

const written = () => readTextIfExists(entryPath);

/** The Exec line's words, as a launch would receive them. */
const execWords = (text: string) =>
  (text.split("\n").find((line) => line.startsWith("Exec=")) ?? "")
    .slice("Exec=".length)
    .split(" ");

describe("the autostart entry", () => {
  it("lives under XDG_CONFIG_HOME when it is absolute, else under ~/.config", () => {
    expect(autostartPath("/home/owner", undefined)).toBe(
      "/home/owner/.config/autostart/perch.desktop",
    );
    expect(autostartPath("/home/owner", "/srv/config")).toBe(
      "/srv/config/autostart/perch.desktop",
    );
    expect(autostartPath("/home/owner", "config")).toBe(
      "/home/owner/.config/autostart/perch.desktop",
    );
  });

  it("runs the image hidden in the tray while the tray is on", () => {
    const text = entryText(image, true);

    expect(text).toBe(
      `[Desktop Entry]\nType=Application\nName=Perch\nExec=${image} --hidden\n`,
    );
    expect(parseArguments(execWords(text)).hidden).toBe(true);
  });

  it("runs the image with the window open while the tray is off", () => {
    const text = entryText(image, false);

    expect(text).toBe(
      `[Desktop Entry]\nType=Application\nName=Perch\nExec=${image}\n`,
    );
    expect(parseArguments(execWords(text))).toMatchObject({
      window: "show",
      hidden: false,
    });
  });

  it("quotes an image path the Exec key cannot hold bare, and reads it back", () => {
    const spaced = '/home/owner/My Apps/perch "100%".AppImage';

    expect(execTarget(entryText(spaced, true))).toBe(spaced);
    expect(execTarget(entryText(image, true))).toBe(image);
    expect(execTarget("[Desktop Entry]\nExec=perch --hidden\n")).toBe("perch");
    expect(execTarget("[Desktop Entry]\nName=Perch\n")).toBeNull();
  });

  it("reads the toggle from whether the entry exists, with the program it runs", async () => {
    expect(await autostart(image).read()).toEqual({
      on: false,
      held: null,
      path: entryPath,
      target: null,
    });

    await mkdir(join(dir, "autostart"));
    await writeFile(entryPath, entryText("/opt/perch-0.1.0.AppImage", true));

    expect(await autostart(image).read()).toEqual({
      on: true,
      held: null,
      path: entryPath,
      target: "/opt/perch-0.1.0.AppImage",
    });
  });

  it("writes the entry for the tray setting when login is turned on, and removes it when turned off", async () => {
    await autostart(image).save({ tray: true, login: true });
    expect(await written()).toBe(entryText(image, true));

    await autostart(image).save({ tray: false, login: true });
    expect(await written()).toBe(entryText(image, false));
    expect(await readdir(join(dir, "autostart"))).toEqual(["perch.desktop"]);

    await autostart(image).save({ tray: false, login: false });
    expect(await written()).toBeNull();
    await autostart(image).save({ tray: false, login: false });
    expect(await written()).toBeNull();
  });

  it("repoints an existing entry at the running image on start, and leaves a missing one alone", async () => {
    await autostart(image).repoint(true);
    expect(await readdir(dir)).toEqual([]);

    await mkdir(join(dir, "autostart"));
    await writeFile(entryPath, entryText("/opt/perch-0.1.0.AppImage", true));
    await autostart(image).repoint(false);

    expect(await written()).toBe(entryText(image, false));
  });

  it("neither writes nor removes the entry without an AppImage, and holds the toggle", async () => {
    const fromSource = autostart(null);

    await fromSource.save({ tray: true, login: true });
    await fromSource.repoint(true);
    expect(await readdir(dir)).toEqual([]);

    await mkdir(join(dir, "autostart"));
    const installed = entryText("/opt/perch-0.1.0.AppImage", true);
    await writeFile(entryPath, installed);
    await fromSource.save({ tray: false, login: false });
    await fromSource.repoint(false);

    expect(await written()).toBe(installed);
    expect(await fromSource.read()).toEqual({
      on: true,
      held: sourceRunHeld,
      path: entryPath,
      target: "/opt/perch-0.1.0.AppImage",
    });
  });

  it("replaces a symlinked entry rather than writing through it", async () => {
    const linked = join(dir, "resources", "perch-autostart.desktop");
    await mkdir(join(dir, "resources"));
    await mkdir(join(dir, "autostart"));
    await writeFile(linked, "[Desktop Entry]\nExec=perch --hidden\n");
    await symlink(linked, entryPath);

    await autostart(image).repoint(true);

    expect((await lstat(entryPath)).isSymbolicLink()).toBe(false);
    expect(await written()).toBe(entryText(image, true));
    expect(await readFile(linked, "utf8")).toBe(
      "[Desktop Entry]\nExec=perch --hidden\n",
    );
  });
});
