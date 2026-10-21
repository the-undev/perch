import {
  asRecord,
  type JsonRecord,
  numberField,
  optionalString,
  stringField,
} from "../json.ts";
import type { RawPullRequest } from "../raw.ts";

/** Reads a pull request from a GitHub or Forgejo API response, which share these fields. */
export function readPullRequest(value: unknown): RawPullRequest {
  const record = asRecord(value, "pull request");
  const user = record.user;
  const login =
    typeof user === "object" && user !== null
      ? optionalString(user as JsonRecord, "login")
      : null;
  return {
    number: numberField(record, "number"),
    title: stringField(record, "title"),
    author:
      login === null
        ? { state: "absent", reason: "no-user" }
        : { state: "observed", value: login },
    draft: record.draft === true,
    updatedAt: stringField(record, "updated_at"),
    url: stringField(record, "html_url"),
  };
}
