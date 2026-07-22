import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import { writeSchema } from "../../src/schema-writer/writer";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "testSchema" };

function variantValues(schema: Parameters<typeof introspect>[0]) {
  const m = introspect(schema, OPTIONS).fields[0].metadata;
  if (m.kind !== "union") throw new Error("expected union");
  return m.variants.map((v) => v.value);
}

const boolUnion = z.object({
  x: z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), a: z.string() }),
    z.object({ ok: z.literal(false), b: z.number() }),
  ]),
});
const numUnion = z.object({
  x: z.discriminatedUnion("v", [
    z.object({ v: z.literal(1), a: z.string() }),
    z.object({ v: z.literal(2), b: z.number() }),
  ]),
});

describe("discriminator typing (#187)", () => {
  // H6: a boolean/number discriminator was stringified.
  it("carries a boolean discriminator as a boolean", () => {
    expect(variantValues(boolUnion)).toEqual([true, false]);
  });

  it("carries a numeric discriminator as a number", () => {
    expect(variantValues(numUnion)).toEqual([1, 2]);
  });

  it("still carries a string discriminator as a string", () => {
    const strUnion = z.object({
      x: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("card"), n: z.string() }),
        z.object({ kind: z.literal("bank"), r: z.string() }),
      ]),
    });
    expect(variantValues(strUnion)).toEqual(["card", "bank"]);
  });

  // The round-tripped schema still parses data the original accepted.
  it("round-trips a boolean discriminator to a schema that still parses the data", () => {
    const before = introspect(boolUnion, OPTIONS);
    const code = writeSchema({ form: before }).code;
    expect(code).toContain("z.literal(true)");
    const schema = evaluateSchemaCode(code) as z.ZodObject;
    expect(schema.shape.x.parse({ ok: true, a: "hi" })).toEqual({ ok: true, a: "hi" });
    expect(() => schema.shape.x.parse({ ok: "true", a: "hi" })).toThrow();
  });

  it("round-trips a numeric discriminator to a schema that still parses the data", () => {
    const before = introspect(numUnion, OPTIONS);
    const code = writeSchema({ form: before }).code;
    expect(code).toContain("z.literal(1)");
    const schema = evaluateSchemaCode(code) as z.ZodObject;
    expect(schema.shape.x.parse({ v: 1, a: "hi" })).toEqual({ v: 1, a: "hi" });
  });

  it("round-trips a boolean union with an identical field tree", () => {
    const before = introspect(boolUnion, OPTIONS);
    const after = introspect(evaluateSchemaCode(writeSchema({ form: before }).code), OPTIONS);
    expect(after.fields).toEqual(before.fields);
  });
});
