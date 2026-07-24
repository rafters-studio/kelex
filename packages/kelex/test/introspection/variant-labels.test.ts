import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import type { FieldMetadata } from "../../src/introspection/types";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };

function unionMeta(
  schema: Parameters<typeof introspect>[0],
): Extract<FieldMetadata, { kind: "union" }> {
  const m = introspect(schema, OPTS).fields[0].metadata;
  if (m.kind !== "union") throw new Error("expected union metadata");
  return m;
}

describe("union variant labels from .meta() (#213)", () => {
  it("carries a discriminated-union variant's member .meta()", () => {
    const m = unionMeta(
      z.object({
        pay: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("card"), num: z.string() }).meta({ title: "Card" }),
          z.object({ kind: z.literal("bank"), acct: z.string() }).meta({ title: "Bank" }),
        ]),
      }),
    );
    expect(m.variants.map((v) => v.meta?.title)).toEqual(["Card", "Bank"]);
  });

  it("carries a plain (non-discriminated) union variant's member .meta()", () => {
    const m = unionMeta(
      z.object({
        shape: z.union([
          z.object({ a: z.string() }).meta({ title: "A shape" }),
          z.object({ b: z.number() }).meta({ title: "B shape" }),
        ]),
      }),
    );
    expect(m.variants.map((v) => v.meta?.title)).toEqual(["A shape", "B shape"]);
  });

  it("leaves a variant with no meta absent (not an empty object)", () => {
    const m = unionMeta(
      z.object({ shape: z.union([z.object({ a: z.string() }), z.object({ b: z.number() })]) }),
    );
    expect(m.variants.every((v) => v.meta === undefined)).toBe(true);
    expect("meta" in m.variants[0]).toBe(false);
  });

  it("reads meta off a wrapped member (chain-walked, Zod-4 instance-keyed)", () => {
    const m = unionMeta(
      z.object({ x: z.union([z.string().meta({ title: "Text" }).optional(), z.number()]) }),
    );
    expect(m.variants[0].meta?.title).toBe("Text");
  });

  it("a variant label does NOT churn the content version", () => {
    const variants = [
      z.object({ kind: z.literal("card"), num: z.string() }),
      z.object({ kind: z.literal("bank"), acct: z.string() }),
    ] as const;
    const base = introspect(z.object({ pay: z.discriminatedUnion("kind", variants) }), OPTS);
    const labeled = introspect(
      z.object({
        pay: z.discriminatedUnion("kind", [
          variants[0].meta({ title: "Card" }),
          variants[1].meta({ title: "Bank" }),
        ]),
      }),
      OPTS,
    );
    expect(labeled.version).toBe(base.version);
  });
});
