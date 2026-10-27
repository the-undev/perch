import {
  appendFile,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeTextAtomic } from "./config-edit.ts";
import {
  type ConfigWatch,
  createConfigWatch,
  rescanOnConfigChange,
} from "./config-watch.ts";

let dir: string;
let configPath: string;
let watching: ConfigWatch | undefined;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "perch-watch-"));
  configPath = join(dir, "config.toml");
});
afterEach(async () => {
  watching?.stop();
  watching = undefined;
  await rm(dir, { recursive: true, force: true });
});

/** A watch on the config path that counts what it is told. */
async function watchConfig(path = configPath) {
  const onChange = vi.fn();
  const onError = vi.fn();
  watching = createConfigWatch({ path, quietMs: 40, onChange, onError });
  await watching.start();
  return { onChange, onError, watch: watching };
}

/** Long enough for any event already raised to have been told. */
const settle = () => sleep(250);

describe("watching the config file", () => {
  it("tells a burst of edits once the file goes quiet", async () => {
    await writeFile(configPath, "a = 1\n");
    const { onChange } = await watchConfig();

    await appendFile(configPath, "b = 2\n");
    await appendFile(configPath, "c = 3\n");
    await writeFile(configPath, "d = 4\n");

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    await settle();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("sees an edit to a stowed config, made through its symlink", async () => {
    const stowed = join(dir, "dotfiles", "perch", "config.toml");
    await mkdir(join(dir, "dotfiles", "perch"), { recursive: true });
    await writeFile(stowed, "a = 1\n");
    await symlink(stowed, configPath);
    const { onChange } = await watchConfig();

    await writeTextAtomic(configPath, "a = 2\n");

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it("ignores other files beside it", async () => {
    await writeFile(configPath, "a = 1\n");
    const { onChange } = await watchConfig();

    await writeFile(join(dir, "notes.txt"), "elsewhere\n");
    await settle();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("tells nothing once stopped", async () => {
    await writeFile(configPath, "a = 1\n");
    const { onChange, watch } = await watchConfig();

    watch.stop();
    await writeFile(configPath, "a = 2\n");
    await settle();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports a directory it cannot watch without throwing, and tries again on the next start", async () => {
    const missing = join(dir, "perch");
    const { onError, onChange, watch } = await watchConfig(
      join(missing, "config.toml"),
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatch(
      /^The config file is not watched: /,
    );

    await mkdir(missing);
    await watch.start();
    await writeFile(join(missing, "config.toml"), "a = 1\n");

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });
});

describe("reacting to a hand edit", () => {
  it("scans when the config file changes on disk, after the reread", async () => {
    const calls: string[] = [];
    const onChange = rescanOnConfigChange({
      recheck: async () => {
        calls.push("recheck");
      },
      requestScan: async () => {
        calls.push("scan");
      },
    });

    onChange();
    await vi.waitFor(() => expect(calls).toEqual(["recheck", "scan"]));
  });
});
