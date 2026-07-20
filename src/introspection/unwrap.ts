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
export const FLAG_WRAPPERS: ReadonlySet<string> = new Set(["optional", "nullable", "default"]);

export interface UnwrapResult {
  /** The innermost non-wrapper schema */
  inner: $ZodType;
  /** Whether z.optional() was present */
  isOptional: boolean;
  /** Whether z.nullable() was present */
  isNullable: boolean;
  /** Default value from z.default(), captured before the wrapper is peeled */
  defaultValue?: unknown;
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
 * Unwraps optional and nullable wrappers from a Zod schema.
 * Handles: z.optional(), z.nullable(), z.nullish() (optional + nullable)
 */
export function unwrapSchema(schema: $ZodType): UnwrapResult {
  if (!isValidZod4Schema(schema)) {
    throw new Error("Schema is not a valid Zod 4 schema");
  }

  let current = schema;
  let isOptional = false;
  let isNullable = false;
  let defaultValue: unknown;

  // Unwrap nested optional/nullable/default wrappers
  while (FLAG_WRAPPERS.has(current._zod.def.type)) {
    if (current._zod.def.type === "optional") {
      isOptional = true;
    } else if (current._zod.def.type === "nullable") {
      isNullable = true;
    } else {
      // default: capture the value before peeling the wrapper to reach the inner type
      defaultValue = (current._zod.def as { defaultValue?: unknown }).defaultValue;
    }

    if (!hasUnwrap(current)) {
      throw new Error(`${current._zod.def.type} schema missing unwrap method`);
    }
    current = current.unwrap();
  }

  return {
    inner: current,
    isOptional,
    isNullable,
    defaultValue,
  };
}
