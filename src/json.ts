// Narrow readers for API responses, which arrive untyped.

export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown, what: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`unexpected response: ${what} is not an object`);
  }
  return value as JsonRecord;
}

export function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`unexpected response: ${what} is not an array`);
  }
  return value;
}

export function stringField(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`unexpected response: ${key} is not a string`);
  }
  return value;
}

/** A string field that may be absent, null or empty, read as null in each case. */
export function optionalString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value !== "" ? value : null;
}

export function numberField(record: JsonRecord, key: string): number {
  const value = record[key];
  if (typeof value !== "number") {
    throw new Error(`unexpected response: ${key} is not a number`);
  }
  return value;
}
