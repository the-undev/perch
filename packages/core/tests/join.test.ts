import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aggregate } from "../src/aggregate.ts";
import { parseConfig } from "../src/config.ts";
import {
  type ForgeInput,
  joinPresences,
  type LocalInput,
} from "../src/join.ts";
import type { ForgeName, RawForgeRepo } from "../src/raw.ts";
import {
  forgeRepo,
  gatheredAt,
  localPresence,
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
    presence: localPresence(`/home/test/${id}`, {
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
  return { forge: name, key: repo.info.fullName.toLowerCase(), repo };
}

function joined(input: {
  locals?: LocalInput[];
  forges?: ForgeInput[];
  joins?: string[][];
  ignore?: string[];
}) {
  return joinPresences({
    locals: input.locals ?? [],
    forges: input.forges ?? [],
    forgeForHost,
    joins: input.joins ?? [],
    ignore: input.ignore ?? [],
  });
}

const refsOf = (result: ReturnType<typeof joined>) =>
  result.projects.map((project) => project.refs);

describe("joining by remote URL", () => {
  it("joins a clone to every forge presence its remotes name, without case and through SSH aliases", () => {
    const result = joined({
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
      [
        "local:dev/dotfiles",
        "github:finch/dotfiles",
        "forgejo:finch/dotfiles",
      ],
      ["local:undev/Hollow-legacy", "github:the-undev/hollow"],
    ]);
  });

  it("joins a dual-push remote to the forge named only by its second push URL", () => {
    const github = "git@github.com:finch/perch.git";
    const result = joined({
      locals: [
        {
          id: "dev/perch",
          presence: localPresence("/home/test/dev/perch", {
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
    const result = joined({
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

  it("keeps unjoined presences as their own projects and never joins two forge presences", () => {
    const result = joined({
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

  it("flags a clone whose remote names an archived repository, which joins nothing", () => {
    const result = joined({
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
    expect(result.unlisted.map((presence) => presence.key)).toEqual([
      "finch/mixed-bag",
    ]);
  });

  it("leaves a presence with the first clone and flags a second clone of it", () => {
    const url = "git@github.com:finch/perch.git";
    const result = joined({
      locals: [local("dev/perch", [url]), local("dev/perch-copy", [url])],
      forges: [forge("github", forgeRepo("finch/perch", {}))],
    });

    expect(refsOf(result)).toEqual([
      ["local:dev/perch", "github:finch/perch"],
      ["local:dev/perch-copy"],
    ]);
    expect(result.projects[1]?.flags.map((flag) => flag.flag)).toEqual([
      "remote-joined-elsewhere",
    ]);
  });
});

describe("asserted joins", () => {
  it("merge forge presences that no URL proves, matching references without case", () => {
    const result = joined({
      forges: [
        forge("github", forgeRepo("finch/notes", {})),
        forge("forgejo", forgeRepo("finch/notes", {})),
      ],
      joins: [["github:Finch/Notes", "forgejo:finch/notes"]],
    });

    expect(refsOf(result)).toEqual([
      ["github:finch/notes", "forgejo:finch/notes"],
    ]);
    expect(result.conflicts).toEqual([]);
  });

  it("merge into the project with the local clone", () => {
    const result = joined({
      locals: [local("dev/notes", ["git@github.com:finch/notes.git"])],
      forges: [
        forge("github", forgeRepo("finch/notes", {})),
        forge("forgejo", forgeRepo("finch/notes", {})),
      ],
      joins: [["forgejo:finch/notes", "github:finch/notes"]],
    });

    expect(refsOf(result)).toEqual([
      ["local:dev/notes", "github:finch/notes", "forgejo:finch/notes"],
    ]);
  });

  it("lose to the observation when they would join two local clones, flagging both", () => {
    const result = joined({
      locals: [local("dev/a", []), local("dev/b", [])],
      joins: [["local:dev/a", "local:dev/b"]],
    });

    expect(refsOf(result)).toEqual([["local:dev/a"], ["local:dev/b"]]);
    expect(result.conflicts).toEqual([
      {
        assertion: 'joins ["local:dev/a","local:dev/b"]',
        detail: "it would join two local clones into one project",
      },
    ]);
    expect(
      result.projects.map((project) => project.flags.map((flag) => flag.flag)),
    ).toEqual([["config-conflict"], ["config-conflict"]]);
  });

  it("are recorded as conflicts when a presence is missing or archived", () => {
    const result = joined({
      forges: [
        forge("github", forgeRepo("finch/notes", {})),
        forge("github", forgeRepo("finch/old", { archived: true })),
      ],
      joins: [
        [
          "github:finch/notes",
          "forgejo:finch/notes",
          "github:finch/old",
        ],
      ],
    });

    expect(refsOf(result)).toEqual([["github:finch/notes"]]);
    expect(result.conflicts[0]?.detail).toBe(
      "forgejo:finch/notes was not observed; github:finch/old is archived",
    );
  });
});

describe("ignores", () => {
  it("drop a forge-only presence but not one a local clone uses", () => {
    const result = joined({
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

    expect(refsOf(result)).toEqual([
      ["local:dev/perch", "github:finch/perch"],
    ]);
    expect([...result.ignored]).toEqual(["github:finch/scratch"]);
    expect(result.conflicts.map((entry) => entry.detail)).toEqual([
      "local:dev/perch uses it, so it stays",
      "github:finch/gone was not observed",
    ]);
  });
});

describe("aggregating joined projects", () => {
  async function config(extra: string) {
    const text = await readFile(
      join(import.meta.dirname, "..", "..", "..", "config.example.toml"),
      "utf8",
    );
    return parseConfig(
      text.replace("[forges]\n", `${extra}\n[forges]\n`),
      "/home/test",
    );
  }

  const files = rawFiles({
    includes: { "/home/test/dev": "directory" },
    locals: {
      "dev/perch": localPresence("/home/test/dev/perch", {
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
      "dev/toy": localPresence("/home/test/dev/toy", {
        include: "/home/test/dev",
      }),
      "dev/gone": localPresence("/home/test/dev/gone", {
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

  it("merges local and forge data into one item and sets each clone's backup state", async () => {
    const snapshot = aggregate(
      { status: okStatus({}), files },
      {
        config: await config(
          '[items."dev/perch"]\n[items."dev/toy"]\n[items."dev/gone"]\n',
        ),
        configPath: "c",
        liveSources: [],
        previous: null,
      },
      new Date(gatheredAt),
    );

    expect(snapshot.items.map((item) => item.id)).toEqual([
      "dev/perch",
      "dev/toy",
      "dev/gone",
      "github:finch/notes",
    ]);
    const byId = Object.fromEntries(
      snapshot.items.map((item) => [item.id, item]),
    );
    expect(
      byId["dev/perch"]?.presences.forges.map((presence) => presence.ref),
    ).toEqual(["github:finch/perch"]);
    expect(byId["dev/perch"]?.sources.github).toMatchObject({
      fullName: "finch/perch",
    });
    expect(byId["dev/perch"]?.sources.git).toMatchObject({
      backup: "joined",
      drift: { unpushed: { hours: 240 } },
    });
    expect(byId["dev/toy"]?.sources.git).toMatchObject({
      backup: "local-only",
    });
    expect(byId["dev/gone"]?.sources.git).toMatchObject({
      backup: "unjoined-remote",
    });
    expect(byId["github:finch/notes"]).toMatchObject({
      kind: "repo",
      path: null,
      name: "notes",
    });
  });

  it("lists every forge presence grouped active and archived, and keeps archived ones off the items", async () => {
    const snapshot = aggregate(
      { status: okStatus({}), files },
      {
        config: await config(""),
        configPath: "c",
        liveSources: [],
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
          itemId: "github:finch/notes",
          ignored: false,
        },
        {
          ref: "github:finch/perch",
          fullName: "finch/perch",
          url: "https://example.invalid/finch/perch",
          itemId: "dev/perch",
          ignored: false,
        },
      ],
      archived: [
        {
          ref: "github:finch/old",
          fullName: "finch/old",
          url: "https://example.invalid/finch/old",
          itemId: null,
          ignored: false,
        },
      ],
    });
    expect(
      snapshot.items.some((item) => item.id === "github:finch/old"),
    ).toBe(false);
  });

  it("records config entries that name nothing observed or a presence joined into another item", async () => {
    const snapshot = aggregate(
      { status: okStatus({}), files },
      {
        config: await config(
          '[items."dev/vanished"]\n[items."github:finch/perch"]\n',
        ),
        configPath: "c",
        liveSources: [],
        previous: null,
      },
      new Date(gatheredAt),
    );

    expect(
      snapshot.conflicts.filter(
        (entry) => !entry.assertion.includes("obsidian"),
      ),
    ).toEqual([
      {
        assertion: 'items."dev/vanished"',
        detail: "dev/vanished was not observed",
      },
      {
        assertion: 'items."github:finch/perch"',
        detail: "names a presence joined into dev/perch; key it by that id",
      },
    ]);
    const perch = snapshot.items.find((item) => item.id === "dev/perch");
    expect(perch?.flags.map((flag) => flag.flag)).toContain("config-conflict");
  });
});
