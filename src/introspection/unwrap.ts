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
  /**
   * Default value from the OUTERMOST z.default(), captured before the wrapper is
   * peeled -- and only when it is verifiably stable (see `readStableDefault`).
   * Undefined when there was no default, or the default was a varying function.
   */
  defaultValue?: unknown;
  /** Whether any z.default() wrapper was present (stable or not). */
  hasDefault: boolean;
  /**
   * Whether a z.default() was present but its value could not be verified stable
   * -- a function default that returns a different value each call. The value is
   * deliberately not recorded; the caller warns instead.
   */
  hasUnstableDefault: boolean;
  /**
   * Whether z.catch() was present. Only the presence is recorded, never the
   * fallback value -- see the note in `unwrapSchema` on why it is not captured.
   */
  hasCatch: boolean;
  /**
   * Whether a pipe/transform was peeled to reach the input side. Set by
   * `resolveInner`, never by `unwrapSchema` (which does not peel pipes). The
   * output side of a transform is not represented, so the caller warns.
   */
  hasPipe: boolean;
}

/**
 * Structural equality, bigint- and Date-aware, that never throws.
 *
 * Used to decide whether a `.default()` is stable enough to record. It must not
 * use `JSON.stringify` (that throws on bigint -- see #176) and must treat two
 * fresh-but-equal objects (`() => []`, `() => ({}))`) as equal so a legitimate
 * mutable default is recorded rather than warned.
 */
function structurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => structurallyEqual(x, b[i]));
  }
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  return (
    ak.length === bk.length &&
    ak.every(
      (k) =>
        k in (b as object) &&
        structurallyEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  );
}

/**
 * Reads a `.default()` value, but only returns it when it is provably stable.
 *
 * Zod 4 exposes `def.defaultValue` as a GETTER that invokes a function default
 * on every access (a static `.default(v)` and `.default(() => v)` are
 * indistinguishable at the def level -- both present as a getter, verified by
 * probe). So the read is done twice and the value is trusted only when the two
 * reads are structurally equal. A varying default (`() => Math.random()`,
 * `() => crypto.randomUUID()`, a counter) differs between reads and is refused,
 * because baking a per-call value in would make the field's descriptor -- and
 * its version hash -- non-deterministic (#143).
 *
 * KNOWN RESIDUAL: a coarse time default (`() => Date.now()`, `() => new Date()`)
 * whose two reads land in the same millisecond reads as stable and is recorded.
 * This is no worse than the prior behavior (which always baked it); it makes
 * only that schema's version non-deterministic run-to-run, and it is documented
 * rather than pinned by a (flaky) test.
 *
 * Reading the getter invokes user code -- twice. This is precedented by the
 * refine-message probe, and a value is only ever recorded from a verified read.
 */
function readStableDefault(def: {
  defaultValue?: unknown;
}): { ok: true; value: unknown } | { ok: false } {
  try {
    const first = def.defaultValue;
    const second = def.defaultValue;
    if (structurallyEqual(first, second)) {
      return { ok: true, value: first };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
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
  let hasDefault = false;
  let hasUnstableDefault = false;
  let defaultValue: unknown;

  while (FLAG_WRAPPERS.has(current._zod.def.type)) {
    const wrapper = current._zod.def.type;
    if (wrapper === "optional") {
      isOptional = true;
    } else if (wrapper === "nullable") {
      isNullable = true;
    } else if (wrapper === "catch") {
      hasCatch = true;
    } else if (!hasDefault) {
      // Default: the FIRST one reached is the OUTERMOST, which is the one Zod
      // applies -- `z.string().default("in").default("out")` yields "out". Only
      // this one is captured; inner defaults it shadows are skipped.
      hasDefault = true;
      const read = readStableDefault(current._zod.def as { defaultValue?: unknown });
      if (read.ok) {
        defaultValue = read.value;
      } else {
        hasUnstableDefault = true;
      }
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
    hasDefault,
    hasUnstableDefault,
    hasCatch,
    // unwrapSchema does not peel pipes; resolveInner sets this.
    hasPipe: false,
  };
}
