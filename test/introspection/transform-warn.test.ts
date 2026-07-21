import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const warningsOf = (s: Parameters<typeof introspect>[0]) =>
  introspect(s, OPTIONS).warnings.map((w) => w.message);

describe("transform/pipe output warning (#180)", () => {
  // B1: a .transform() dropped its output side with no warning.
  it("warns that a .transform() output side is not represented", () => {
    const w = warningsOf(z.object({ a: z.string().transform((s) => s.length) }));
    expect(w.some((x) => x.includes(".transform()") && x.includes("output side"))).toBe(true);
  });

  it("warns for an explicit .pipe() with output-side constraints", () => {
    const w = warningsOf(z.object({ a: z.string().pipe(z.string().min(5)) }));
    expect(w.some((x) => x.includes("output side"))).toBe(true);
  });

  // The input side is still read: constraints and type resolve.
  it("still reads the input side's type and constraints", () => {
    const field = introspect(
      z.object({
        a: z
          .string()
          .min(3)
          .transform((s) => s.length),
      }),
      OPTIONS,
    ).fields[0];
    expect(field.type).toBe("string");
    expect(field.constraints.minLength).toBe(3);
  });

  // The warning is path-qualified.
  it("path-qualifies the transform warning", () => {
    const w = warningsOf(
      z.object({ outer: z.object({ inner: z.string().transform((s) => s.trim()) }) }),
    );
    expect(w.some((x) => x.includes('Field "outer.inner"'))).toBe(true);
  });

  // A plain field with no pipe produces no such warning.
  it("does not warn for a field with no transform", () => {
    expect(warningsOf(z.object({ a: z.string().min(2) }))).toEqual([]);
  });

  // A transform inside an array element warns with the element path.
  it("warns for a transform inside an array element", () => {
    const w = warningsOf(z.object({ items: z.array(z.string().transform((s) => s.length)) }));
    expect(w.some((x) => x.includes('Field "items[0]"') && x.includes("output side"))).toBe(true);
  });

  // Exactly one warning per transformed field, not one per pipe layer.
  it("warns once for a single transformed field", () => {
    const w = warningsOf(z.object({ a: z.string().transform((s) => s.length) }));
    expect(w.filter((x) => x.includes("output side"))).toHaveLength(1);
  });
});
