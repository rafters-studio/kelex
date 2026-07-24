import { z } from "zod/v4";
import type { $ZodType } from "zod/v4/core";

/**
 * A seeded schema fuzzer. It fuzzes the INPUT -- the schema space -- never a
 * renderer's components, because kelex cannot know a plugin's components; the
 * only testable surface of an open contract is the schema. Seeded (mulberry32)
 * so a conformance failure reproduces from its seed. Stays within the shapes
 * introspection handles (scalar/object/array/record/union/tuple/enum + optional).
 */

/** A small deterministic PRNG -- same seed, same schema stream. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const leaf = (rng: () => number): $ZodType => {
  const pick = Math.floor(rng() * 5);
  switch (pick) {
    case 0:
      return z.string() as unknown as $ZodType;
    case 1:
      return z.number() as unknown as $ZodType;
    case 2:
      return z.boolean() as unknown as $ZodType;
    case 3:
      return z.email() as unknown as $ZodType;
    default:
      return z.enum(["a", "b", "c"]) as unknown as $ZodType;
  }
};

/** Build one random schema, recursing until `depth` runs out (then a leaf). */
function build(rng: () => number, depth: number): $ZodType {
  if (depth <= 0) return leaf(rng);
  const pick = Math.floor(rng() * 6);
  const child = () => build(rng, depth - 1);
  switch (pick) {
    case 0: {
      const n = 2 + Math.floor(rng() * 2);
      const shape: Record<string, $ZodType> = {};
      for (let i = 0; i < n; i++) {
        const f = child();
        shape[`f${i}`] = (rng() < 0.25 ? z.optional(f as never) : f) as unknown as $ZodType;
      }
      return z.object(shape as never) as unknown as $ZodType;
    }
    case 1:
      return z.array(child() as never) as unknown as $ZodType;
    case 2:
      return z.record(z.string(), child() as never) as unknown as $ZodType;
    case 3:
      return z.tuple([child(), child()] as never) as unknown as $ZodType;
    case 4:
      return z.union([child(), child()] as never) as unknown as $ZodType;
    default:
      return leaf(rng);
  }
}

/** A stream of `count` random top-level object schemas from `seed`. */
export function fuzzSchemas(seed: number, count: number): { name: string; schema: $ZodType }[] {
  const rng = mulberry32(seed);
  const out: { name: string; schema: $ZodType }[] = [];
  for (let i = 0; i < count; i++) {
    const n = 1 + Math.floor(rng() * 3);
    const shape: Record<string, $ZodType> = {};
    for (let j = 0; j < n; j++) shape[`f${j}`] = build(rng, 3);
    out.push({
      name: `fuzz#${i}(seed=${seed})`,
      schema: z.object(shape as never) as unknown as $ZodType,
    });
  }
  return out;
}
