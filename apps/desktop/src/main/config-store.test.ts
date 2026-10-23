import { readFile } from "node:fs/promises";
import { join } from "node:path";
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

/** A config store over in-memory files, recording every path it reads. */
function storeOver(files: Map<string, string>) {
  const reads: string[] = [];
  const store = createConfigStore({
    home: "/home/owner",
    path: userPath,
    readText: async (path) => {
      reads.push(path);
      return files.get(path) ?? null;
    },
  });
  return { store, reads };
}

describe("the config store", () => {
  it("holds the no-config state when the owner has no config, and never reads the example", async () => {
    const { store, reads } = storeOver(new Map([[examplePath, example]]));

    const state = await store.reload();

    expect(state).toEqual({ loaded: null, error: null, missing: true });
    expect(reads).toEqual([userPath]);
  });

  it("reads the owner's config", async () => {
    const { store } = storeOver(new Map([[userPath, example]]));

    const state = await store.reload();

    expect(state.missing).toBe(false);
    expect(state.error).toBeNull();
    expect(state.loaded?.path).toBe(userPath);
  });

  it("leaves the no-config state once the file appears", async () => {
    const files = new Map<string, string>();
    const { store } = storeOver(files);
    await store.reload();
    files.set(userPath, example);

    const state = await store.reload();

    expect(state.missing).toBe(false);
    expect(state.loaded?.path).toBe(userPath);
  });

  it("keeps the config last read when an edit does not parse, and says why", async () => {
    const files = new Map([[userPath, example]]);
    const { store } = storeOver(files);
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
    expect(second.missing).toBe(false);
    expect(store.current()).toBe(second);
  });

  it("holds no config and the reason when nothing has ever parsed", async () => {
    const { store } = storeOver(new Map([[userPath, "wires = 3"]]));

    const state = await store.reload();

    expect(state.loaded).toBeNull();
    expect(state.error).toBe("config: wires must be a table");
    expect(state.missing).toBe(false);
  });

  it("clears the reason once the config parses again", async () => {
    const files = new Map([[userPath, "wires = 3"]]);
    const { store } = storeOver(files);
    await store.reload();
    files.set(userPath, example);

    const state = await store.reload();

    expect(state.error).toBeNull();
    expect(state.loaded?.path).toBe(userPath);
  });
});
