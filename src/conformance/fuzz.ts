import { z } from "zod/v4";
import type { $ZodType } from "zod/v4/core";
import type { FieldType } from "../introspection/types";

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

// Each generator is tagged with the FieldType it produces, so a `types` scope can
// keep only the allowed ones (e.g. leaves only for a leaf-renderer baseline).
const LEAVES: { type: FieldType; make: () => $ZodType }[] = [
  { type: "string", make: () => z.string() as unknown as $ZodType },
  { type: "string", make: () => z.email() as unknown as $ZodType },
  { type: "number", make: () => z.number() as unknown as $ZodType },
  { type: "boolean", make: () => z.boolean() as unknown as $ZodType },
  { type: "enum", make: () => z.enum(["a", "b", "c"]) as unknown as $ZodType },
  { type: "date", make: () => z.date() as unknown as $ZodType },
  { type: "literal", make: () => z.literal("x") as unknown as $ZodType },
];

const pick = <A>(rng: () => number, xs: A[]): A => xs[Math.floor(rng() * xs.length)];

/**
 * Build one random schema. `allowed` restricts BOTH the leaves and the container
 * shapes it may emit; when no container is allowed (a leaf-only scope) it always
 * returns a leaf, so a scoped run never produces a shape the renderer disowns.
 */
function build(rng: () => number, depth: number, allowed: Set<FieldType>): $ZodType {
  const leaves = LEAVES.filter((l) => allowed.has(l.type));
  const makeLeaf = () => pick(rng, leaves.length > 0 ? leaves : LEAVES).make();
  const child = () => build(rng, depth - 1, allowed);
  const containers: (() => $ZodType)[] = [];
  if (depth > 0 && allowed.has("object")) {
    containers.push(() => {
      const n = 2 + Math.floor(rng() * 2);
      const shape: Record<string, $ZodType> = {};
      for (let i = 0; i < n; i++) {
        const f = child();
        shape[`f${i}`] = (rng() < 0.25 ? z.optional(f as never) : f) as unknown as $ZodType;
      }
      return z.object(shape as never) as unknown as $ZodType;
    });
  }
  if (depth > 0 && allowed.has("array"))
    containers.push(() => z.array(child() as never) as unknown as $ZodType);
  if (depth > 0 && allowed.has("record"))
    containers.push(() => z.record(z.string(), child() as never) as unknown as $ZodType);
  if (depth > 0 && allowed.has("tuple"))
    containers.push(() => z.tuple([child(), child()] as never) as unknown as $ZodType);
  if (depth > 0 && allowed.has("union"))
    containers.push(() => z.union([child(), child()] as never) as unknown as $ZodType);
  // Bias toward leaves so trees stay shallow; half the picks are a plain leaf.
  const choices: (() => $ZodType)[] = [makeLeaf, ...containers];
  return pick(rng, choices)();
}

const ALL: FieldType[] = [
  "string",
  "number",
  "boolean",
  "enum",
  "date",
  "literal",
  "object",
  "array",
  "record",
  "tuple",
  "union",
];

/** A stream of `count` random top-level object schemas from `seed`, scoped to `types`. */
export function fuzzSchemas(
  seed: number,
  count: number,
  types?: readonly FieldType[],
): { name: string; schema: $ZodType }[] {
  const rng = mulberry32(seed);
  const allowed = new Set<FieldType>(types ?? ALL);
  const out: { name: string; schema: $ZodType }[] = [];
  for (let i = 0; i < count; i++) {
    const n = 1 + Math.floor(rng() * 3);
    const shape: Record<string, $ZodType> = {};
    for (let j = 0; j < n; j++) shape[`f${j}`] = build(rng, 3, allowed);
    out.push({
      name: `fuzz#${i}(seed=${seed})`,
      schema: z.object(shape as never) as unknown as $ZodType,
    });
  }
  return out;
}
