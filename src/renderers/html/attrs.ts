import type { FieldDescriptor } from "../../introspection/types";
import { pathToId } from "./path-id";

/** Escape a string for safe use in HTML text or a double-quoted attribute value. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render an attribute map to a string, skipping undefined values. */
export function attrs(map: Record<string, string | number | boolean | undefined>): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined || v === false) continue;
    if (v === true) out.push(k);
    else out.push(`${k}="${escapeHtml(String(v))}"`);
  }
  return out.length > 0 ? ` ${out.join(" ")}` : "";
}

/**
 * The hook trio + aria wiring every control shares: `name` = the literal path
 * (the join key), `id` = the injective `pathToId` (unique, valid HTML), a
 * `data-path` mirror (canonical, `*` for template slots), and the aria pair
 * pointing at the path-addressed error slot. `aria-invalid` starts "false".
 */
export function hookAttrs(key: string): Record<string, string> {
  const id = pathToId(key);
  return {
    name: key,
    id,
    "data-path": key,
    "aria-invalid": "false",
    "aria-describedby": `${id}-error`,
  };
}

/**
 * Native HTML5 validation attributes derived from the schema's own constraints --
 * the schema does the work, no JS. `required` comes from a non-optional field;
 * length/pattern/min/max/step come straight from the constraint facts. Exclusive
 * numeric bounds have no exact native attribute, so they map to the inclusive
 * one (documented lossy edge -- the server's `~standard` pass is authoritative).
 */
export function validationAttrs(
  field: FieldDescriptor,
): Record<string, string | number | boolean | undefined> {
  const c = field.constraints;
  const out: Record<string, string | number | boolean | undefined> = {
    required: !field.isOptional || undefined,
    minlength: c.minLength ?? c.length,
    maxlength: c.maxLength ?? c.length,
    pattern: c.pattern,
  };
  if (field.type === "number") {
    out.min = c.min;
    out.max = c.max;
    out.step = c.step ?? (c.isInt ? 1 : undefined);
  }
  if (field.type === "date") {
    out.min = c.minDate;
    out.max = c.maxDate;
  }
  return out;
}

/** The path-addressed error slot -- empty, aria-live, addressed by `data-error-for`. */
export function errorSlot(key: string): string {
  const id = pathToId(key);
  return `<span id="${id}-error" data-error-for="${escapeHtml(key)}" role="alert" aria-live="polite"></span>`;
}

/** The shared leaf frame: a `<label for>`, the control markup, and the error slot. */
export function fieldFrame(key: string, label: string, control: string): string {
  const id = pathToId(key);
  return `<div><label for="${id}">${escapeHtml(label)}</label>${control}${errorSlot(key)}</div>`;
}
