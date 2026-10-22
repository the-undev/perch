import type { LiveSource } from "./source.ts";

export interface ContainerSummary {
  name: string;
  state: string;
}

/**
 * The server page's container list, to be read from a Docker socket proxy on Silo over HTTP.
 * A typed stub: it marks where live sources plug in and returns not-implemented.
 */
export const dockerContainersSource: LiveSource<
  "dockerContainers",
  ContainerSummary[]
> = {
  name: "dockerContainers",
  appliesTo: (item) => item.kind === "server",
  fetch: async () => ({ state: "not-implemented" }),
};
