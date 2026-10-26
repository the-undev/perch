import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.ts";
import {
  emptyEntryValues,
  entryFormFor,
  entryProblems,
  sameEntryValues,
  withEntry,
  withoutEntry,
} from "../src/entry-form.ts";
import { mockConfig, mockSnapshot } from "../src/mock.ts";
import type { Item } from "../src/snapshot.ts";

function mockItem(id: string): Item {
  const item = mockSnapshot.items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`the mock snapshot has no ${id}`);
  return item;
}

const home = "/home/owner";
const perch = mockItem("dev/perch");
const hello = mockItem("dev/odin/hello");
const obsidianTidy = mockItem("github:finch/obsidian-tidy");

/** The mock config with Perch's entry keyed by its GitHub reference instead of its id. */
function forgeKeyed(): Config {
  const { "dev/perch": entry, ...rest } = mockConfig.items;
  if (entry === undefined) throw new Error("the mock config has no Perch");
  return {
    ...mockConfig,
    items: {
      ...rest,
      "github:finch/perch": { ...entry, zellijSession: "dev" },
    },
  };
}

describe("the entry form", () => {
  it("reads an adopted bird's entry with the choices config offers", () => {
    const form = entryFormFor(mockConfig, perch, home);

    expect(form.key).toBe("dev/perch");
    expect(form.scannedName).toBe("perch");
    expect(form.values).toEqual({
      wire: null,
      name: "Perch",
      keyFiles: ["README.md", "docs/spec.md", "docs/roadmap.md"],
      roadmaps: null,
      thresholds: {},
      zellijSession: null,
    });
    expect(form.options).toEqual({
      wires: ["Machine & Home", "Projects"],
      defaultWire: "Projects",
      thresholds: {
        unsafe_amber_hours: 24,
        unsafe_red_hours: 72,
        stalled_amber_days: 7,
        stalled_red_days: 30,
      },
    });
  });

  it("has no values for a bird on the fence", () => {
    const form = entryFormFor(mockConfig, hello, home);

    expect(form.key).toBeNull();
    expect(form.values).toBeNull();
  });

  it("says what the scan found: the clone with home as ~, the forges, and the checked-out commit", () => {
    expect(entryFormFor(mockConfig, perch, home).seen).toEqual({
      foundAt: "~/dev/perch",
      forges: ["github.com/finch/perch", "forge.example.lan:3000/finch/perch"],
      lastCommit: {
        at: "2026-10-22T06:30:00.000Z",
        subject: "Derive the view model: aviary, birds, bubbles and detail",
      },
    });
    expect(entryFormFor(mockConfig, hello, home).seen).toEqual({
      foundAt: "~/dev/odin/hello",
      forges: [],
      lastCommit: { at: "2025-10-14T15:45:44.000Z", subject: "mli for shape" },
    });
  });

  it("takes a forge-only bird's last commit from its forge, with nothing found on disk", () => {
    expect(entryFormFor(mockConfig, obsidianTidy, home).seen).toEqual({
      foundAt: null,
      forges: ["github.com/finch/obsidian-tidy"],
      lastCommit: {
        at: "2026-03-02T11:02:48Z",
        subject: "vault backup: 2026-03-02 11:02:48",
      },
    });
  });

  it("names the session the launch rules give a clone, and none without one", () => {
    expect(entryFormFor(mockConfig, perch, home).defaultSession).toBe("home");
    expect(
      entryFormFor(mockConfig, mockItem("undev/spool"), home).defaultSession,
    ).toBe("undev");
    expect(
      entryFormFor(mockConfig, obsidianTidy, home).defaultSession,
    ).toBeNull();
  });

  it("adopts a fence bird under its item id", () => {
    const config = withEntry(mockConfig, hello, {
      ...emptyEntryValues(),
      wire: "Machine & Home",
      name: "Hello",
    });

    expect(config.items["dev/odin/hello"]).toEqual({
      wire: "Machine & Home",
      name: "Hello",
      thresholds: { unsafe: {}, stalled: {} },
      keyFiles: null,
      roadmaps: null,
      zellijSession: null,
    });
    expect(Object.keys(config.items)).toHaveLength(
      Object.keys(mockConfig.items).length + 1,
    );
  });

  it("edits a forge-keyed entry under that key", () => {
    const config = withEntry(forgeKeyed(), perch, {
      ...emptyEntryValues(),
      name: "Perch app",
      thresholds: { stalled_amber_days: 3 },
    });

    expect(config.items["dev/perch"]).toBeUndefined();
    expect(config.items["github:finch/perch"]).toMatchObject({
      name: "Perch app",
      thresholds: { unsafe: {}, stalled: { amberDays: 3 } },
    });
    expect(entryFormFor(config, perch, home).key).toBe("github:finch/perch");
  });

  it("reads the zellij session into the values and writes the one given, null for none", () => {
    const form = entryFormFor(forgeKeyed(), perch, home);
    if (form.values === null) throw new Error("Perch has no entry");
    expect(form.values.zellijSession).toBe("dev");

    const moved = withEntry(forgeKeyed(), perch, {
      ...form.values,
      zellijSession: "work",
    });
    const cleared = withEntry(forgeKeyed(), perch, {
      ...form.values,
      zellijSession: null,
    });

    expect(moved.items["github:finch/perch"]?.zellijSession).toBe("work");
    expect(cleared.items["github:finch/perch"]?.zellijSession).toBeNull();
  });

  it("unadopts by removing every key naming the bird", () => {
    const both: Config = {
      ...forgeKeyed(),
      items: {
        ...forgeKeyed().items,
        "dev/perch": mockConfig.items["dev/perch"] as Config["items"][string],
      },
    };

    const config = withoutEntry(both, perch);

    expect(entryFormFor(config, perch, home).values).toBeNull();
    expect(Object.keys(config.items)).toEqual(
      Object.keys(mockConfig.items).filter((key) => key !== "dev/perch"),
    );
  });

  it("knows values that write the same entry, whatever order the thresholds were set in", () => {
    const values = {
      ...emptyEntryValues(),
      thresholds: { stalled_red_days: 40, unsafe_amber_hours: 12 },
    };

    expect(
      sameEntryValues(values, {
        ...values,
        thresholds: { unsafe_amber_hours: 12, stalled_red_days: 40 },
      }),
    ).toBe(true);
    expect(sameEntryValues(values, { ...values, zellijSession: "work" })).toBe(
      false,
    );
  });

  it("says why thresholds cannot be saved: not whole, or amber not before red", () => {
    const { options } = entryFormFor(mockConfig, perch, home);
    const values = (thresholds: Record<string, number>) => ({
      ...emptyEntryValues(),
      thresholds,
    });

    expect(entryProblems(values({ stalled_amber_days: 3 }), options)).toEqual(
      [],
    );
    expect(entryProblems(values({ unsafe_amber_hours: 1.5 }), options)).toEqual(
      ["Unsafe work: thresholds must be whole hours above zero"],
    );
    expect(entryProblems(values({ stalled_amber_days: 30 }), options)).toEqual([
      "Stalled flight: amber must come before red",
    ]);
    expect(entryProblems(values({ stalled_red_days: 0 }), options)).toEqual([
      "Stalled flight: thresholds must be whole days above zero",
    ]);
  });
});
