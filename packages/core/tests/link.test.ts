import { describe, expect, it } from "vitest";
import { aggregate, localPapers } from "../src/aggregate.ts";
import type { Config } from "../src/config.ts";
import {
  type ForgeInput,
  type LocalInput,
  linkRepositories,
} from "../src/link.ts";
import type { ForgeName, RawFiles, RawForgeRepo } from "../src/raw.ts";
import type { Snapshot } from "../src/snapshot.ts";
import { deriveAviary } from "../src/viewmodel.ts";
import { testConfig } from "./helpers/config.ts";
import {
  forgeRepo,
  gatheredAt,
  localRepository,
  okStatus,
  rawFiles,
  withRemotes,
} from "./helpers/raw.ts";

const hosts: Record<string, ForgeName> = {
  "github.com": "github",
  "github-work": "github",
  forgejo: "forgejo",
};
const forgeForHost = (host: string) => hosts[host] ?? null;

function local(id: string, remotes: string[]): LocalInput {
  return {
    id,
    repository: localRepository(`/home/test/${id}`, {
      include: "/home/test/dev",
      git: withRemotes(
        remotes.map((url, index) => ({
          name: index === 0 ? "origin" : `r${index}`,
          url,
        })),
      ),
    }),
  };
}

function forge(name: ForgeName, repo: RawForgeRepo): ForgeInput {
  return {
    forge: name,
    key: repo.info.fullName.toLowerCase(),
    repo: { state: "observed", value: repo },
  };
}

function linked(input: {
  locals?: LocalInput[];
  forges?: ForgeInput[];
  links?: string[][];
  ignore?: string[];
}) {
  return linkRepositories({
    locals: input.locals ?? [],
    forges: input.forges ?? [],
    forgeForHost,
    links: input.links ?? [],
    ignore: input.ignore ?? [],
  });
}

const refsOf = (result: ReturnType<typeof linked>) =>
  result.projects.map((project) => project.refs);

describe("linking by remote URL", () => {
  it("links a local repository to every forge repository its remotes name, without case and through SSH aliases", () => {
    const result = linked({
      locals: [
        local("dev/dotfiles", [
          "git@github.com:finch/dotfiles.git",
          "ssh://git@forgejo:2222/finch/dotfiles.git",
        ]),
        local("undev/Hollow-legacy", ["git@github-work:the-undev/Hollow.git"]),
      ],
      forges: [
        forge("github", forgeRepo("finch/dotfiles", {})),
        forge("forgejo", forgeRepo("finch/dotfiles", {})),
        forge("github", forgeRepo("the-undev/hollow", {})),
      ],
    });

    expect(refsOf(result)).toEqual([
      ["local:dev/dotfiles", "github:finch/dotfiles", "forgejo:finch/dotfiles"],
      ["local:undev/Hollow-legacy", "github:the-undev/hollow"],
    ]);
  });

  it("links a dual-push remote to the forge named only by its second push URL", () => {
    const github = "git@github.com:finch/perch.git";
    const result = linked({
      locals: [
        {
          id: "dev/perch",
          repository: localRepository("/home/test/dev/perch", {
            include: "/home/test/dev",
            git: withRemotes([
              {
                name: "origin",
                url: github,
                pushUrls: [github, "ssh://git@forgejo:2222/finch/perch.git"],
              },
            ]),
          }),
        },
      ],
      forges: [
        forge("github", forgeRepo("finch/perch", {})),
        forge("forgejo", forgeRepo("finch/perch", {})),
      ],
    });

    expect(refsOf(result)).toEqual([
      ["local:dev/perch", "github:finch/perch", "forgejo:finch/perch"],
    ]);
  });

  it("follows a rename through the forge's alias for the old name", () => {
    const result = linked({
      locals: [
        local("dev/photo-shuttle", [
          "https://github.com/finch/camera-mover.git",
        ]),
      ],
      forges: [
        forge(
          "github",
          forgeRepo("finch/PhotoMover", {
            aliases: ["finch/camera-mover"],
          }),
        ),
      ],
    });

    expect(refsOf(result)).toEqual([
      ["local:dev/photo-shuttle", "github:finch/photomover"],
    ]);
  });

  it("keeps unlinked repositories as their own projects and never links two forge repositories", () => {
    const result = linked({
      locals: [local("dev/toy", [])],
      forges: [
        forge("github", forgeRepo("finch/notes", {})),
        forge("forgejo", forgeRepo("finch/notes", {})),
      ],
    });

    expect(refsOf(result)).toEqual([
      ["local:dev/toy"],
      ["github:finch/notes"],
      ["forgejo:finch/notes"],
    ]);
  });

  it("flags a local repository whose remote names an archived repository, which links nothing", () => {
    const result = linked({
      locals: [
        local("dev/mixed-bag", ["https://github.com/finch/mixed-bag.git"]),
      ],
      forges: [
        forge("github", forgeRepo("finch/mixed-bag", { archived: true })),
      ],
    });

    expect(refsOf(result)).toEqual([["local:dev/mixed-bag"]]);
    expect(result.projects[0]?.flags.map((flag) => flag.flag)).toEqual([
      "remote-archived",
    ]);
    expect(result.unlisted.map((repository) => repository.key)).toEqual([
      "finch/mixed-bag",
    ]);
  });

  it("leaves a repository with the first local repository and flags a second local repository of it", () => {
    const url = "git@github.com:finch/perch.git";
    const result = linked({
      locals: [local("dev/perch", [url]), local("dev/perch-copy", [url])],
      forges: [forge("github", forgeRepo("finch/perch", {}))],
    });

    expect(refsOf(result)).toEqual([
      ["local:dev/perch", "github:finch/perch"],
      ["local:dev/perch-copy"],
    ]);
    expect(result.projects[1]?.flags).toEqual([
      {
        flag: "remote-linked-elsewhere",
        level: null,
        detail: "origin is finch/perch, already linked to local:dev/perch",
      },
    ]);
  });
});

