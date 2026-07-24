import type { FieldDescriptor } from "../introspection/types";
import type { Bound, Config, Entry, Match, Setting } from "./types";

/**
 * The match/config engine. Internal -- a plugin author never calls these; the
 * fold does. Matching is FIRST-MATCH over an ordered inventory (never specificity
 * scoring, the proven dead end); `resolveConfig` fills a `$ref` from the field's
 * own facts.
 */

function inBound(value: number | undefined, b: Bound): boolean {
  if (value === undefined) return false;
  if (b.gt !== undefined && !(value > b.gt)) return false;
  if (b.gte !== undefined && !(value >= b.gte)) return false;
  if (b.lt !== undefined && !(value < b.lt)) return false;
  if (b.lte !== undefined && !(value <= b.lte)) return false;
  return true;
}

/** Whether a field satisfies one entry's `match` predicate. */
export function matchesEntry(field: FieldDescriptor, m: Match): boolean {
  if (field.type !== m.type) return false;
  const c = field.constraints;
  if (m.format !== undefined && c.format !== m.format) return false;
  if (m.ui !== undefined && (field.meta as Record<string, unknown> | undefined)?.["ui"] !== m.ui)
    return false;
  // A `.length(n)` field reports `length`; a `.min().max()` reports minLength/maxLength.
  if (m.minLength !== undefined && !inBound(c.minLength ?? c.length, m.minLength)) return false;
  if (m.maxLength !== undefined && !inBound(c.maxLength ?? c.length, m.maxLength)) return false;
  if (m.bounded && (c.min === undefined || c.max === undefined)) return false;
  if (m.hasFields !== undefined) {
    if (field.metadata.kind !== "object") return false;
    const names = new Set(field.metadata.fields.map((f) => f.name));
    if (!m.hasFields.every((n) => names.has(n))) return false;
  }
  return true;
}

/** The first entry (in order) whose match the field satisfies. */
export function matches(field: FieldDescriptor, inventory: Entry[]): Entry | undefined {
  return inventory.find((e) => matchesEntry(field, e.match));
}

function readRef(field: FieldDescriptor, ref: string): unknown {
  const key = ref.slice(1);
  const fromConstraint = (field.constraints as Record<string, unknown>)[key];
  if (fromConstraint !== undefined) return fromConstraint;
  const m = field.metadata;
  if (key === "values" && (m.kind === "enum" || m.kind === "literal")) return m.values;
  return undefined;
}

/**
 * Resolves an entry's settings against a field's facts. A `"$length"` reads the
 * field's constraint; a `{ ref, default }` reads it or falls back. Non-`$`
 * values pass through. So a composer only ever sees final props.
 */
export function resolveConfig(
  field: FieldDescriptor,
  settings: Record<string, Setting> | undefined,
): Config {
  const out: Config = {};
  for (const [k, v] of Object.entries(settings ?? {})) {
    if (v && typeof v === "object" && "ref" in v) {
      const spec = v as { ref: string; default?: unknown };
      const got = readRef(field, spec.ref);
      out[k] = got ?? spec.default;
    } else if (typeof v === "string" && v.startsWith("$")) {
      out[k] = readRef(field, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
