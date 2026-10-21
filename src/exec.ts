import { execFile } from "node:child_process";

export interface CommandOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

/** Runs a command without a shell and resolves with its stdout, rejecting on a non-zero exit. */
export function runCommand(
  file: string,
  args: readonly string[],
  options: CommandOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        cwd: options.cwd,
        env: options.env,
        maxBuffer: 64 * 1024 * 1024,
        timeout: 60_000,
      },
      (error, stdout, stderr) => {
        if (error) {
          const detail = stderr.trim() || error.message;
          reject(new Error(`${file} ${args.join(" ")}: ${detail}`));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/** Maps over values with at most the given number of calls in flight. */
export async function mapWithLimit<T, R>(
  values: readonly T[],
  limit: number,
  step: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < values.length) {
      const index = next++;
      results[index] = await step(values[index] as T);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, worker),
  );
  return results;
}
