import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection/introspect";
import type { FieldDescriptor } from "../../src/introspection/types";
import { architectureObject, architectureSchema } from "../fixtures/architecture-fixture";

const OPTIONS = {
  formName: "ArchitectureForm",
  schemaImportPath: "./architecture-fixture",
  schemaExportName: "architectureObject",
};

/** Introspect the shared fixture and index its top-level fields by name. */
function fixtureFields(): Record<string, FieldDescriptor> {
  const descriptor = introspect(architectureObject, OPTIONS);
  return Object.fromEntries(descriptor.fields.map((field) => [field.name, field]));
}

describe("lossless reader (#141)", () => {
  // Criterion 1: z.default() value is captured, not discarded during unwrap.
  it("captures the default value from z.default()", () => {
    const fields = fixtureFields();
    expect(fields.priority.defaultValue).toBe("med");
  });

  // Criterion 2 (conservation): .positive() and .nonnegative() must NOT collapse
  // to the same descriptor -- exclusivity is the distinguishing information.
  it("distinguishes positive (exclusive) from nonnegative (inclusive)", () => {
    const fields = fixtureFields();
    expect(fields.score.constraints).toEqual({ min: 0, minExclusive: true });
    expect(fields.floor.constraints).toEqual({ min: 0 });
    expect(fields.score.constraints).not.toEqual(fields.floor.constraints);
  });

  // Criterion 3: z.string().length(n) (a length_equals check) is captured.
  it("captures exact length from z.string().length(n)", () => {
    const fields = fixtureFields();
    expect(fields.code.constraints.length).toBe(6);
  });

  // Criterion 4: gt/gte inclusivity is read from the check's `inclusive` flag.
  it("captures gt/gte inclusivity distinctly", () => {
    const descriptor = introspect(
      z.object({ excl: z.number().gt(5), incl: z.number().gte(5) }),
      OPTIONS,
    );
    const fields = Object.fromEntries(descriptor.fields.map((f) => [f.name, f]));
    expect(fields.excl.constraints).toEqual({ min: 5, minExclusive: true });
    expect(fields.incl.constraints).toEqual({ min: 5 });
  });

  // Criterion 5 (conservation): a cross-field .refine() the reader cannot
  // represent must produce a non-empty warning that names the affected field.
  it("emits a warning naming the field for a dropped .refine()", () => {
    const descriptor = introspect(architectureSchema, OPTIONS);
    expect(descriptor.warnings.length).toBeGreaterThan(0);
    expect(descriptor.warnings.some((w) => w.includes("score"))).toBe(true);
  });

  // Criterion 6: z.string().startsWith()/.endsWith() are captured, not dropped.
  it("captures startsWith and endsWith prefixes/suffixes", () => {
    const descriptor = introspect(
      z.object({ sku: z.string().startsWith("AB").endsWith("Z") }),
      OPTIONS,
    );
    expect(descriptor.fields[0].constraints.startsWith).toBe("AB");
    expect(descriptor.fields[0].constraints.endsWith).toBe("Z");
  });

  // Criterion 7a: literal fields carry a legal { kind: "literal"; value } metadata
  // variant instead of an out-of-union unchecked cast.
  it("carries literal values as a legal literal metadata variant", () => {
    const fields = fixtureFields();
    const payment = fields.payment.metadata;
    if (payment.kind !== "union") {
      throw new Error("expected discriminated union metadata");
    }
    const cardKind = payment.variants[0].fields.find((f) => f.name === "kind");
    expect(cardKind?.metadata).toEqual({ kind: "literal", value: "card" });
  });

  // Criterion 7b: pipe/transform peels to ONE inner schema so pre-pipe
  // constraints (min(3)) survive rather than being read off the empty wrapper.
  it("preserves pre-pipe constraints through a transform", () => {
    const descriptor = introspect(
      z.object({
        slug: z
          .string()
          .min(3)
          .transform((s) => s.length),
      }),
      OPTIONS,
    );
    expect(descriptor.fields[0].type).toBe("string");
    expect(descriptor.fields[0].constraints.minLength).toBe(3);
  });

  // Criterion 8: reader corners -- a non-string record key and an overlapping
  // intersection key are named rather than silently dropped.
  it("warns on a dropped record key schema and an ambiguous intersection key", () => {
    const record = introspect(
      z.object({ dict: z.record(z.enum(["a", "b"]), z.number()) }),
      OPTIONS,
    );
    expect(record.warnings.some((w) => w.includes("Record key"))).toBe(true);

    const intersection = introspect(
      z.intersection(z.object({ a: z.string() }), z.object({ a: z.number() })),
      OPTIONS,
    );
    expect(intersection.warnings.some((w) => w.includes("Intersection field"))).toBe(true);
  });
});
