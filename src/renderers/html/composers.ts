import type { Composer } from "../../engine/types";
import { attrs, errorSlot, escapeHtml, fieldFrame, hookAttrs, validationAttrs } from "./attrs";
import { pathToId } from "./path-id";

/** Radio (few options) vs select (many) threshold. A composer choice, not a Match. */
const RADIO_MAX = 4;

const asString = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const asValues = (v: unknown): (string | number)[] =>
  Array.isArray(v) ? (v as (string | number)[]) : [];

/**
 * Presentation attributes an inventory entry set beyond the structural ones the
 * composer handles itself (`type`/`value`/`values`) -- e.g. an otp row's
 * `inputmode`/`autocomplete`. Pass through the scalar ones as HTML attributes.
 */
const extraAttrs = (config: Record<string, unknown>): Record<string, string | number | boolean> => {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(config)) {
    if (k === "type" || k === "value" || k === "values") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
};

/**
 * The one `input` composer, parametrized by `config.type` (text/email/url/tel/
 * password/number/range/date/hidden). A `hidden` literal skips the visible frame
 * -- it carries no user-facing label or error. Every other input gets the shared
 * `<label>` + hook trio + native validation attrs + error slot.
 */
const input: Composer<string> = (i) => {
  const type = asString(i.config.type, "text");
  if (type === "hidden") {
    // A hidden input carries no label or error slot, so it drops the aria pair
    // (which would dangle at a slot that is never rendered) -- keeping only the
    // join hooks (name/id/data-path).
    // `$values` resolves to the literal's value array; a hidden input carries one
    // value, so take the first (a multi-value literal's canonical member) rather
    // than stringifying the whole array into a value the schema would reject.
    const raw = i.config.value;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return `<input${attrs({
      type,
      name: i.key,
      id: pathToId(i.key),
      "data-path": i.key,
      value: value === undefined ? undefined : String(value),
    })}>`;
  }
  const control = `<input${attrs({ type, ...hookAttrs(i.key), ...validationAttrs(i.field), ...extraAttrs(i.config) })}>`;
  return fieldFrame(i.key, i.field.label, control);
};

/** A long string -> `<textarea>`. Pattern is not valid on textarea, so it is dropped. */
const textarea: Composer<string> = (i) => {
  const v = validationAttrs(i.field);
  const control = `<textarea${attrs({
    ...hookAttrs(i.key),
    required: v.required,
    minlength: v.minlength,
    maxlength: v.maxlength,
  })}></textarea>`;
  return fieldFrame(i.key, i.field.label, control);
};

/**
 * A boolean -> a single checkbox. It is NOT marked `required`: native `required`
 * on a checkbox means "must be checked", but a non-optional boolean accepts
 * `false` just as validly as `true` -- only a missing value is invalid, which a
 * checkbox cannot express. (A future `z.literal(true)` mapping could opt in.)
 */
const checkbox: Composer<string> = (i) => {
  const control = `<input${attrs({ type: "checkbox", ...hookAttrs(i.key) })}>`;
  return fieldFrame(i.key, i.field.label, control);
};

/** An enum -> radio group (few) or select (many). Cardinality is read here, not matched. */
const enumControl: Composer<string> = (i) => {
  const values = asValues(i.config.values);
  const id = pathToId(i.key);
  const required = !i.field.isOptional;
  if (values.length > 0 && values.length <= RADIO_MAX) {
    const options = values
      .map((v, n) => {
        // `pathToId` never emits `-` (a hyphen escapes to `_h`), so a `-opt-`
        // delimiter cannot collide with any control's own id -- unlike `__${n}`,
        // which clashed with a sibling whose path `_` escaped to `__`.
        const optId = `${id}-opt-${n}`;
        return `<label for="${optId}"><input${attrs({ type: "radio", id: optId, name: i.key, value: String(v), required: required && n === 0 ? true : undefined })}>${escapeHtml(String(v))}</label>`;
      })
      .join("");
    // The group is the control: it carries the canonical id + the aria pair (a
    // per-option `<label for>` targets each radio; the group is labelled by its
    // own `<span>`). aria-invalid mirrors every other control's default.
    return `<div${attrs({ role: "radiogroup", id, "aria-labelledby": `${id}-label`, "aria-describedby": `${id}-error`, "aria-invalid": "false", "data-path": i.key })}><span id="${id}-label">${escapeHtml(i.field.label)}</span>${options}${errorSlot(i.key)}</div>`;
  }
  const options = values
    .map((v) => `<option${attrs({ value: String(v) })}>${escapeHtml(String(v))}</option>`)
    .join("");
  const control = `<select${attrs({ ...hookAttrs(i.key), required: required || undefined })}>${options}</select>`;
  return fieldFrame(i.key, i.field.label, control);
};

/**
 * A field the leaf inventory does not answer (a container -- object/array/union)
 * -- out of scope for the leaf renderer (#228 owns containers). Emit an inert
 * marker rather than throwing, so a leaf-scoped render never crashes.
 */
const fallback: Composer<string> = (i) =>
  `<!-- kelex: no leaf control for "${escapeHtml(i.key)}" (${i.field.type}) -->`;

/** The composers the leaf inventory names. Containers live in containers.ts. */
export const leafComposers: Record<string, Composer<string>> = {
  input,
  textarea,
  checkbox,
  enum: enumControl,
};

export const leafFallback = fallback;
