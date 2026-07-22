import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import { writeSchema } from "../../src/schema-writer/writer";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "testSchema" };

// The exact adversarial shape from #188: a REAL object variant whose only field
// is literally named `option_0`, unioned with a genuine scalar member. The old
// name heuristic unwrapped the real object to z.string(), deleting it.
const mixed = z.object({
  x: z.union([z.object({ option_0: z.string() }), z.number()]),
});

describe("synthetic union variants (#188)", () => {
  // AC1 + AC4: the scalar member is explicitly marked; the real object is not.
  it("marks a wrapped scalar member synthetic and leaves a real object unmarked", () => {
    const m = introspect(mixed, OPTIONS).fields[0].metadata;
    if (m.kind !== "union") throw new Error("expected union");
    expect(m.variants[0].fields.map((f) => f.name)).toEqual(["option_0"]);
    expect(m.variants[0].synthetic).toBeUndefined();
    expect(m.variants[1].synthetic).toBe(true);
  });

  // AC2: the writer round-trips the real object instead of deleting it.
  it("round-trips a real object variant with a field named option_0 without deleting it", () => {
    const before = introspect(mixed, OPTIONS);
    const code = writeSchema({ form: before }).code;
    expect(code).toContain("z.object({ option_0: z.string() })");

    const re = evaluateSchemaCode(code) as z.ZodObject;
    expect(re.shape.x.parse({ option_0: "hi" })).toEqual({ option_0: "hi" });
    expect(re.shape.x.parse(42)).toBe(42);
  });

  // AC3 (marker, not name): a genuine scalar member still unwraps to the scalar.
  it("still unwraps a genuine scalar member back to the bare scalar", () => {
    const schema = z.object({ x: z.union([z.string(), z.number()]) });
    const code = writeSchema({ form: introspect(schema, OPTIONS) }).code;
    expect(code).toContain("z.union([z.string(), z.number()])");
  });

  it("re-introspection is idempotent for a mixed object/scalar union", () => {
    const before = introspect(mixed, OPTIONS);
    const after = introspect(evaluateSchemaCode(writeSchema({ form: before }).code), OPTIONS);
    expect(after.fields).toEqual(before.fields);
  });
});
