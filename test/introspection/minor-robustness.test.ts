import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import { writeSchema } from "../../src/schema-writer/writer";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };

describe("minor robustness (#192)", () => {
  // L3: a non-finite default emitted as .default(null) is silent corruption.
  it("refuses a non-finite default rather than emitting .default(null)", () => {
    for (const bad of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
      const descriptor = introspect(z.object({ a: z.number() }), OPTIONS);
      descriptor.fields[0].defaultValue = bad;
      const { code, warnings } = writeSchema({ form: descriptor });
      expect(code).not.toContain(".default(null)");
      expect(warnings.some((w) => w.includes("not a JSON literal"))).toBe(true);
    }
  });

  it("still emits a finite default", () => {
    const descriptor = introspect(z.object({ a: z.number() }), OPTIONS);
    descriptor.fields[0].defaultValue = 42;
    expect(writeSchema({ form: descriptor }).code).toContain(".default(42)");
  });

  // L6: identical warnings are deduped.
  it("deduplicates identical warnings", () => {
    // Three intersection members all declaring "k" produce the same overlap
    // warning more than once; it must appear once.
    const d = introspect(
      z
        .intersection(z.object({ k: z.string() }), z.object({ k: z.number() }))
        .and(z.object({ k: z.boolean() })),
      OPTIONS,
    );
    const overlaps = d.warnings.filter((w) => w.message.includes("declared in both members"));
    expect(overlaps).toHaveLength(1);
    expect(d.warnings.length).toBe(new Set(d.warnings).size);
  });

  it("does not drop distinct warnings", () => {
    // Two different fields, each with a transform, produce two distinct warnings.
    const d = introspect(
      z.object({
        a: z.string().transform((s) => s.length),
        b: z.number().transform((n) => `${n}`),
      }),
      OPTIONS,
    );
    expect(d.warnings.filter((w) => w.message.includes("output side"))).toHaveLength(2);
  });
});
