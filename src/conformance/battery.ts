import { z } from "zod/v4";
import type { $ZodType } from "zod/v4/core";

/**
 * One schema in the conformance battery. `bad`, when present, is a value crafted
 * to fail validation with LEAF-path issues only -- so `route` can bind every
 * resulting issue to a control. The handler-join invariant runs only over cases
 * that carry `bad` (see index.ts): generating targeted leaf-path bad data for an
 * arbitrary fuzzed schema is not general, so real `~standard` bad data lives here.
 */
export interface BatteryCase {
  name: string;
  schema: $ZodType;
  bad?: unknown;
}

// z-builder results are cast to the introspection input type; the schemas here
// deliberately span every shape (scalar, group, list, choice, recursive) plus
// optional/nullable wrappers, so the schema-only invariants see the whole space.
const s = (schema: unknown): $ZodType => schema as $ZodType;

type Category = { name: string; children: Category[] };
const category: z.ZodType<Category> = z.lazy(() =>
  z.object({ name: z.string(), children: z.array(category) }),
);

export const battery: BatteryCase[] = [
  { name: "scalars", schema: s(z.object({ a: z.string(), b: z.number(), c: z.boolean() })) },
  {
    name: "string-formats",
    schema: s(z.object({ email: z.email(), site: z.url() })),
    // Both leaves fail their format -> two leaf-path issues (email, site).
    bad: { email: "nope", site: "not a url" },
  },
  {
    name: "nested-object",
    schema: s(z.object({ home: z.object({ zip: z.string().length(5) }) })),
    // A nested leaf constraint -> issue at ["home","zip"].
    bad: { home: { zip: "1" } },
  },
  {
    name: "array-of-objects",
    schema: s(z.object({ tags: z.array(z.object({ label: z.string().min(1) })) })),
    // An array-row leaf -> issue at ["tags",1,"label"], binds the "*" slot.
    bad: { tags: [{ label: "ok" }, { label: "" }] },
  },
  {
    name: "record",
    schema: s(z.object({ prefs: z.record(z.string(), z.string().min(1)) })),
    // A record value under a string key -> issue at ["prefs","theme"], binds "*".
    bad: { prefs: { theme: "" } },
  },
  { name: "tuple", schema: s(z.object({ pair: z.tuple([z.string(), z.number()]) })) },
  { name: "enum", schema: s(z.object({ role: z.enum(["admin", "user"]) })) },
  {
    name: "discriminated-union",
    schema: s(
      z.object({
        shape: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("circle"), radius: z.number() }),
          z.object({ kind: z.literal("rect"), w: z.number(), h: z.number() }),
        ]),
      }),
    ),
  },
  {
    name: "plain-union",
    schema: s(z.object({ id: z.union([z.string(), z.number()]) })),
  },
  {
    // A discriminated union under an array slot: the discriminator control keys
    // off `*` (e.g. `shapes.*.kind`), so path-preservation exercises the choice
    // selector at a template position, not just at the top level.
    name: "array-of-discriminated-union",
    schema: s(
      z.object({
        shapes: z.array(
          z.discriminatedUnion("kind", [
            z.object({ kind: z.literal("circle"), radius: z.number() }),
            z.object({ kind: z.literal("rect"), w: z.number() }),
          ]),
        ),
      }),
    ),
  },
  { name: "recursive", schema: s(z.object({ tree: category })) },
  {
    name: "optional-nullable",
    schema: s(z.object({ note: z.string().optional(), tag: z.string().nullable() })),
  },
];
