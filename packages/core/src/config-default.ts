// The config perch starts from: no sources, no item entries, one wire, and the standard windows
// and scan lanes. The starter config file is this written out; the CLI scans with it when
// the owner has no config. No Node modules, so the renderer may import it.

import type { Config } from "./config.ts";

/** A fresh default config, nothing in it specific to any machine. */
export function defaultConfig(): Config {
  return {
    wires: { names: ["projects"], default: "projects" },
    sources: { local: [], github: [], forgejo: [], kuma: [] },
    joins: [],
    ignore: [],
    thresholds: {
      unsafe: { amberHours: 24, redHours: 72 },
      stalled: { amberDays: 7, redDays: 30 },
      expectation: { amberDays: 7, redDays: 30 },
    },
    items: {},
    scan: {
      intervalMinutes: 15,
      archivedIntervalHours: 24,
      finalisedCommits: 10,
    },
    launch: {
      zellijSession: "main",
      zellijSessions: {},
      commands: {
        zellij: null,
        terminal: null,
        vscode: null,
        folder: null,
        obsidian: null,
      },
    },
  };
}