describe("asserted links", () => {
  it("merge forge repositories that no URL proves, matching references without case", () => {
    const result = linked({
      forges: [
        forge("github", forgeRepo("finch/notes", {})),
        forge("forgejo", forgeRepo("finch/notes", {})),
      ],
      links: [["github:Finch/Notes", "forgejo:finch/notes"]],
    });

    expect(refsOf(result)).toEqual([
      ["github:finch/notes", "forgejo:finch/notes"],
    ]);
    expect(result.conflicts).toEqual([]);
  });

  it("merge into the project with the local repository", () => {
    const result = linked({
      locals: [local("dev/notes", ["git@github.com:finch/notes.git"])],
      forges: [
        forge("github", forgeRepo("finch/notes", {})),
        forge("forgejo", forgeRepo("finch/notes", {})),
      ],
      links: [["forgejo:finch/notes", "github:finch/notes"]],
    });

    expect(refsOf(result)).toEqual([
      ["local:dev/notes", "github:finch/notes", "forgejo:finch/notes"],
    ]);
  });

  it("name a local repository by its bare id as well as by local:<id>", () => {
    const result = linked({
      locals: [local("dev/notes", [])],
      forges: [forge("forgejo", forgeRepo("finch/notes", {}))],
      links: [["dev/notes", "forgejo:finch/notes"]],
    });

    expect(refsOf(result)).toEqual([
      ["local:dev/notes", "forgejo:finch/notes"],
    ]);
    expect(result.conflicts).toEqual([]);
  });

  it("lose to the observation when they would link two local repositories, flagging both", () => {
    const result = linked({
      locals: [local("dev/a", []), local("dev/b", [])],
      links: [["local:dev/a", "local:dev/b"]],
    });

    expect(refsOf(result)).toEqual([["local:dev/a"], ["local:dev/b"]]);
    expect(result.conflicts).toEqual([
      {
        assertion: 'links ["local:dev/a","local:dev/b"]',
        detail: "it would link two local repositories into one project",
      },
    ]);
    expect(
      result.projects.map((project) => project.flags.map((flag) => flag.flag)),
    ).toEqual([["config-conflict"], ["config-conflict"]]);
  });

  it("are recorded as conflicts when a repository is missing or archived", () => {
    const result = linked({
      forges: [
        forge("github", forgeRepo("finch/notes", {})),
        forge("github", forgeRepo("finch/old", { archived: true })),
      ],
      links: [
        ["github:finch/notes", "forgejo:finch/notes", "github:finch/old"],
      ],
    });

    expect(refsOf(result)).toEqual([["github:finch/notes"]]);
    expect(result.conflicts[0]?.detail).toBe(
      "forgejo:finch/notes was not observed; github:finch/old is archived",
    );
  });
});

