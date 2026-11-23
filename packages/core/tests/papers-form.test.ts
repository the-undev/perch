import { describe, expect, it } from "vitest";
import type { Config } from "../src/config.ts";
import { mockConfig, mockSnapshot } from "../src/mock.ts";
import {
  emptyPapersValues,
  papersFormFor,
  papersProblems,
  samePapersValues,
  withoutPapers,
  withPapers,
} from "../src/papers-form.ts";
import type { Entity } from "../src/snapshot.ts";

function mockEntity(id: string): Entity {
  const entity = mockSnapshot.entities.find((candidate) => candidate.id === id);
  if (entity === undefined) throw new Error(`the mock snapshot has no ${id}`);
  return entity;
}

const home = "/home/owner";
const perch = mockEntity("dev/perch");
const hello = mockEntity("dev/odin/hello");
const obsidianTidy = mockEntity("github:finch/obsidian-tidy");

/** The mock config with Perch's papers keyed by its GitHub reference instead of its id. */
function forgeKeyed(): Config {
  const { "dev/perch": papers, ...rest } = mockConfig.entities;
  if (papers === undefined) throw new Error("the mock config has no Perch");
  return {
    ...mockConfig,
    entities: {
      ...rest,
      "github:finch/perch": { ...papers, zellijSession: "dev" },
    },
  };
}

