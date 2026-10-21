import {
  asRecord,
  type JsonRecord,
  numberField,
  optionalString,
  stringField,
} from "../json.ts";
import type { PullRequest } from "../snapshot.ts";

/** Reads a pull request from a GitHub or Forgejo API response, which share these fields. */
export function readPullRequest(value: unknown): PullRequest {
  const record = asRecord(value, "pull request");
  const user = record.user;
  return {
    number: numberField(record, "number"),
    title: stringField(record, "title"),
    author:
      typeof user === "object" && user !== null
        ? optionalString(user as JsonRecord, "login")
        : null,
    draft: record.draft === true,
    updatedAt: stringField(record, "updated_at"),
    url: stringField(record, "html_url"),
  };
}
