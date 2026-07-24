import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import { writeSchema } from "../../src/schema-writer/writer";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "testSchema" };
const constraintsOf = (s: Parameters<typeof introspect>[0]) =>
  introspect(s, OPTIONS).fields[0].constraints;
const versionOf = (s: Parameters<typeof introspect>[0]) => introspect(s, OPTIONS).version;

describe("regex flags (#179)", () => {
  // M4: flags were dropped, flipping case-sensitivity on round-trip.
  it("captures the i flag", () => {
    expect(constraintsOf(z.object({ a: z.string().regex(/abc/i) })).patternFlags).toBe("i");
  });

  it("captures multiple flags", () => {
    expect(constraintsOf(z.object({ a: z.string().regex(/abc/gm) })).patternFlags).toBe("gm");
  });

  it("carries no patternFlags for a flagless pattern", () => {
    expect(constraintsOf(z.object({ a: z.string().regex(/abc/) })).patternFlags).toBeUndefined();
  });

  it("re-emits the flags and round-trips", () => {
    const before = introspect(z.object({ a: z.string().regex(/abc/i) }), OPTIONS);
    expect(writeSchema({ form: before }).code).toContain("/abc/i");
    const after = introspect(evaluateSchemaCode(writeSchema({ form: before }).code), OPTIONS);
    expect(after.fields).toEqual(before.fields);
  });

  // Flags change what validates, so a flag change must move the version.
  it("moves the version when the flags change", () => {
    expect(versionOf(z.object({ a: z.string().regex(/abc/i) }))).not.toBe(
      versionOf(z.object({ a: z.string().regex(/abc/) })),
    );
  });

  // The re-emitted case-insensitive pattern actually accepts what the original did.
  it("re-emits a pattern that still accepts the same inputs", () => {
    const before = introspect(z.object({ a: z.string().regex(/abc/i) }), OPTIONS);
    const schema = evaluateSchemaCode(writeSchema({ form: before }).code) as z.ZodObject;
    expect(schema.shape.a.parse("ABC")).toBe("ABC");
  });
});
