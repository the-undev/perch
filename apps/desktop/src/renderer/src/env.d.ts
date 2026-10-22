import type { PerchApi } from "../../shared/ipc.ts";

declare global {
  interface Window {
    /** The main-process calls the preload exposes. */
    perch: PerchApi;
  }
}
