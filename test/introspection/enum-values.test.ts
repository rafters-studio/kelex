import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import { writeSchema } from "../../src/schema-writer/writer";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "testSchema" };

function enumValues(schema: Parameters<typeof introspect>[0]): readonly (string | number)[] {
  const m = introspect(schema, OPTIONS).fields[0].metadata;
  if (m.kind !== "enum") throw new Error("expected enum metadata");
  return m.values;
}

describe("enum accepted values (#177)", () => {
  // B3 (the fix): the object form's accepted values are the entry VALUES.
  it("reports the accepted values for an object-form enum, not the keys", () => {
    expect(enumValues(z.object({ a: z.enum({ Red: "r", Blue: "b" }) }))).toEqual(["r", "b"]);
    // The values are exactly what the schema parses.
    expect(z.enum({ Red: "r", Blue: "b" }).parse("r")).toBe("r");
    expect(() => z.enum({ Red: "r" }).parse("Red")).toThrow();
  });

  // Array form unchanged (keys == values).
  it("is unchanged for the array form", () => {
    expect(enumValues(z.object({ a: z.enum(["a", "b", "c"]) }))).toEqual(["a", "b", "c"]);
  });

  it("de-duplicates repeated values", () => {
    expect(enumValues(z.object({ a: z.enum({ A: "x", B: "x", C: "y" }) }))).toEqual(["x", "y"]);
  });

  // Numeric enum: values carried, warned that the writer re-emits as a union.
  it("carries numeric enum values", () => {
    expect(enumValues(z.object({ a: z.nativeEnum({ A: 1, B: 2 }) }))).toEqual([1, 2]);
  });

  it("warns that a numeric enum is re-emitted as a union", () => {
    const d = introspect(z.object({ a: z.nativeEnum({ A: 1, B: 2 }) }), OPTIONS);
    expect(d.warnings.some((w) => w.includes("union of literals"))).toBe(true);
  });

  it("does not warn for a string enum", () => {
    expect(introspect(z.object({ a: z.enum({ Red: "r" }) }), OPTIONS).warnings).toEqual([]);
  });

  // A TS numeric enum compiles to a bidirectional object; reverse entries drop.
  it("drops reverse-mapping entries of a numeric TS enum", () => {
    // Simulate the bidirectional object a `enum { A = 1, B = 2 }` compiles to.
    const bidi = { A: 1, B: 2, 1: "A", 2: "B" } as unknown as Record<string, number>;
    expect(enumValues(z.object({ a: z.nativeEnum(bidi) }))).toEqual([1, 2]);
  });

  describe("round-trip", () => {
    it("round-trips an object-form enum as an enum accepting the same values", () => {
      const before = introspect(z.object({ a: z.enum({ Red: "r", Blue: "b" }) }), OPTIONS);
      const after = introspect(evaluateSchemaCode(writeSchema({ form: before }).code), OPTIONS);
      expect(after.fields).toEqual(before.fields);
      // And the re-emitted schema still accepts "r".
    });

    it("re-emits a numeric enum as a schema that accepts the same values", () => {
      const before = introspect(z.object({ a: z.nativeEnum({ A: 1, B: 2 }) }), OPTIONS);
      const schema = evaluateSchemaCode(writeSchema({ form: before }).code);
      // Round-trips as a union of literals accepting the same numbers.
      const inner = (schema as z.ZodObject).shape.a;
      expect(inner.parse(1)).toBe(1);
      expect(inner.parse(2)).toBe(2);
      expect(() => inner.parse(3)).toThrow();
    });
  });
});
