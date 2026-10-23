import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "../src/cli/paths.ts";

describe("CLI paths", () => {
  it("resolve the workspace root, which holds the workspace file", () => {
    expect(existsSync(join(repoRoot, "pnpm-workspace.yaml"))).toBe(true);
  });
});
