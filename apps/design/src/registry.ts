// Every page on the design site, grouped. A new page is a component and one entry here; the index,
// the navigation and the route pick it up.

import type { ComponentType } from "react";
import { ActionsPage, IntroPage, LinksPage } from "./pages/actions-pages.tsx";
import { AviaryScenePage } from "./pages/aviary-scene-page.tsx";
import { BirdPage } from "./pages/bird-page.tsx";
import { BubblePage } from "./pages/bubble-page.tsx";
import { ButtonPage } from "./pages/button-page.tsx";
import { CameraScenePage } from "./pages/camera-scene-page.tsx";
import { ChipPage } from "./pages/chip-page.tsx";
import { CrowdedPage } from "./pages/crowded-page.tsx";
import { DetailScenePage } from "./pages/detail-scene-page.tsx";
import { AdoptFormPage, EntryEditorPage } from "./pages/entry-forms-pages.tsx";
import { LedgerPage } from "./pages/ledger-page.tsx";
import { PaperPage } from "./pages/paper-page.tsx";
import {
  BranchesPage,
  CommitsPage,
  FlagsPage,
  ProblemsPage,
  PullRequestsPage,
} from "./pages/sections-pages.tsx";
import { SkyPage } from "./pages/sky-page.tsx";
import { TokensPage } from "./pages/tokens-page.tsx";
import { WirePage } from "./pages/wire-page.tsx";
import { ChainPage } from "./spec/chain-page.tsx";
import { ConfigPage } from "./spec/config-page.tsx";
import { PhrasebookPage } from "./spec/phrasebook-page.tsx";
import {
  ClaudeSessionsPage,
  ForgejoPage,
  GithubPage,
  KumaPage,
  LocalGitPage,
  RoadmapsPage,
} from "./spec/source-pages.tsx";

export type GroupId = "components" | "primitives" | "scenes" | "spec";

export interface Group {
  id: GroupId;
  title: string;
  blurb: string;
}

export interface DesignPage {
  slug: string;
  group: GroupId;
  title: string;
  /** One or two sentences for the index card and the page's head. */
  summary: string;
  component: ComponentType;
}

export const groups: Group[] = [
  {
    id: "components",
    title: "Components",
    blurb:
      "The perch components from @perch/ui, each in every state the view model allows, with the rule behind it.",
  },
  {
    id: "primitives",
    title: "Primitives",
    blurb: "The shadcn basics the apps use, themed onto the ink palette.",
  },
  {
    id: "scenes",
    title: "Scenes",
    blurb:
      "The composed views the desktop app renders, on the mock dataset: the aviary, the detail page, and the camera between them.",
  },
  {
    id: "spec",
    title: "Spec",
    blurb:
      "Reference pages that run the real code: the sources and their types, the model chain, the config, and what the birds say.",
  },
];

