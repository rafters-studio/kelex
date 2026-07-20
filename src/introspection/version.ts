import { createHash } from "node:crypto";
import type { FieldDescriptor, FormDescriptor } from "./types";

/**
 * Field-level keys excluded from the version hash at every depth.
 *
 * These are presentation, not contract: they describe how a field is labelled,
 * not what data conforms to it. Renaming a label must not invalidate captured
 * records or trigger a schema evolution downstream. `label` is additionally
 * redundant -- absent an explicit title it is derived from `name`, which is
 * hashed.
 */
const PRESENTATION_KEYS = new Set(["label", "description", "meta", "schemaRef"]);

/**
 * Produces a canonical, order-stable structure for hashing.
 *
 * Object keys are sorted so a property reordering in the reader does not churn
 * the version, while ARRAYS keep their order -- field declaration order is
 * semantic, and so is tuple element and union variant order. Excluded keys and
 * undefined values are dropped so an absent key and an explicitly-undefined one
 * hash identically.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (PRESENTATION_KEYS.has(key) || source[key] === undefined) {
        continue;
      }
      result[key] = canonicalize(source[key]);
    }
    return result;
  }

  return value;
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
  const canonical = JSON.stringify(canonicalize(fields));
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 16);
}

/** Recomputes the version for a descriptor whose fields may have been edited. */
export function withVersion(form: Omit<FormDescriptor, "version">): FormDescriptor {
  return { ...form, version: computeVersion(form.fields) };
}
