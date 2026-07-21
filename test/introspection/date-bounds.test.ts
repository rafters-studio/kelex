import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import { compositeTarget } from "../../src/targets";
import { writeSchema } from "../../src/schema-writer/writer";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "testSchema" };
const constraintsOf = (s: Parameters<typeof introspect>[0]) =>
  introspect(s, OPTIONS).fields[0].constraints;

const lo = new Date("2020-01-01");
const hi = new Date("2021-06-15");

describe("date bounds (#182)", () => {
  // H5: a date bound was assigned to constraints.min (typed number).
  it("carries a date bound in minDate/maxDate as ISO strings", () => {
    const c = constraintsOf(z.object({ a: z.date().min(lo).max(hi) }));
    expect(c.minDate).toBe(lo.toISOString());
    expect(c.maxDate).toBe(hi.toISOString());
  });

  it("keeps numeric min/max strictly numeric (never a Date)", () => {
    const c = constraintsOf(z.object({ a: z.date().min(lo) }));
    expect(c.min).toBeUndefined();
    expect(typeof c.minDate).toBe("string");
  });

  it("does not put a non-number in a numeric constraint in the composite artifact", () => {
    const descriptor = introspect(z.object({ a: z.date().min(lo).max(hi) }), OPTIONS);
    const parsed = JSON.parse(compositeTarget.generate(descriptor, {}).files[0].content);
    expect(parsed.fields[0].constraints.min).toBeUndefined();
    expect(parsed.fields[0].constraints.max).toBeUndefined();
    expect(parsed.fields[0].constraints.minDate).toBe(lo.toISOString());
  });

  // Numeric bounds are unaffected.
  it("leaves numeric bounds unchanged", () => {
    const c = constraintsOf(z.object({ a: z.number().min(5).max(10) }));
    expect(c.min).toBe(5);
    expect(c.max).toBe(10);
    expect(c.minDate).toBeUndefined();
  });

  it("round-trips a bounded date", () => {
    const before = introspect(z.object({ a: z.date().min(lo).max(hi) }), OPTIONS);
    const after = introspect(evaluateSchemaCode(writeSchema({ form: before }).code), OPTIONS);
    expect(after.fields).toEqual(before.fields);
  });

  it("re-emits a date whose bounds still validate", () => {
    const before = introspect(z.object({ a: z.date().min(lo) }), OPTIONS);
    const schema = evaluateSchemaCode(writeSchema({ form: before }).code) as z.ZodObject;
    expect(() => schema.shape.a.parse(new Date("2019-01-01"))).toThrow();
    expect(schema.shape.a.parse(new Date("2020-06-01"))).toBeInstanceOf(Date);
  });

  it("a plain z.date() with no bounds carries neither", () => {
    const c = constraintsOf(z.object({ a: z.date() }));
    expect(c.minDate).toBeUndefined();
    expect(c.maxDate).toBeUndefined();
  });
});
