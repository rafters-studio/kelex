import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import type { FieldDescriptor } from "../../src/introspection/types";
import { writeSchema } from "../../src/schema-writer/writer";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "testSchema" };
const field = (s: Parameters<typeof introspect>[0]): FieldDescriptor =>
  introspect(s, OPTIONS).fields[0];

describe("z.readonly() (#190)", () => {
  // M6: z.number().readonly() degraded to type "string".
  it("keeps the inner number type and constraints", () => {
    const f = field(z.object({ a: z.number().min(1).max(9).readonly() }));
    expect(f.type).toBe("number");
    expect(f.constraints).toMatchObject({ min: 1, max: 9 });
  });

  it("keeps a string's constraints through readonly", () => {
    const f = field(z.object({ a: z.string().min(3).readonly() }));
    expect(f.type).toBe("string");
    expect(f.constraints.minLength).toBe(3);
  });

  it("does not emit an unsupported-type warning for readonly", () => {
    const d = introspect(z.object({ a: z.number().readonly() }), OPTIONS);
    expect(d.warnings.some((w) => w.message.includes("unsupported type"))).toBe(false);
  });

  // Composes with the other wrappers in any order (the #149 class).
  it("composes with optional and nullable", () => {
    const f = field(z.object({ a: z.string().min(1).readonly().optional() }));
    expect(f.type).toBe("string");
    expect(f.isOptional).toBe(true);
    expect(f.constraints.minLength).toBe(1);
  });

  it("composes when readonly is the inner wrapper", () => {
    const f = field(z.object({ a: z.string().optional().readonly() }));
    expect(f.type).toBe("string");
    expect(f.isOptional).toBe(true);
  });

  // Meta survives a readonly wrapper (readonly joined FLAG_WRAPPERS).
  it("finds meta through a readonly wrapper", () => {
    expect(field(z.object({ a: z.string().meta({ title: "Alpha" }).readonly() })).label).toBe(
      "Alpha",
    );
  });

  it("round-trips a readonly field's type and constraints", () => {
    const before = introspect(z.object({ a: z.number().int().min(0).readonly() }), OPTIONS);
    const after = introspect(evaluateSchemaCode(writeSchema({ form: before }).code), OPTIONS);
    expect(after.fields[0].type).toBe("number");
    expect(after.fields[0].constraints).toMatchObject({ isInt: true, min: 0 });
  });
});
