import { sha256Hex } from "./sha256";
import type { FieldDescriptor, FormDescriptor } from "./types";

/**
 * FieldDescriptor property names excluded from the version hash.
 *
 * These are presentation, not contract: they describe how a field is labelled,
 * not what data conforms to it. Renaming a label must not invalidate captured
 * records or trigger a schema evolution downstream. `label` is additionally
 * redundant -- absent an explicit title it is derived from `name`, which is
 * hashed.
 *
 * They are stripped ONLY from an object recognized as a FieldDescriptor (see
 * `looksLikeFieldDescriptor`), never recursively from a user value payload such
 * as a `defaultValue` or a literal value -- a default `{ label: "x" }` is data,
 * and stripping its `label` there made three different defaults collide (#176).
 */
const PRESENTATION_KEYS = new Set(["label", "description", "meta", "schemaRef"]);

/**
 * Whether an object is a FieldDescriptor (vs a user value payload). Requires
 * several structural markers together so a `defaultValue`/literal object that
 * merely happens to carry one of them is not mistaken for a descriptor.
 */
function looksLikeFieldDescriptor(o: Record<string, unknown>): boolean {
  return (
    typeof o.name === "string" &&
    typeof o.type === "string" &&
    typeof o.isOptional === "boolean" &&
    typeof o.isNullable === "boolean"
  );
}

/**
 * Produces a canonical, order-stable structure for hashing.
 *
 * Object keys are sorted so a property reordering in the reader does not churn
 * the version, while ARRAYS keep their order -- field declaration order is
 * semantic, and so is tuple element and union variant order. Undefined values
 * are dropped so an absent key and an explicitly-undefined one hash identically.
 * Dates and bigints pass through as-is; `stableSerialize` renders them (JSON
 * cannot).
 *
 * Presentation keys are stripped only from an object that IS a descriptor, so a
 * value payload keeps every key it carries.
 */
function canonicalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const strip = looksLikeFieldDescriptor(source);
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if ((strip && PRESENTATION_KEYS.has(key)) || source[key] === undefined) {
        continue;
      }
      result[key] = canonicalize(source[key]);
    }
    return result;
  }

  return value;
}

/**
 * Deterministic serialization of a canonicalized structure.
 *
 * Replaces `JSON.stringify`, which throws on bigint (`z.literal(1n)` /
 * `z.bigint().default(5n)` crashed the whole pipeline -- #176) and cannot render
 * a Date. Keys arrive already sorted from `canonicalize`, so insertion order is
 * canonical; this only turns the structure into a string, tagging bigint and
 * Date so they cannot collide with a string that happens to look the same.
 */
function stableSerialize(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value instanceof Date) {
    return `Date(${value.getTime()})`;
  }
  const t = typeof value;
  if (t === "bigint") {
    return `${value as bigint}n`;
  }
  if (t === "string") {
    return JSON.stringify(value);
  }
  if (t === "number" || t === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (t === "object") {
    const source = value as Record<string, unknown>;
    return `{${Object.keys(source)
      .map((k) => `${JSON.stringify(k)}:${stableSerialize(source[k])}`)
      .join(",")}}`;
  }
  // undefined / function / symbol -- canonicalize drops undefined; anything else
  // reaching here is not structural content and is tagged rather than crashing.
  return `<${t}>`;
}

/**
 * Computes a deterministic content hash over a descriptor's structural content.
 *
 * Identical schemas produce an identical version and any change to the data
 * contract produces a new one, with no human bump -- so a capture pipeline can
 * detect schema evolution on its own and a descriptor-reading consumer can pin
 * against a stable value.
 *
 * Hashes the FIELDS only. Everything else on the descriptor is either cosmetic
 * (`name`, `schemaImportPath`, `schemaExportName`), derived diagnostics
 * (`warnings` -- whose text changes when warning wording improves, which is not
 * a schema change), or presentation grouping (`steps`). Including any of them
 * would churn the version without the data contract having moved.
 */
export function computeVersion(fields: FieldDescriptor[]): string {
  const canonical = stableSerialize(canonicalize(fields));
  return sha256Hex(canonical).slice(0, 16);
}

/** Recomputes the version for a descriptor whose fields may have been edited. */
export function withVersion(form: Omit<FormDescriptor, "version">): FormDescriptor {
  return { ...form, version: computeVersion(form.fields) };
}
