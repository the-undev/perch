import { describe, expect, it } from "vitest";
import { appPaths } from "./app-paths.ts";

describe("the app's paths", () => {
  it("keep the scan's cache, its first-seen record and the snoozes under ~/.local/share/perch", () => {
    expect(appPaths("/home/owner", {})).toEqual({
      userData: "/home/owner/.local/share/perch",
      rawDir: "/home/owner/.local/share/perch/scan/raw",
      snapshotPath: "/home/owner/.local/share/perch/scan/snapshot.json",
      snoozesPath: "/home/owner/.local/share/perch/snoozes.json",
      userConfigPath: "/home/owner/.config/perch/config.toml",
    });
  });

  it("put the data directory and the config where PERCH_DATA_DIR and PERCH_CONFIG point", () => {
    expect(
      appPaths("/home/owner", {
        PERCH_DATA_DIR: "/tmp/run/data",
        PERCH_CONFIG: "/tmp/run/config.toml",
      }),
    ).toEqual({
      userData: "/tmp/run/data",
      rawDir: "/tmp/run/data/scan/raw",
      snapshotPath: "/tmp/run/data/scan/snapshot.json",
      snoozesPath: "/tmp/run/data/snoozes.json",
      userConfigPath: "/tmp/run/config.toml",
    });
  });
});
