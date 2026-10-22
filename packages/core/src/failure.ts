import type { FailureReason } from "./raw.ts";

/** An error that fails a whole source, with a machine-readable reason for the status file. */
export class SourceFailure extends Error {
  readonly reason: FailureReason;

  constructor(reason: FailureReason, message: string, options?: ErrorOptions) {
    super(message, options);
    this.reason = reason;
  }
}
