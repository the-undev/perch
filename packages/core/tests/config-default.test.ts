import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.ts";
import { defaultConfig } from "../src/config-default.ts";
import { writeConfig } from "../src/config-write.ts";
import { settingsFormFor, settingsProblems } from "../src/settings-form.ts";

const home = "/home/test";

describe("the default config", () => {
  it("reads back from its own written form to an equal config", () => {
    const text = writeConfig(defaultConfig(), home);

    expect(parseConfig(text, home)).toEqual(defaultConfig());
  });

  it("declares no sources, holds no entries, and writes no sources table", () => {
    const config = defaultConfig();

    expect(config.sources).toEqual({
      local: [],
      github: [],
      forgejo: [],
      kuma: [],
    });
    expect(config.items).toEqual({});
    expect(config.wires).toEqual({ names: ["projects"], default: "projects" });
    expect(writeConfig(config, home)).not.toContain("sources");
  });

  it("holds settings the settings page can save as they are", () => {
    expect(
      settingsProblems(settingsFormFor(defaultConfig(), home).values),
    ).toEqual([]);
  });

  it("is a fresh object each time", () => {
    const first = defaultConfig();
    first.wires.names.push("changed");

    expect(defaultConfig().wires.names).toEqual(["projects"]);
  });
});
