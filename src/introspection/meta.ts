import { globalRegistry } from "zod/v4/core";
import type { $ZodType } from "zod/v4/core";

/**
 * Returns the schema one level in, for the wrapper kinds the reader traverses
 * (`unwrapSchema` peels optional/nullable/default, `peelPipe` peels pipe).
 * Returns undefined at the first non-wrapper.
 */
function innerSchema(schema: $ZodType): $ZodType | undefined {
  const def = schema._zod.def as {
    type: string;
    innerType?: $ZodType;
    in?: $ZodType;
  };

  if (def.type === "pipe") {
    return def.in;
  }
  if (def.type === "optional" || def.type === "nullable" || def.type === "default") {
    return def.innerType;
  }
  return undefined;
}

/**
 * Collects the `.meta()`/`.describe()` payload for a field.
 *
 * Zod 4 stores meta in `globalRegistry` keyed by the schema INSTANCE, not in
 * `_zod.def`, and each wrapper is a distinct instance. So `z.string().meta(m)`
 * registers against the string while `z.string().optional().meta(m)` registers
 * against the optional wrapper -- reading either level alone misses the other.
 * This walks the whole wrapper chain and merges, outermost winning per key,
 * since the outermost call is the last one the author wrote.
 *
 * Returns the payload verbatim (arbitrary keys included, not just title and
 * description) so the descriptor stays lossless and the schema-writer can
 * re-emit the original `.meta()` call.
 */
export function collectMeta(schema: $ZodType): Record<string, unknown> | undefined {
  const layers: Record<string, unknown>[] = [];

  let current: $ZodType | undefined = schema;
  while (current) {
    const entry: unknown = globalRegistry.get(current);
    if (entry && typeof entry === "object") {
      layers.push(entry as Record<string, unknown>);
    }
    current = innerSchema(current);
  }

  if (layers.length === 0) {
    return undefined;
  }

  // layers runs outer -> inner; assign innermost first so the outermost wins.
  const merged: Record<string, unknown> = {};
  for (let i = layers.length - 1; i >= 0; i--) {
    Object.assign(merged, layers[i]);
  }
  return merged;
}

/** Reads a string-valued meta key, ignoring non-string payloads. */
export function metaString(
  meta: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = meta?.[key];
  return typeof value === "string" ? value : undefined;
}
