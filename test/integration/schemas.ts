import { z } from "zod/v4";

/**
 * Five schemas on a deliberate complexity ladder, each rung adding a class of
 * construct the one below does not exercise. They drive the end-to-end
 * integration suite (`stack.test.ts`), which runs the real wired stack --
 * `generate()` -> introspect -> descriptor -> composite target -- and the
 * schema-writer round trip.
 *
 * The top rung is not just "bigger". It deliberately packs the constructs fixed
 * across the 2026-07-20 session -- `.catch()`, a nested-intersection refine, a
 * wrapper-before-transform, `.meta()` at depth, records, a discriminated union
 * inside an array -- so a regression in any of those PRs fails here, exercised
 * through the public entry point rather than a unit corner.
 */

/** Rung 1 -- flat scalars only. The floor: no constraints, no nesting, no warnings. */
export const rung1Contact = z.object({
  name: z.string(),
  age: z.number(),
  subscribed: z.boolean(),
  joined: z.date(),
});

/** Rung 2 -- adds constraints: bounds (inclusive and exclusive), length, formats, defaults. */
export const rung2Account = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  website: z.string().url().optional(),
  age: z.number().int().gte(18).lt(120),
  score: z.number().positive(),
  balance: z.number().nonnegative().default(0),
  role: z.enum(["admin", "member", "guest"]).default("member"),
  referralCode: z.string().length(8).nullable(),
  handle: z.string().startsWith("@"),
});

/** Rung 3 -- adds one level of nesting, scalar arrays, and `.meta()` labels/descriptions. */
export const rung3Profile = z.object({
  displayName: z.string().meta({ title: "Display name", description: "Shown on your profile" }),
  bio: z.string().max(280).describe("A short bio"),
  address: z.object({
    street: z.string(),
    city: z.string(),
    postalCode: z.string().length(5),
  }),
  tags: z.array(z.string().min(1)).max(10),
  interests: z.array(z.enum(["sports", "music", "tech", "art"])),
  contactMethod: z.enum(["email", "phone", "none"]).default("email"),
});

/** Rung 4 -- adds composite shapes: object arrays, tuples, records, a discriminated union. */
export const rung4Order = z.object({
  orderId: z.string().meta({ title: "Order ID" }),
  customer: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  items: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
    }),
  ),
  coordinates: z.tuple([z.number(), z.number()]),
  metadata: z.record(z.string(), z.string()),
  payment: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("card"), last4: z.string().length(4) }),
    z.object({ kind: z.literal("bank"), routing: z.string().length(9) }),
    z.object({ kind: z.literal("cash") }),
  ]),
  status: z.enum(["pending", "shipped", "delivered"]).default("pending"),
});

/**
 * Rung 5 -- very complex, and the session regression guard. Its TOP LEVEL is a
 * nested intersection, because that is the only place kelex processes an
 * intersection's `.refine()` (they are flattened at the root; an
 * intersection-typed *field* degrades to a string, which is a separate
 * limitation). Every construct fixed on 2026-07-20 appears here:
 *
 * - a `.refine()` on a NESTED intersection (#153) -- the inner refine
 * - a root `.refine()` carrying a message (#156) -- the outer refine
 * - `.catch()` at depth, inside an array element, and combined with `.optional()` (#154)
 * - a wrapper before `.transform()` (#149)
 * - `.meta()` at depth, inside an array element (#147)
 * - records and a discriminated-union-inside-an-array, path-qualified (#158)
 *
 * Shape: a base entity intersected with an audit mixin (inner, refined) and then
 * with an extension block (outer, refined). Member keys are disjoint so the only
 * refine warnings come from the two intersections, not from key overlap.
 */
const entityBlock = z.object({
  accountId: z.string().meta({ title: "Account ID", description: "Immutable identifier" }),

  // Discriminated union INSIDE an array, each variant with a caught field.
  contacts: z.array(
    z.discriminatedUnion("channel", [
      z.object({
        channel: z.literal("email"),
        address: z.string().email(),
        verified: z.boolean().catch(false),
      }),
      z.object({
        channel: z.literal("phone"),
        number: z.string().min(7),
        extension: z.string().optional(),
      }),
    ]),
  ),

  // Wrapper before transform (#149): the .optional() sits inside the pipe;
  // constraints and optionality must still resolve.
  slug: z
    .string()
    .min(3)
    .max(64)
    .optional()
    .transform((s) => s?.toLowerCase()),

  // .catch() combined with .optional() on a constrained number (#154).
  priority: z.number().int().min(1).max(5).catch(3).optional(),

  // Records at depth, value carrying its own constraints and meta.
  limits: z.record(z.string(), z.number().int().nonnegative().meta({ title: "Limit value" })),

  // Deeply nested object with a caught enum three levels down.
  settings: z.object({
    display: z.object({
      theme: z.enum(["light", "dark", "system"]).catch("system"),
      density: z.enum(["comfortable", "compact"]).default("comfortable"),
    }),
  }),

  tags: z.array(z.string().min(1).meta({ title: "Tag" })).max(20),
});

const auditMixin = z.object({
  createdBy: z.string(),
  revision: z.number().int().nonnegative(),
});

const extensionBlock = z.object({
  displayName: z.string().meta({ title: "Display name" }),
  region: z.enum(["us", "eu", "apac"]).catch("us"),
});

export const rung5Enterprise = z
  .intersection(
    // Inner intersection carrying its own refine (#153): this must surface as a
    // warning, not vanish when the members are merged.
    z
      .intersection(entityBlock, auditMixin)
      .refine((v) => v.revision >= 0, { message: "revision must be non-negative" }),
    extensionBlock,
  )
  // Root refine with a constant message (#156).
  .refine((v) => v.tags.length > 0, { message: "an account must have at least one tag" });