describe("the papers form", () => {
  it("reads an adopted bird's papers with the choices config offers", () => {
    const form = papersFormFor(mockConfig, perch, home);

    expect(form.key).toBe("dev/perch");
    expect(form.scannedName).toBe("perch");
    expect(form.values).toEqual({
      wire: null,
      name: "Perch",
      keyFiles: ["README.md", "docs/forge-access.md", "docs/roadmap.md"],
      roadmaps: ["docs/roadmap.md"],
      thresholds: {},
      zellijSession: null,
      bugWords: null,
      criticalBugWords: null,
    });
    expect(form.options).toEqual({
      wires: ["Machine & Home", "Projects"],
      defaultWire: "Projects",
      thresholds: {
        unsafe_amber_hours: 24,
        unsafe_red_hours: 72,
        stalled_amber_days: 7,
        stalled_red_days: 30,
        bugs_amber_count: 5,
        bugs_red_count: 20,
        critical_bugs_amber_count: 1,
        critical_bugs_red_count: 3,
      },
    });
  });

  it("has no values for a bird on the fence", () => {
    const form = papersFormFor(mockConfig, hello, home);

    expect(form.key).toBeNull();
    expect(form.values).toBeNull();
  });

  it("says what the scan found: the clone with home as ~, the forges, and the checked-out commit", () => {
    expect(papersFormFor(mockConfig, perch, home).seen).toEqual({
      foundAt: "~/dev/perch",
      forges: ["github.com/finch/perch", "forge.example.lan:3000/finch/perch"],
      lastCommit: {
        at: "2026-10-22T06:30:00.000Z",
        subject: "Derive the view model: aviary, birds, bubbles and detail",
      },
    });
    expect(papersFormFor(mockConfig, hello, home).seen).toEqual({
      foundAt: "~/dev/odin/hello",
      forges: [],
      lastCommit: { at: "2025-10-14T15:45:44.000Z", subject: "mli for shape" },
    });
  });

  it("takes a forge-only bird's last commit from its forge, with nothing found on disk", () => {
    expect(papersFormFor(mockConfig, obsidianTidy, home).seen).toEqual({
      foundAt: null,
      forges: ["github.com/finch/obsidian-tidy"],
      lastCommit: {
        at: "2026-03-02T11:02:48Z",
        subject: "vault backup: 2026-03-02 11:02:48",
      },
    });
  });

  it("names the session the zellij action gives a clone, and none without a clone or the action", () => {
    const noZellij: Config = {
      ...mockConfig,
      launch: {
        actions: mockConfig.launch.actions.filter(
          (action) => action.kind !== "zellij",
        ),
      },
    };

    expect(papersFormFor(mockConfig, perch, home).defaultSession).toBe("home");
    expect(
      papersFormFor(mockConfig, mockEntity("undev/spool"), home).defaultSession,
    ).toBe("undev");
    expect(
      papersFormFor(mockConfig, obsidianTidy, home).defaultSession,
    ).toBeNull();
    expect(papersFormFor(noZellij, perch, home).defaultSession).toBeNull();
  });

  it("adopts a fence bird under its entity id", () => {
    const config = withPapers(mockConfig, hello, {
      ...emptyPapersValues(),
      wire: "Machine & Home",
      name: "Hello",
    });

    expect(config.entities["dev/odin/hello"]).toEqual({
      wire: "Machine & Home",
      name: "Hello",
      thresholds: { unsafe: {}, stalled: {}, bugs: {}, criticalBugs: {} },
      keyFiles: null,
      roadmaps: null,
      zellijSession: null,
      bugWords: null,
      criticalBugWords: null,
    });
    expect(Object.keys(config.entities)).toHaveLength(
      Object.keys(mockConfig.entities).length + 1,
    );
  });

  it("edits forge-keyed papers under that key", () => {
    const config = withPapers(forgeKeyed(), perch, {
      ...emptyPapersValues(),
      name: "Perch app",
      thresholds: { stalled_amber_days: 3 },
    });

    expect(config.entities["dev/perch"]).toBeUndefined();
    expect(config.entities["github:finch/perch"]).toMatchObject({
      name: "Perch app",
      thresholds: { unsafe: {}, stalled: { amberDays: 3 } },
    });
    expect(papersFormFor(config, perch, home).key).toBe("github:finch/perch");
  });

  it("reads the zellij session into the values and writes the one given, null for none", () => {
    const form = papersFormFor(forgeKeyed(), perch, home);
    if (form.values === null) throw new Error("Perch has no papers");
    expect(form.values.zellijSession).toBe("dev");

    const moved = withPapers(forgeKeyed(), perch, {
      ...form.values,
      zellijSession: "work",
    });
    const cleared = withPapers(forgeKeyed(), perch, {
      ...form.values,
      zellijSession: null,
    });

    expect(moved.entities["github:finch/perch"]?.zellijSession).toBe("work");
    expect(cleared.entities["github:finch/perch"]?.zellijSession).toBeNull();
  });

  it("unadopts by removing every key naming the bird", () => {
    const both: Config = {
      ...forgeKeyed(),
      entities: {
        ...forgeKeyed().entities,
        "dev/perch": mockConfig.entities[
          "dev/perch"
        ] as Config["entities"][string],
      },
    };

    const config = withoutPapers(both, perch);

    expect(papersFormFor(config, perch, home).values).toBeNull();
    expect(Object.keys(config.entities)).toEqual(
      Object.keys(mockConfig.entities).filter((key) => key !== "dev/perch"),
    );
  });

  it("keeps the papers' word lists and bug thresholds, which the form does not edit", () => {
    const papers = {
      ...(mockConfig.entities["dev/perch"] as Config["entities"][string]),
      bugWords: ["wart"],
      criticalBugWords: [],
      thresholds: {
        unsafe: {},
        stalled: {},
        bugs: { redCount: 40 },
        criticalBugs: { amberCount: 2 },
      },
    };
    const config: Config = {
      ...mockConfig,
      entities: { ...mockConfig.entities, "dev/perch": papers },
    };
    const values = papersFormFor(config, perch, home).values;
    if (values === null) throw new Error("perch has papers");

    expect(withPapers(config, perch, values).entities["dev/perch"]).toEqual(
      papers,
    );
    expect(
      samePapersValues(values, { ...values, criticalBugWords: ["fire"] }),
    ).toBe(false);
  });

  it("knows values that write the same papers, whatever order the thresholds were set in", () => {
    const values = {
      ...emptyPapersValues(),
      thresholds: { stalled_red_days: 40, unsafe_amber_hours: 12 },
    };

    expect(
      samePapersValues(values, {
        ...values,
        thresholds: { unsafe_amber_hours: 12, stalled_red_days: 40 },
      }),
    ).toBe(true);
    expect(samePapersValues(values, { ...values, zellijSession: "work" })).toBe(
      false,
    );
  });

  it("says why thresholds cannot be saved: not whole, or amber not before red", () => {
    const { options } = papersFormFor(mockConfig, perch, home);
    const values = (thresholds: Record<string, number>) => ({
      ...emptyPapersValues(),
      thresholds,
    });

    expect(papersProblems(values({ stalled_amber_days: 3 }), options)).toEqual(
      [],
    );
    expect(
      papersProblems(values({ unsafe_amber_hours: 1.5 }), options),
    ).toEqual(["Unsafe work: thresholds must be whole hours above zero"]);
    expect(papersProblems(values({ stalled_amber_days: 30 }), options)).toEqual(
      ["Stalled flight: amber must come before red"],
    );
    expect(papersProblems(values({ stalled_red_days: 0 }), options)).toEqual([
      "Stalled flight: thresholds must be whole days above zero",
    ]);
  });
});
