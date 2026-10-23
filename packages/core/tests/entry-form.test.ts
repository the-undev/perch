import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.ts";
import {
  emptyEntryValues,
  entryFormFor,
  entryProblems,
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

const perch = mockItem("dev/perch");
const hello = mockItem("dev/odin/hello");

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
    const form = entryFormFor(mockConfig, perch);

    expect(form.key).toBe("dev/perch");
    expect(form.scannedName).toBe("perch");
    expect(form.values).toEqual({
      wire: null,
      name: "Perch",
      importance: null,
      expect: ["ci"],
      keyFiles: ["README.md", "docs/spec.md", "docs/roadmap.md"],
      roadmaps: null,
      thresholds: {},
    });
    expect(form.options).toEqual({
      wires: ["Machine & Home", "Projects"],
      defaultWire: "Projects",
      tiers: ["server", "machine", "projects"],
      defaultTier: "projects",
      expectations: ["ci", "tickets"],
      thresholds: {
        unsafe_amber_hours: 24,
        unsafe_red_hours: 72,
        stalled_amber_days: 7,
        stalled_red_days: 30,
        expectation_amber_days: 7,
        expectation_red_days: 30,
      },
    });
  });

  it("has no values for a bird on the fence", () => {
    const form = entryFormFor(mockConfig, hello);

    expect(form.key).toBeNull();
    expect(form.values).toBeNull();
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
      importance: null,
      thresholds: { unsafe: {}, stalled: {}, expectation: {} },
      expect: [],
      keyFiles: null,
      roadmaps: null,
      zellijSession: null,
    });
    expect(Object.keys(config.items)).toHaveLength(
      Object.keys(mockConfig.items).length + 1,
    );
  });

  it("edits a forge-keyed entry under that key, keeping its zellij session", () => {
    const config = withEntry(forgeKeyed(), perch, {
      ...emptyEntryValues(),
      name: "Perch app",
      thresholds: { stalled_amber_days: 3 },
    });

    expect(config.items["dev/perch"]).toBeUndefined();
    expect(config.items["github:finch/perch"]).toMatchObject({
      name: "Perch app",
      thresholds: { unsafe: {}, stalled: { amberDays: 3 }, expectation: {} },
      zellijSession: "dev",
    });
    expect(entryFormFor(config, perch).key).toBe("github:finch/perch");
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

    expect(entryFormFor(config, perch).values).toBeNull();
    expect(Object.keys(config.items)).toEqual(
      Object.keys(mockConfig.items).filter((key) => key !== "dev/perch"),
    );
  });

  it("says why thresholds cannot be saved: not whole, or amber not before red", () => {
    const { options } = entryFormFor(mockConfig, perch);
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
    expect(entryProblems(values({ expectation_red_days: 0 }), options)).toEqual(
      ["Unmet expectation: thresholds must be whole days above zero"],
    );
  });
});
