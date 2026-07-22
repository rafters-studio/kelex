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

describe("implicit discriminator promotion (#212)", () => {
  it("promotes a shared literal field to the discriminator with typed values", () => {
    const m = unionMeta(
      z.object({
        pay: z.union([
          z.object({ kind: z.literal("card"), num: z.string() }),
          z.object({ kind: z.literal("bank"), acct: z.string() }),
        ]),
      }),
    );
    expect(m.discriminator).toBe("kind");
    expect(m.variants.map((v) => v.value)).toEqual(["card", "bank"]);
  });

  it("produces a descriptor identical to the equivalent z.discriminatedUnion", () => {
    const variants = [
      z.object({ kind: z.literal("card"), num: z.string() }),
      z.object({ kind: z.literal("bank"), acct: z.string() }),
    ] as const;
    const plain = introspect(z.object({ pay: z.union(variants) }), OPTS);
    const disc = introspect(z.object({ pay: z.discriminatedUnion("kind", variants) }), OPTS);
    expect(plain.fields).toEqual(disc.fields);
    expect(plain.version).toBe(disc.version);
  });

  it("promotes boolean and numeric literal discriminators with real types", () => {
    expect(
      unionMeta(
        z.object({
          x: z.union([
            z.object({ ok: z.literal(true), a: z.string() }),
            z.object({ ok: z.literal(false), b: z.string() }),
          ]),
        }),
      ).variants.map((v) => v.value),
    ).toEqual([true, false]);

    expect(
      unionMeta(
        z.object({
          x: z.union([
            z.object({ v: z.literal(1), a: z.string() }),
            z.object({ v: z.literal(2), b: z.string() }),
          ]),
        }),
      ).variants.map((v) => v.value),
    ).toEqual([1, 2]);
  });

  it("leaves a union with no shared literal field unpromoted", () => {
    const m = unionMeta(
      z.object({ shape: z.union([z.object({ a: z.string() }), z.object({ b: z.number() })]) }),
    );
    expect(m.discriminator).toBeUndefined();
    expect(m.variants.map((v) => v.value)).toEqual(["variant_0", "variant_1"]);
  });

  it("does not promote a shared field that is not a literal", () => {
    const m = unionMeta(
      z.object({
        x: z.union([
          z.object({ id: z.string(), a: z.string() }),
          z.object({ id: z.string(), b: z.number() }),
        ]),
      }),
    );
    expect(m.discriminator).toBeUndefined();
  });

  it("does not promote a shared literal field whose values collide", () => {
    const m = unionMeta(
      z.object({
        x: z.union([
          z.object({ t: z.literal("same"), a: z.string() }),
          z.object({ t: z.literal("same"), b: z.number() }),
        ]),
      }),
    );
    expect(m.discriminator).toBeUndefined();
  });

  it("warns and promotes nothing when multiple candidate discriminators exist", () => {
    const d = introspect(
      z.object({
        x: z.union([
          z.object({ a: z.literal("p"), b: z.literal(1) }),
          z.object({ a: z.literal("q"), b: z.literal(2) }),
        ]),
      }),
      OPTS,
    );
    const m = d.fields[0].metadata;
    if (m.kind !== "union") throw new Error("expected union");
    expect(m.discriminator).toBeUndefined();
    expect(d.warnings.some((w) => w.code === "discriminator-ambiguous")).toBe(true);
  });
});