describe("ignores", () => {
  it("drop a forge-only repository but not one a local repository uses", () => {
    const result = linked({
      locals: [local("dev/perch", ["git@github.com:finch/perch.git"])],
      forges: [
        forge("github", forgeRepo("finch/perch", {})),
        forge("github", forgeRepo("finch/scratch", {})),
      ],
      ignore: [
        "github:finch/scratch",
        "github:finch/perch",
        "github:finch/gone",
      ],
    });

    expect(refsOf(result)).toEqual([["local:dev/perch", "github:finch/perch"]]);
    expect([...result.ignored]).toEqual(["github:finch/scratch"]);
    expect(result.conflicts.map((entry) => entry.detail)).toEqual([
      "local:dev/perch uses it, so it stays",
      "github:finch/gone was not observed",
    ]);
  });
  it("drop a project named by any of its references, not only its id", () => {
    const result = linked({
      forges: [
        forge("github", forgeRepo("finch/notes", {})),
        forge("forgejo", forgeRepo("finch/notes", {})),
      ],
      links: [["github:finch/notes", "forgejo:finch/notes"]],
      ignore: ["forgejo:Finch/Notes"],
    });

    expect(refsOf(result)).toEqual([]);
    expect([...result.ignored]).toEqual([
      "github:finch/notes",
      "forgejo:finch/notes",
    ]);
    expect(result.conflicts).toEqual([]);
  });
});

