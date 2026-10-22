import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { examplePath, repoRoot } from "../src/cli/paths.ts";

describe("CLI paths", () => {
  it("resolve the workspace root, which holds the workspace file and the example config", () => {
    expect(existsSync(join(repoRoot, "pnpm-workspace.yaml"))).toBe(true);
    expect(existsSync(examplePath)).toBe(true);
  });
});
