import { z } from "zod/v4";

/**
 * Canonical shared adversarial fixture for the generation architecture.
 *
 * Exercises: nested object + array + discriminated union + default + refine +
 * length + positive/nonnegative. Flat-scalar success is a false green, so every
 * downstream conservation/compile assertion (#141 reader, #142 IR, #143 version,
 * #144 component map, #145 Astro plugin) runs against THIS shape. Import it here
 * rather than redefining it -- one fixture, no drift.
 */
export const architectureObject = z.object({
  title: z.string().min(3).max(80).meta({ title: "Title" }),
  priority: z.enum(["low", "med", "high"]).default("med"),
  score: z.number().positive(),
  floor: z.number().nonnegative(),
  code: z.string().length(6),
  tags: z.array(z.string().min(1)).max(5),
  author: z.object({ name: z.string(), email: z.string().email() }),
  payment: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("card"), last4: z.string().length(4) }),
    z.object({ kind: z.literal("bank"), routing: z.string() }),
  ]),
});

/** The `.refine()`-wrapped form. A cross-field invariant the reader cannot represent -- only name. */
export const architectureSchema = architectureObject.refine((v) => v.score > v.floor, {
  message: "score must exceed floor",
  path: ["score"],
});
