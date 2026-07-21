import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import type { FieldDescriptor } from "../../src/introspection/types";
import { writeSchema } from "../../src/schema-writer/writer";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

const OPTIONS = {
  formName: "IntersectionFieldForm",
  schemaImportPath: "./isect-fixture",
  // The round-trip helper (evaluateSchemaCode) resolves the export named "testSchema".
  schemaExportName: "testSchema",
};

const base = z.object({ street: z.string().min(1), city: z.string() });
const mixin = z.object({ createdBy: z.string(), revision: z.number().int() });

function fieldsOf(schema: Parameters<typeof introspect>[0]): Record<string, FieldDescriptor> {
  return Object.fromEntries(introspect(schema, OPTIONS).fields.map((f) => [f.name, f]));
}

describe("intersection-typed field (#169)", () => {
  // Criterion 1: an intersection field merges to an object, not a string.
  it("introspects an intersection field as a merged object", () => {
    const fields = fieldsOf(z.object({ address: z.intersection(base, mixin) }));
    const address = fields.address;
    expect(address.type).toBe("object");
    if (address.metadata.kind !== "object") {
      throw new Error("expected object metadata");
    }
    expect(address.metadata.fields.map((f) => f.name)).toEqual([
      "street",
      "city",
      "createdBy",
      "revision",
    ]);
  });

  it("preserves the merged fields' own constraints", () => {
    const fields = fieldsOf(z.object({ address: z.intersection(base, mixin) }));
    if (fields.address.metadata.kind !== "object") {
      throw new Error("expected object metadata");
    }
    const byName = Object.fromEntries(fields.address.metadata.fields.map((f) => [f.name, f]));
    expect(byName.street.constraints).toMatchObject({ minLength: 1 });
    expect(byName.revision.constraints).toMatchObject({ isInt: true });
  });

  it("no longer emits an unsupported-type warning for the intersection", () => {
    const descriptor = introspect(z.object({ address: z.intersection(base, mixin) }), OPTIONS);
    expect(descriptor.warnings.some((w) => w.message.includes("unsupported type"))).toBe(false);
  });

  // Criterion 2: a refine on the intersection field warns with the FIELD's path,
  // not as form-level and not vanished.
  it("warns about a refine on the intersection field, named by the field path", () => {
    const descriptor = introspect(
      z.object({
        address: z
          .intersection(base, mixin)
          .refine((v) => v.revision >= 0, { message: "revision must be non-negative" }),
      }),
      OPTIONS,
    );
    const refine = descriptor.warnings.find((w) => w.message.includes(".refine()"));
    expect(refine).toBeDefined();
    expect(refine?.message).toContain('Field "address"');
    expect(refine?.message).toContain("revision must be non-negative");
    // It is a field-level refine, so it must NOT read as form-level.
    expect(refine?.message).not.toContain("Form-level");
  });

  it("warns about a refine on a NESTED intersection field with the field path", () => {
    const descriptor = introspect(
      z.object({
        record: z.intersection(
          z.intersection(base, mixin).refine(() => true, { message: "inner rule" }),
          z.object({ extra: z.string() }),
        ),
      }),
      OPTIONS,
    );
    const refine = descriptor.warnings.find((w) => w.message.includes("inner rule"));
    expect(refine?.message).toContain('Field "record"');
  });

  // Criterion 3: overlapping keys across the field's members warn, path-prefixed.
  it("warns about overlapping keys within the intersection field", () => {
    const descriptor = introspect(
      z.object({
        conflict: z.intersection(z.object({ id: z.string() }), z.object({ id: z.number() })),
      }),
      OPTIONS,
    );
    expect(
      descriptor.warnings.some(
        (w) =>
          w.message.includes("declared in both members") && w.message.includes('"conflict.id"'),
      ),
    ).toBe(true);
  });

  // Criterion 4: non-object members error the same way as at the root.
  it("errors when an intersection field's member is not an object", () => {
    expect(() =>
      introspect(z.object({ bad: z.intersection(z.string(), z.number()) }), OPTIONS),
    ).toThrow(/Intersection members must be objects/);
  });

  // Criterion 5: the intersection field round-trips through the writer.
  it("round-trips an intersection field as a merged object", () => {
    const before = introspect(
      z.object({ address: z.intersection(base, mixin), name: z.string() }),
      OPTIONS,
    );
    const { code } = writeSchema({ form: before });
    const after = introspect(evaluateSchemaCode(code), OPTIONS);
    expect(after.fields).toEqual(before.fields);
  });

  // An intersection field carries its own .meta() label like any other field.
  it("captures .meta() on the intersection field itself", () => {
    const fields = fieldsOf(
      z.object({ address: z.intersection(base, mixin).meta({ title: "Mailing address" }) }),
    );
    expect(fields.address.label).toBe("Mailing address");
  });

  // An intersection field nested inside another object still resolves, and its
  // warnings carry the full path.
  it("resolves an intersection field nested inside another object", () => {
    const descriptor = introspect(
      z.object({
        outer: z.object({
          inner: z.intersection(base, mixin).refine(() => true, { message: "deep rule" }),
        }),
      }),
      OPTIONS,
    );
    const refine = descriptor.warnings.find((w) => w.message.includes("deep rule"));
    expect(refine?.message).toContain('Field "outer.inner"');
  });
});

describe("root intersection is unchanged by #169", () => {
  // The basePath threading defaults to [] at the root, so nothing about the
  // existing root-intersection behavior moves.
  it("still reports a root-intersection refine as form-level", () => {
    const descriptor = introspect(
      z.intersection(base, mixin).refine(() => true, { message: "root rule" }),
      OPTIONS,
    );
    const refine = descriptor.warnings.find((w) => w.message.includes("root rule"));
    expect(refine?.message).toContain("Form-level");
    expect(refine?.message).not.toContain('Field "');
  });

  it("still names a root overlapping key without a path prefix", () => {
    const descriptor = introspect(
      z.intersection(z.object({ id: z.string() }), z.object({ id: z.number() })),
      OPTIONS,
    );
    expect(
      descriptor.warnings.some((w) => w.message.includes('Intersection field "id" is declared')),
    ).toBe(true);
  });
});
