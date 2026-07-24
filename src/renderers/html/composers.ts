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
    const value = i.config.value;
    return `<input${attrs({ type, ...hookAttrs(i.key), value: value === undefined ? undefined : String(value) })}>`;
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

/** A boolean -> a single checkbox. `required` means it must be checked. */
const checkbox: Composer<string> = (i) => {
  const control = `<input${attrs({ type: "checkbox", ...hookAttrs(i.key), required: !i.field.isOptional || undefined })}>`;
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
        const optId = `${id}__${n}`;
        return `<label for="${optId}"><input${attrs({ type: "radio", id: optId, name: i.key, value: String(v), required: required && n === 0 ? true : undefined })}>${escapeHtml(String(v))}</label>`;
      })
      .join("");
    return `<div role="radiogroup" aria-describedby="${id}-error" data-path="${escapeHtml(i.key)}"><span>${escapeHtml(i.field.label)}</span>${options}${errorSlot(i.key)}</div>`;
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

/** The composers the leaf inventory names, plus the required `form`/`fallback`. */
export const leafComposers: Record<string, Composer<string>> = {
  input,
  textarea,
  checkbox,
  enum: enumControl,
};

/** A minimal form wrapper -- #228 upgrades this to a real `<form action>` + submit. */
export const form = (children: { rendered: string }[]): string =>
  `<form>${children.map((c) => c.rendered).join("")}</form>`;

export const leafFallback = fallback;
