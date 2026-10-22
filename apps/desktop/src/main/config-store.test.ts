import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "@perch/core/config.ts";
import { describe, expect, it } from "vitest";
import { createConfigStore } from "./config-store.ts";

const examplePath = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "config.example.toml",
);
const userPath = "/home/owner/.config/perch/config.toml";
const example = await readFile(examplePath, "utf8");

/** A config store over in-memory files, loading exactly as the app does. */
function storeOver(files: Map<string, string>) {
  return createConfigStore(() =>
    loadConfig({
      home: "/home/owner",
      userPath,
      examplePath,
      readText: async (path) => files.get(path) ?? null,
    }),
  );
}

describe("the config store", () => {
  it("falls back to the example config when the owner has none", async () => {
    const store = storeOver(new Map([[examplePath, example]]));

    const state = await store.reload();

    expect(state.error).toBeNull();
    expect(state.loaded?.path).toBe(examplePath);
  });

  it("keeps the config last read when an edit does not parse, and says why", async () => {
    const files = new Map([
      [examplePath, example],
      [userPath, example],
    ]);
    const store = storeOver(files);
    const first = await store.reload();
    files.set(
      userPath,
      example.replace("interval_minutes = 15", "interval_minutes = 0"),
    );

    const second = await store.reload();

    expect(second.loaded).toBe(first.loaded);
    expect(second.error).toBe(
      "config: scan.interval_minutes must be a positive integer",
    );
    expect(store.current()).toBe(second);
  });

  it("holds no config and the reason when nothing has ever parsed", async () => {
    const store = storeOver(new Map([[userPath, "wires = 3"]]));

    const state = await store.reload();

    expect(state.loaded).toBeNull();
    expect(state.error).toBe("config: wires must be a table");
  });

  it("clears the reason once the config parses again", async () => {
    const files = new Map([[userPath, "wires = 3"]]);
    const store = storeOver(files);
    await store.reload();
    files.set(userPath, example);

    const state = await store.reload();

    expect(state.error).toBeNull();
    expect(state.loaded?.path).toBe(userPath);
  });
});
