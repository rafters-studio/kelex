import type { FieldType, FormDescriptor } from "../introspection/types";
import { controlPaths } from "./paths";
import { render } from "./render";
import type { Handler, Match, Renderer } from "./types";

/** Every schema node-type the floor must be able to answer. */
const ALL_FIELD_TYPES: readonly FieldType[] = [
  "string",
  "number",
  "boolean",
  "date",
  "enum",
  "literal",
  "object",
  "array",
  "union",
  "tuple",
  "record",
  "ref",
];

/** A match that pins only `type` -- the type-only catch-all the floor requires. */
function isTypeOnly(m: Match): boolean {
  return Object.keys(m).length === 1;
}

/**
 * The floor check: does a renderer cover everything a descriptor can contain?
 * Completeness is the only guarantee kelex can make (nothing dropped) -- and it
 * is precise: a constrained entry (`string` + a length bucket) does NOT prove
 * the bare `string` type is handled, so every `FieldType` needs a TYPE-ONLY
 * catch-all. Also checks every named component resolves to a composer. Returns
 * the gaps (empty when complete).
 */
export function validateRenderer<T>(renderer: Renderer<T>): string[] {
  const gaps: string[] = [];
  for (const type of ALL_FIELD_TYPES) {
    if (!renderer.inventory.some((e) => e.match.type === type && isTypeOnly(e.match))) {
      gaps.push(`no type-only catch-all for FieldType "${type}"`);
    }
  }
  for (const entry of renderer.inventory) {
    if (!renderer.compose[entry.component]) {
      gaps.push(`inventory entry names component "${entry.component}" with no composer`);
    }
  }
  return gaps;
}

/**
 * The engine pipeline: fold the descriptor to a form, then (if a handler is
 * given) wire it. Named `renderForm` so it does not collide with the existing
 * `generate()`/`CodegenTarget` target path, which is left untouched. Rejects an
 * incomplete renderer up front (the floor) rather than dropping a field silently.
 */
export function renderForm<T>(
  descriptor: FormDescriptor,
  renderer: Renderer<T>,
  handler?: Handler<T>,
): T {
  const gaps = validateRenderer(renderer);
  if (gaps.length > 0) {
    throw new Error(`renderer is incomplete:\n  - ${gaps.join("\n  - ")}`);
  }
  const form = render(descriptor, renderer);
  return handler ? handler.wire(form, controlPaths(descriptor), descriptor) : form;
}
