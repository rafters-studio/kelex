import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { render } from "../../src/engine/render";
import type { Renderer } from "../../src/engine/types";
import { introspect } from "../../src/introspection";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const run = (schema: Parameters<typeof introspect>[0], r: Renderer<string>): string =>
  render(introspect(schema, OPTS), r);

// A trivial string renderer -- one composer per shape, keyed by component.
const R: Renderer<string> = {
  inventory: [
    { match: { type: "string" }, component: "text" },
    { match: { type: "number" }, component: "text" },
    { match: { type: "boolean" }, component: "text" },
    { match: { type: "enum" }, component: "text" },
    { match: { type: "date" }, component: "text" },
    { match: { type: "literal" }, component: "text" },
    { match: { type: "object" }, component: "group" },
    { match: { type: "tuple" }, component: "group" },
    { match: { type: "array" }, component: "list" },
    { match: { type: "record" }, component: "list" },
    { match: { type: "union" }, component: "choice" },
    { match: { type: "ref" }, component: "rec" },
  ],
  compose: {
    text: (i) => `<t:${i.key}>`,
    group: (i) =>
      i.shape === "group" ? `<g>${i.children.map((c) => c.rendered).join("")}</g>` : "?",
    list: (i) => (i.shape === "list" ? `<l>${i.item.rendered}</l>` : "?"),
    choice: (i) =>
      i.shape === "choice"
        ? `<ch>${i.variants.map((v) => `[${v.value}:${v.children.map((c) => c.rendered).join("")}]`).join("")}</ch>`
        : "?",
    rec: (i) => `<rec:${i.key}>`,
  },
  form: (top) => `<form>${top.map((c) => c.rendered).join("")}</form>`,
  fallback: (i) => `<fb:${i.field.type}:${i.key}>`,
};

describe("render fold (#222)", () => {
  it("folds all five shapes with name = path", () => {
    const out = run(
      z.object({
        name: z.string(),
        user: z.object({ email: z.string() }),
        tags: z.array(z.object({ label: z.string() })),
      }),
      R,
    );
    expect(out).toBe("<form><t:name><g><t:user.email></g><l><g><t:tags.*.label></g></l></form>");
  });

  it("folds a union as a choice, dropping the discriminator from variant fields", () => {
    const out = run(
      z.object({
        pay: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("card"), num: z.string() }),
          z.object({ kind: z.literal("bank"), acct: z.string() }),
        ]),
      }),
      R,
    );
    expect(out).toBe("<form><ch>[card:<t:pay.num>][bank:<t:pay.acct>]</ch></form>");
    expect(out).not.toContain("pay.kind"); // discriminator is the selector, not a field
  });

  it("folds a ref as a recursive boundary (no infinite recursion)", () => {
    const Cat: z.ZodType = z.lazy(() => z.object({ name: z.string(), kids: z.array(Cat) }));
    const out = run(z.object({ root: Cat }), R);
    expect(out).toBe("<form><g><t:root.name><l><rec:root.kids.*></l></g></form>");
  });

  it("routes an unmatched field to fallback (never dropped)", () => {
    const partial: Renderer<string> = {
      ...R,
      inventory: R.inventory.filter((e) => e.match.type !== "boolean"),
    };
    expect(run(z.object({ ok: z.boolean() }), partial)).toBe("<form><fb:boolean:ok></form>");
  });

  it("is deterministic", () => {
    const s = z.object({ a: z.string(), b: z.array(z.number()) });
    expect(run(s, R)).toBe(run(s, R));
  });
});
