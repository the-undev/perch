import { describe, expect, it } from "vitest";
import { appPaths } from "./app-paths.ts";

describe("the app's paths", () => {
  it("keep the scan's cache and first-seen record under ~/.local/share/perch", () => {
    expect(appPaths("/home/owner")).toEqual({
      userData: "/home/owner/.local/share/perch",
      rawDir: "/home/owner/.local/share/perch/scan/raw",
      snapshotPath: "/home/owner/.local/share/perch/scan/snapshot.json",
      userConfigPath: "/home/owner/.config/perch/config.toml",
    });
  });
});
