// The config perch starts from: no sources, no item entries, no launch actions, one wire, and the
// default thresholds and scan interval. The starter config file is this written out; the CLI scans
// with it when the owner has no config. No Node modules, so the renderer may import it.

import {
  type Config,
  defaultTray,
  defaultUpdateCheck,
  defaultUpdateInstall,
} from "./config.ts";

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
    },
    items: {},
    scan: {
      intervalMinutes: 15,
      finalisedCommits: 10,
    },
    launch: { actions: [] },
    window: { tray: defaultTray },
    update: { check: defaultUpdateCheck, install: defaultUpdateInstall },
  };
}
