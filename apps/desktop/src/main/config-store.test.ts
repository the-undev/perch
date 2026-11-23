import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTextIfExists } from "@perch/core/fs.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyToNewFile, writeTextAtomic } from "./config-edit.ts";
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
    writeText: async (path, text) => {
      files.set(path, text);
    },
    copyToNewFile: async (from, to) => {
      if (files.has(to)) {
        throw Object.assign(new Error(`${to} exists`), { code: "EEXIST" });
      }
      files.set(to, files.get(from) ?? "");
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

/** A config written before config carried a version: [items] and joins. */
const version1Text = await readFile(
  join(
    import.meta.dirname,
    "../../../../packages/core/tests/fixtures/config-version1.toml",
  ),
  "utf8",
);

describe("migrating the config", () => {
  let dir: string;
  let configPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "perch-migrate-"));
    configPath = join(dir, "config.toml");
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const storeOnDisk = () =>
    createConfigStore({
      home: "/home/owner",
      path: configPath,
      readText: readTextIfExists,
      writeText: writeTextAtomic,
      copyToNewFile,
    });

  it("reads a version 1 file as version 2, writes it back, and keeps the old file as config.toml.v1", async () => {
    await writeFile(configPath, version1Text);

    const state = await storeOnDisk().reload();

    expect(state.error).toBeNull();
    expect(state.loaded?.config.entities["dev/perch"]?.name).toBe("Perch");
    const written = await readFile(configPath, "utf8");
    expect(written).toMatch(/^version = 2$/m);
    expect(written).toContain('[papers."dev/perch"]');
    expect(written).toContain(
      'links = [ [ "github:finch/notes", "forgejo:finch/notes" ] ]',
    );
    expect(written).not.toMatch(/items|joins/);
    expect(await readFile(join(dir, "config.toml.v1"), "utf8")).toBe(
      version1Text,
    );
  });

  it("keeps an earlier config.toml.v1 and copies the old file to config.toml.v1.1", async () => {
    await writeFile(configPath, version1Text);
    await writeFile(join(dir, "config.toml.v1"), "# an earlier copy\n");

    const state = await storeOnDisk().reload();

    expect(state.error).toBeNull();
    expect(await readFile(join(dir, "config.toml.v1"), "utf8")).toBe(
      "# an earlier copy\n",
    );
    expect(await readFile(join(dir, "config.toml.v1.1"), "utf8")).toBe(
      version1Text,
    );
  });

  it("drops [[sources.kuma]] tables from a version 1 file", async () => {
    await writeFile(
      configPath,
      `${version1Text}\n[[sources.kuma]]\nname = "Box"\nbase_url = "http://kuma.invalid"\nstatus_page = "p"\n`,
    );

    const state = await storeOnDisk().reload();

    expect(state.error).toBeNull();
    expect(state.loaded?.config.sources).toEqual({
      local: [],
      github: [],
      forgejo: [],
    });
    expect(await readFile(configPath, "utf8")).not.toContain("kuma");
  });

  it("refuses a file of a newer version, naming both, and writes nothing", async () => {
    const newer = `version = 3\n${version1Text}`;
    await writeFile(configPath, newer);

    const state = await storeOnDisk().reload();

    expect(state.loaded).toBeNull();
    expect(state.error).toBe(
      "config: version 3 is newer than this perch reads, version 2",
    );
    expect(await readFile(configPath, "utf8")).toBe(newer);
    expect(await readdir(dir)).toEqual(["config.toml"]);
  });

  it("reads a version 2 file without writing it or copying it", async () => {
    const version2 = `version = 2\n${version1Text.replace("joins", "links").replace("[items.", "[papers.")}`;
    await writeFile(configPath, version2);

    const state = await storeOnDisk().reload();

    expect(state.error).toBeNull();
    expect(state.loaded?.config.entities["dev/perch"]?.name).toBe("Perch");
    expect(await readFile(configPath, "utf8")).toBe(version2);
    expect(await readdir(dir)).toEqual(["config.toml"]);
  });
});
