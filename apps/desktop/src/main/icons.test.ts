import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  appIconSizes,
  iconPaths,
  resourceDirFor,
  trayIconFiles,
} from "./icons.ts";

const resources = join(import.meta.dirname, "..", "..", "resources");

/** A PNG's width and height, read from its IHDR chunk. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("the icons", () => {
  it("are found in apps/desktop/resources from the built main process", () => {
    const mainDir = join(import.meta.dirname, "..", "..", "out", "main");
    const dir = resourceDirFor(false, "/opt/perch/resources", mainDir);

    expect(dir).toBe(resources);
    const paths = iconPaths(dir);
    expect(existsSync(paths.window)).toBe(true);
    expect(existsSync(paths.tray)).toBe(true);
  });

  it("are found among the resources when packaged", () => {
    expect(
      iconPaths(resourceDirFor(true, "/opt/perch/resources", "/anywhere")),
    ).toEqual({
      window: "/opt/perch/resources/icons/256x256.png",
      tray: "/opt/perch/resources/tray.png",
    });
  });

  it("are rendered at every size electron-builder and the tray read", () => {
    for (const size of appIconSizes) {
      expect(pngSize(join(resources, "icons", `${size}x${size}.png`))).toEqual({
        width: size,
        height: size,
      });
    }
    for (const { file, size } of trayIconFiles) {
      expect(pngSize(join(resources, file))).toEqual({
        width: size,
        height: size,
      });
    }
  });
});