export const pages: DesignPage[] = [
  {
    slug: "tokens",
    group: "components",
    title: "Tokens",
    summary:
      "The ink palette, mood colours, sky phases, paper and type: the one theme both apps import.",
    component: TokensPage,
  },
  {
    slug: "bird",
    group: "components",
    title: "Bird",
    summary:
      "Breast from mood, size from importance, plumpness from outstanding work, the fence, sleep and song.",
    component: BirdPage,
  },
  {
    slug: "wire",
    group: "components",
    title: "Wire and Fence",
    summary:
      "A priority band with its birds leftmost first, and the fence beneath for the unadopted.",
    component: WirePage,
  },
  {
    slug: "sky",
    group: "components",
    title: "Sky",
    summary:
      "The scene's backdrop at dawn, day, dusk and night, following the clock.",
    component: SkyPage,
  },
  {
    slug: "bubble",
    group: "components",
    title: "Bubble",
    summary:
      "Tier B: name, mood word, first-person speech, chips and actions, every phrasebook situation.",
    component: BubblePage,
  },
  {
    slug: "chip",
    group: "components",
    title: "Chip",
    summary: "One number the bird carries, plain, amber or red.",
    component: ChipPage,
  },
  {
    slug: "detail-intro",
    group: "components",
    title: "Detail heading",
    summary: "The top of a bird's page: name, mood word, activity and speech.",
    component: IntroPage,
  },
  {
    slug: "ledger",
    group: "components",
    title: "Ledger",
    summary:
      'Facts in full words: clean zeros a quiet green "none", counts toned by severity.',
    component: LedgerPage,
  },
  {
    slug: "branches",
    group: "components",
    title: "Branch lines",
    summary:
      "Local branches, the checked-out one first, linked to their forge.",
    component: BranchesPage,
  },
  {
    slug: "commits",
    group: "components",
    title: "Newest commits",
    summary: 'The default branch on each forge, headed "main on GitHub".',
    component: CommitsPage,
  },
  {
    slug: "pull-requests",
    group: "components",
    title: "Pull requests",
    summary: "Open pull requests across forges, newest first.",
    component: PullRequestsPage,
  },
  {
    slug: "flags",
    group: "components",
    title: "Flag lines",
    summary: "Facts the scan raised about the bird, toned by level.",
    component: FlagsPage,
  },
  {
    slug: "problems",
    group: "components",
    title: "Sources not read",
    summary: "Sources that failed for this bird, with their errors.",
    component: ProblemsPage,
  },
  {
    slug: "actions",
    group: "components",
    title: "Launch actions",
    summary: "Verbs that open things and change nothing.",
    component: ActionsPage,
  },
  {
    slug: "links",
    group: "components",
    title: "Links out",
    summary: "The bird's repositories on its forges.",
    component: LinksPage,
  },
  {
    slug: "paper",
    group: "components",
    title: "Key-file paper",
    summary: "Markdown on paper behind folder tabs.",
    component: PaperPage,
  },
  {
    slug: "adopt-form",
    group: "components",
    title: "Adopt form",
    summary:
      "A fence bird's Adopt verb and its form: a wire and a name, written as a new entry.",
    component: AdoptFormPage,
  },
  {
    slug: "entry-editor",
    group: "components",
    title: "Entry editor",
    summary:
      "An adopted bird's config entry: wire, name, importance, expectations, paths and threshold overrides.",
    component: EntryEditorPage,
  },
  {
    slug: "aviary",
    group: "scenes",
    title: "The aviary",
    summary:
      "The whole home scene on the mock: sky by the clock, wires, fence, tips, bubbles and the arrival.",
    component: AviaryScenePage,
  },
  {
    slug: "detail",
    group: "scenes",
    title: "The detail page",
    summary:
      "Tier C for five contrasting birds: ledger, sections, actions, links and paper.",
    component: DetailScenePage,
  },
  {
    slug: "camera",
    group: "scenes",
    title: "The camera",
    summary:
      "The aviary and the detail joined: header tabs, the strip, the flights, Escape home.",
    component: CameraScenePage,
  },
  {
    slug: "crowded-wire",
    group: "scenes",
    title: "A crowded wire",
    summary:
      "A wire holding more birds than one row fits splits over two rows, or more.",
    component: CrowdedPage,
  },
  {
    slug: "model-chain",
    group: "spec",
    title: "The model chain",
    summary:
      "Raw facts to snapshot to view model, the two-stage rule, and where each derivation lives.",
    component: ChainPage,
  },
  {
    slug: "source-local-git",
    group: "spec",
    title: "Local git",
    summary:
      "Data source: the clones under the include paths, read with git, and the git data derived from them.",
    component: LocalGitPage,
  },
  {
    slug: "source-github",
    group: "spec",
    title: "GitHub",
    summary:
      "Data source: account listings, pull requests, workflow runs and finalised commits.",
    component: GithubPage,
  },
  {
    slug: "source-forgejo",
    group: "spec",
    title: "Forgejo",
    summary:
      "Data source: the same as GitHub, CI from the combined commit status.",
    component: ForgejoPage,
  },
  {
    slug: "source-roadmaps",
    group: "spec",
    title: "Roadmaps",
    summary:
      "Data source: roadmap files parsed into headings and bullets, counted into work items.",
    component: RoadmapsPage,
  },
  {
    slug: "source-claude-sessions",
    group: "spec",
    title: "Claude sessions",
    summary:
      "Data source: Claude Code transcripts, read for the time of the last session.",
    component: ClaudeSessionsPage,
  },
  {
    slug: "source-uptime-kuma",
    group: "spec",
    title: "Uptime Kuma",
    summary:
      "Data source: the server's status page, gathered and derived, not shown until server monitoring.",
    component: KumaPage,
  },
  {
    slug: "config",
    group: "spec",
    title: "Config",
    summary:
      "config.example.toml table by table beside what parseConfig makes of it, and the config model.",
    component: ConfigPage,
  },
  {
    slug: "phrasebook",
    group: "spec",
    title: "Phrasebook",
    summary:
      "What a bird says in every situation, by the real speak() over subjects from the mock.",
    component: PhrasebookPage,
  },
  {
    slug: "button",
    group: "primitives",
    title: "Button",
    summary: "shadcn's button in every variant and size.",
    component: ButtonPage,
  },
];

/** The page at a slug, if there is one. */
export function pageBySlug(slug: string): DesignPage | undefined {
  return pages.find((page) => page.slug === slug);
}

/** The pages of one group, in registry order. */
export function pagesIn(group: GroupId): DesignPage[] {
  return pages.filter((page) => page.group === group);
}
