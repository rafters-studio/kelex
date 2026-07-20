import type { $ZodType } from "zod/v4/core";

/**
 * Wrapper defs that carry a presence flag or a default and hold their inner
 * schema under `innerType`.
 *
 * Single source of truth: this list is consumed both here (to peel the
 * wrappers) and by the meta walk (to visit every level of the chain). Zod
 * registers meta against the schema INSTANCE, so a level missing from this
 * list is a level whose meta is never read -- the silent-drop class #149 was.
 */
export const FLAG_WRAPPERS: ReadonlySet<string> = new Set([
  "optional",
  "nullable",
  "default",
  "catch",
]);

export interface UnwrapResult {
  /** The innermost non-wrapper schema */
  inner: $ZodType;
  /** Whether z.optional() was present */
  isOptional: boolean;
  /** Whether z.nullable() was present */
  isNullable: boolean;
  /** Default value from z.default(), captured before the wrapper is peeled */
  defaultValue?: unknown;
  /**
   * Whether z.catch() was present. Only the presence is recorded, never the
   * fallback value -- see the note in `unwrapSchema` on why it is not captured.
   */
  hasCatch: boolean;
}

/** Type guard to check if schema has unwrap method */
function hasUnwrap(schema: unknown): schema is { unwrap: () => $ZodType } & $ZodType {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "unwrap" in schema &&
    typeof (schema as Record<string, unknown>).unwrap === "function"
  );
}

/** Validates that the schema is a Zod 4 schema with required properties */
function isValidZod4Schema(schema: unknown): schema is $ZodType {
  if (!schema || typeof schema !== "object") {
    return false;
  }

  const s = schema as Record<string, unknown>;
  if (!("_zod" in s) || !s._zod || typeof s._zod !== "object") {
    return false;
  }

  const zod = s._zod as Record<string, unknown>;
  if (!("def" in zod) || !zod.def || typeof zod.def !== "object") {
    return false;
  }

  const def = zod.def as Record<string, unknown>;
  return "type" in def;
}

/**
 * Unwraps optional/nullable/default/catch wrappers from a Zod schema.
 * Handles: z.optional(), z.nullable(), z.nullish() (optional + nullable),
 * z.default(), z.catch().
 *
 * On z.catch(): the wrapper is peeled so the inner type and its constraints
 * survive, but the fallback value is NOT captured, only its presence. Zod
 * normalizes `.catch(0)` into a THUNK (`def.catchValue` is a function, not a
 * value), so recovering the literal would mean invoking user code during
 * introspection. That is unsafe in a way that matters here: a context-dependent
 * callback such as `ctx => Date.now()` returns a perfectly JSON-safe value that
 * is nonetheless fabricated, and nothing distinguishes it from a literal. A
 * silently-recorded wrong value is worse than an acknowledged absent one, so
 * the caller warns instead.
 */
export function unwrapSchema(schema: $ZodType): UnwrapResult {
  if (!isValidZod4Schema(schema)) {
    throw new Error("Schema is not a valid Zod 4 schema");
  }

  let current = schema;
  let isOptional = false;
  let isNullable = false;
  let hasCatch = false;
  let defaultValue: unknown;

  while (FLAG_WRAPPERS.has(current._zod.def.type)) {
    const wrapper = current._zod.def.type;
    if (wrapper === "optional") {
      isOptional = true;
    } else if (wrapper === "nullable") {
      isNullable = true;
    } else if (wrapper === "catch") {
      hasCatch = true;
    } else {
      // default: capture the value before peeling the wrapper to reach the inner type
      defaultValue = (current._zod.def as { defaultValue?: unknown }).defaultValue;
    }

    if (!hasUnwrap(current)) {
      throw new Error(`${wrapper} schema missing unwrap method`);
    }
    current = current.unwrap();
  }

  return {
    inner: current,
    isOptional,
    isNullable,
    defaultValue,
    hasCatch,
  };
}