describe("aggregating linked projects", () => {
  const config = testConfig;

  const files = rawFiles({
    includes: { "/home/test/dev": "directory" },
    locals: {
      "dev/perch": localRepository("/home/test/dev/perch", {
        include: "/home/test/dev",
        git: {
          ...withRemotes([
            { name: "origin", url: "git@github.com:finch/perch.git" },
          ]),
          unpushedCommits: [
            {
              sha: "b",
              committedAt: "2026-10-11T09:00:00.000Z",
              subject: "Local",
            },
          ],
        },
      }),
      "dev/toy": localRepository("/home/test/dev/toy", {
        include: "/home/test/dev",
      }),
      "dev/gone": localRepository("/home/test/dev/gone", {
        include: "/home/test/dev",
        git: withRemotes([
          { name: "origin", url: "git@gitlab.com:someone/gone.git" },
        ]),
      }),
    },
    forges: {
      github: [
        forgeRepo("finch/perch", {}),
        forgeRepo("finch/notes", {}),
        forgeRepo("finch/old", { archived: true }),
      ],
    },
  });

  it("merges local and forge data into one entity and sets each local repository's backup state", async () => {
    const snapshot = aggregate(
      { status: okStatus({}), files },
      {
        config: await config(
          '[papers."dev/perch"]\n[papers."dev/toy"]\n[papers."dev/gone"]\n',
        ),
        configPath: "c",
        home: "/home/test",
        previous: null,
      },
      new Date(gatheredAt),
    );

    expect(snapshot.entities.map((entity) => entity.id)).toEqual([
      "dev/perch",
      "dev/toy",
      "dev/gone",
      "github:finch/notes",
    ]);
    const byId = Object.fromEntries(
      snapshot.entities.map((entity) => [entity.id, entity]),
    );
    expect(
      byId["dev/perch"]?.repositories.forges.map(
        (repository) => repository.ref,
      ),
    ).toEqual(["github:finch/perch"]);
    expect(byId["dev/perch"]?.sources.github).toMatchObject({
      fullName: "finch/perch",
    });
    expect(byId["dev/perch"]?.sources.git).toMatchObject({
      backup: "linked",
      drift: { unpushed: { hours: 240 } },
    });
    expect(byId["dev/toy"]?.sources.git).toMatchObject({
      backup: "local-only",
    });
    expect(byId["dev/gone"]?.sources.git).toMatchObject({
      backup: "unlinked-remote",
    });
    expect(byId["github:finch/notes"]).toMatchObject({
      kind: "git",
      path: null,
      name: "notes",
    });
  });

  it("lists every forge repository grouped active and archived, and keeps archived ones off the entities", async () => {
    const snapshot = aggregate(
      { status: okStatus({}), files },
      {
        config: await config(""),
        configPath: "c",
        home: "/home/test",
        previous: null,
      },
      new Date(gatheredAt),
    );

    expect(snapshot.forges.github).toEqual({
      active: [
        {
          ref: "github:finch/notes",
          fullName: "finch/notes",
          url: "https://example.invalid/finch/notes",
          entityId: "github:finch/notes",
          ignored: false,
        },
        {
          ref: "github:finch/perch",
          fullName: "finch/perch",
          url: "https://example.invalid/finch/perch",
          entityId: "dev/perch",
          ignored: false,
        },
      ],
      archived: [
        {
          ref: "github:finch/old",
          fullName: "finch/old",
          url: "https://example.invalid/finch/old",
          entityId: null,
          ignored: false,
        },
      ],
    });
    expect(
      snapshot.entities.some((entity) => entity.id === "github:finch/old"),
    ).toBe(false);
  });

  function aggregated(snapshotFiles: Partial<RawFiles>, configured: Config) {
    return aggregate(
      { status: okStatus({}), files: snapshotFiles },
      {
        config: configured,
        configPath: "c",
        home: "/home/test",
        previous: null,
      },
      new Date(gatheredAt),
    );
  }

  const entityConflicts = (snapshot: Snapshot) =>
    snapshot.conflicts.filter((entry) => !entry.assertion.includes("obsidian"));

  it("records papers that name nothing observed", async () => {
    const snapshot = aggregated(
      files,
      await config('[papers."dev/vanished"]\n'),
    );

    expect(entityConflicts(snapshot)).toEqual([
      {
        assertion: 'papers."dev/vanished"',
        detail: "dev/vanished was not observed",
      },
    ]);
  });

  it("keeps forge-keyed papers' adoption, name, wire, thresholds, key files and roadmaps after a local repository links", async () => {
    const configured = await config(
      [
        '[papers."github:Finch/Perch"]',
        'wire = "Machine & Home"',
        'name = "Perch"',
        "unsafe_amber_hours = 300",
        "unsafe_red_hours = 400",
        'key_files = ["docs/spec.md"]',
        'roadmaps = ["docs/plan.md"]',
        "",
      ].join("\n"),
    );
    const forgeOnly = rawFiles({
      includes: { "/home/test/dev": "directory" },
      locals: {},
      forges: { github: [forgeRepo("finch/perch", {})] },
    });
    const birdNamed = (snapshot: Snapshot, id: string) => {
      const aviary = deriveAviary(snapshot, configured, {}, "/home/test");
      return [
        ...aviary.wires.flatMap((wire) => wire.birds),
        ...aviary.fence.birds,
      ].find((bird) => bird.id === id);
    };

    const before = birdNamed(
      aggregated(forgeOnly, configured),
      "github:finch/perch",
    );
    const snapshot = aggregated(files, configured);
    const after = birdNamed(snapshot, "dev/perch");
    const perch = snapshot.entities.find((entity) => entity.id === "dev/perch");

    expect([before?.wire, before?.name]).toEqual(["Machine & Home", "Perch"]);
    expect([after?.wire, after?.name]).toEqual(["Machine & Home", "Perch"]);
    expect(perch?.flags.map((flag) => flag.flag)).not.toContain("not-set-up");
    expect(perch?.sources.git).toMatchObject({
      drift: { unpushed: { hours: 240, level: "green" } },
    });
    expect(after?.page.keyFiles.map((file) => file.path)).toEqual([
      "docs/spec.md",
    ]);
    expect(localPapers(files, configured).get("dev/perch")?.roadmaps).toEqual([
      "docs/plan.md",
    ]);
    expect(entityConflicts(snapshot)).toEqual([]);
  });

  it("flags two sets of papers naming one project, and the one keyed by its id applies", async () => {
    const configured = await config(
      '[papers."github:finch/perch"]\nname = "Forge"\n\n[papers."dev/perch"]\nname = "Local"\n',
    );

    const snapshot = aggregated(files, configured);
    const perch = snapshot.entities.find((entity) => entity.id === "dev/perch");
    const bird = deriveAviary(snapshot, configured, {}, "/home/test")
      .wires.flatMap((wire) => wire.birds)
      .find((candidate) => candidate.id === "dev/perch");

    expect(entityConflicts(snapshot)).toEqual([
      {
        assertion: 'papers."dev/perch", papers."github:finch/perch"',
        detail: 'name one entity, dev/perch; papers."dev/perch" applies',
      },
    ]);
    expect(perch?.flags).toContainEqual({
      flag: "config-conflict",
      level: null,
      detail:
        'papers."dev/perch", papers."github:finch/perch": name one entity, dev/perch; papers."dev/perch" applies',
    });
    expect(bird?.name).toBe("Local");
  });
});
