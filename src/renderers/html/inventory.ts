import type { Entry } from "../../engine/types";

/**
 * The base-HTML leaf inventory -- the CANONICAL reference a rafters/shadcn/material
 * author opens to learn the format. It is ordered (first-match), so every
 * specialization sits ABOVE its type-only catch-all. It demonstrates each match
 * kind: FORMAT (email/url), META-HINT (password/otp/tel via `.meta({ ui })`),
 * and CONSTRAINT-BUCKET (a long string -> textarea, a bounded number -> range).
 * The six scalar catch-alls at the bottom are the leaf floor -- every scalar
 * FieldType has a type-only entry, so nothing drops.
 *
 * Components are few and config-parametrized (inventory is DATA, composers are
 * code -- not 1:1): most rows resolve to the one `input` composer with a
 * different `type`, plus `textarea`/`checkbox`/`enum`. Enum radio-vs-select is a
 * cardinality choice `Match` cannot express, so the `enum` composer branches on
 * `values.length` -- see composers.ts.
 */
export const leafInventory: Entry[] = [
  // --- string specializations (above the string catch-all) ---
  { match: { type: "string", ui: "password" }, component: "input", settings: { type: "password" } },
  {
    match: { type: "string", ui: "otp" },
    component: "input",
    settings: { type: "text", inputmode: "numeric", autocomplete: "one-time-code" },
  },
  { match: { type: "string", ui: "tel" }, component: "input", settings: { type: "tel" } },
  { match: { type: "string", format: "email" }, component: "input", settings: { type: "email" } },
  { match: { type: "string", format: "url" }, component: "input", settings: { type: "url" } },
  // A long string (big max) reads better as a textarea -- a constraint-bucket match.
  { match: { type: "string", maxLength: { gte: 256 } }, component: "textarea" },

  // --- number specializations ---
  // A bounded number (both min and max) becomes a slider -- a constraint-bucket match.
  { match: { type: "number", bounded: true }, component: "input", settings: { type: "range" } },

  // --- the six scalar type-only catch-alls (the leaf floor) ---
  { match: { type: "string" }, component: "input", settings: { type: "text" } },
  { match: { type: "number" }, component: "input", settings: { type: "number" } },
  { match: { type: "boolean" }, component: "checkbox" },
  { match: { type: "date" }, component: "input", settings: { type: "date" } },
  { match: { type: "enum" }, component: "enum", settings: { values: "$values" } },
  {
    match: { type: "literal" },
    component: "input",
    settings: { type: "hidden", value: "$values" },
  },
];
