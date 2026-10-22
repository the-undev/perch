import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appPaths, examplePathFor } from "./app-paths.ts";

describe("the app's paths", () => {
  it("keep the scan's cache and first-seen record under ~/.local/share/perch", () => {
    expect(appPaths("/home/owner", "/repo/config.example.toml")).toEqual({
      userData: "/home/owner/.local/share/perch",
      rawDir: "/home/owner/.local/share/perch/scan/raw",
      snapshotPath: "/home/owner/.local/share/perch/scan/snapshot.json",
      userConfigPath: "/home/owner/.config/perch/config.toml",
      examplePath: "/repo/config.example.toml",
    });
  });

  it("find the repository's example config from the built main process", () => {
    const mainDir = join(import.meta.dirname, "..", "..", "out", "main");
    const examplePath = examplePathFor(false, "/opt/perch/resources", mainDir);

    expect(examplePath).toBe(
      join(import.meta.dirname, "..", "..", "..", "..", "config.example.toml"),
    );
    expect(existsSync(examplePath)).toBe(true);
  });

  it("find the example config among the resources when packaged", () => {
    expect(examplePathFor(true, "/opt/perch/resources", "/anywhere")).toBe(
      "/opt/perch/resources/config.example.toml",
    );
  });
});
