import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import type { FieldDescriptor } from "../../src/introspection/types";

const OPTIONS = {
  formName: "DropForm",
  schemaImportPath: "./drop-fixture",
  schemaExportName: "dropSchema",
};

function fieldsOf(descriptor: { fields: FieldDescriptor[] }): Record<string, FieldDescriptor> {
  return Object.fromEntries(descriptor.fields.map((field) => [field.name, field]));
}

describe("remaining silent drops (#149)", () => {
  describe("refine on an intersection", () => {
    const left = z.object({ x: z.string() });
    const right = z.object({ y: z.number() });

    // Criterion 1: the intersection's OWN refine. resolveRootSchema replaces the
    // intersection with a synthetic object holding only the merged shape, so the
    // checks array was not on the schema the warning scan inspected.
    it("warns about a refine attached directly to the intersection", () => {
      const descriptor = introspect(
        z.intersection(left, right).refine((v) => v.x.length > 0, { message: "nonempty" }),
        OPTIONS,
      );
      expect(descriptor.warnings.some((w) => w.includes(".refine()"))).toBe(true);
    });

    // Criterion 2: a refine on a MEMBER. Only the member's shape survives the
    // merge, so its checks drop with the wrapper.
    it("warns about a refine attached to an intersection member", () => {
      const descriptor = introspect(
        z.intersection(
          left.refine((v) => v.x !== "", { message: "member rule" }),
          right,
        ),
        OPTIONS,
      );
      expect(descriptor.warnings.some((w) => w.includes(".refine()"))).toBe(true);
    });

    // Criterion 3: the merge itself still works -- warning must not cost fields.
    it("still merges the intersection shape while warning", () => {
      const descriptor = introspect(
        z.intersection(left, right).refine(() => true),
        OPTIONS,
      );
      expect(descriptor.fields.map((f) => f.name)).toEqual(["x", "y"]);
    });

    // Criterion 4: no refine means no spurious warning.
    it("does not warn on a plain intersection", () => {
      const descriptor = introspect(z.intersection(left, right), OPTIONS);
      expect(descriptor.warnings).toEqual([]);
    });

    // #153: an intersection nested inside another intersection. The inner node
    // is discarded once its members merge, so scanning only the root and the
    // object leaves missed every refine attached at an intermediate level.
    it("warns about a refine on a nested intersection", () => {
      const extra = z.object({ z: z.boolean() });
      const descriptor = introspect(
        z.intersection(
          z.intersection(left, right).refine((v) => v.x !== "", { message: "inner rule" }),
          extra,
        ),
        OPTIONS,
      );
      expect(descriptor.warnings.some((w) => w.includes(".refine()"))).toBe(true);
      expect(descriptor.fields.map((f) => f.name)).toEqual(["x", "y", "z"]);
    });

    it("warns at every level of a deeply nested intersection", () => {
      const extra = z.object({ z: z.boolean() });
      const deeper = z.object({ w: z.string() });
      const descriptor = introspect(
        z
          .intersection(
            z
              .intersection(
                z.intersection(left, right).refine(() => true, { message: "depth 3" }),
                extra,
              )
              .refine(() => true, { message: "depth 2" }),
            deeper,
          )
          .refine(() => true, { message: "depth 1" }),
        OPTIONS,
      );
      const refineWarnings = descriptor.warnings.filter((w) => w.includes(".refine()"));
      expect(refineWarnings).toHaveLength(3);
    });

    // Criterion 3: the root and object-member cases #149 already covered must
    // still warn exactly once, not twice now that intersection nodes are scanned.
    it("does not double-warn a refine on the root intersection", () => {
      const descriptor = introspect(
        z.intersection(left, right).refine(() => true, { message: "root rule" }),
        OPTIONS,
      );
      expect(descriptor.warnings.filter((w) => w.includes(".refine()"))).toHaveLength(1);
    });

    it("does not double-warn a refine on an object member", () => {
      const descriptor = introspect(
        z.intersection(
          left.refine(() => true, { message: "member rule" }),
          right,
        ),
        OPTIONS,
      );
      expect(descriptor.warnings.filter((w) => w.includes(".refine()"))).toHaveLength(1);
    });

    // A non-intersection root still warns, since resolveRootSchema now owns
    // that scan for both shapes.
    it("still warns on a refine on a plain object root", () => {
      const descriptor = introspect(
        z.object({ a: z.string(), b: z.string() }).refine(() => true, { message: "obj rule" }),
        OPTIONS,
      );
      expect(descriptor.warnings.filter((w) => w.includes(".refine()"))).toHaveLength(1);
    });
  });

  describe("wrapper immediately before transform", () => {
    // Criterion 5: the wrapper sits INSIDE the pipe, so unwrap-then-peel left it
    // as the resolved type -- the field read as an unsupported "optional" type,
    // lost its constraints, and reported isOptional false.
    it("resolves optional before transform without losing constraints", () => {
      const descriptor = introspect(
        z.object({
          value: z
            .string()
            .min(3)
            .optional()
            .transform((s) => s?.length),
        }),
        OPTIONS,
      );
      const field = fieldsOf(descriptor).value;
      expect(field.type).toBe("string");
      expect(field.isOptional).toBe(true);
      expect(field.constraints.minLength).toBe(3);
      expect(descriptor.warnings.some((w) => w.includes(".transform()"))).toBe(true);
    });

    it("resolves nullable before transform", () => {
      const descriptor = introspect(
        z.object({
          value: z
            .string()
            .max(9)
            .nullable()
            .transform((s) => s ?? ""),
        }),
        OPTIONS,
      );
      const field = fieldsOf(descriptor).value;
      expect(field.type).toBe("string");
      expect(field.isNullable).toBe(true);
      expect(field.constraints.maxLength).toBe(9);
      expect(descriptor.warnings.some((w) => w.includes(".transform()"))).toBe(true);
    });

    it("resolves default before transform and keeps the default value", () => {
      const descriptor = introspect(
        z.object({
          value: z
            .string()
            .min(2)
            .default("ab")
            .transform((s) => s.length),
        }),
        OPTIONS,
      );
      const field = fieldsOf(descriptor).value;
      expect(field.type).toBe("string");
      expect(field.defaultValue).toBe("ab");
      expect(field.constraints.minLength).toBe(2);
      expect(descriptor.warnings.some((w) => w.includes(".transform()"))).toBe(true);
    });

    // Criterion 6: stacked wrappers on both sides of the pipe.
    it("resolves wrappers stacked around a transform", () => {
      const descriptor = introspect(
        z.object({
          value: z
            .string()
            .min(1)
            .nullable()
            .optional()
            .transform((s) => s ?? "")
            .optional(),
        }),
        OPTIONS,
      );
      const field = fieldsOf(descriptor).value;
      expect(field.type).toBe("string");
      expect(field.isOptional).toBe(true);
      expect(field.isNullable).toBe(true);
      expect(field.constraints.minLength).toBe(1);
    });

    // Criterion 7: the pre-existing transform path still behaves.
    it("keeps resolving a transform with no wrapper in between", () => {
      const descriptor = introspect(
        z.object({
          value: z
            .string()
            .min(3)
            .transform((s) => s.length),
        }),
        OPTIONS,
      );
      const field = fieldsOf(descriptor).value;
      expect(field.type).toBe("string");
      expect(field.constraints.minLength).toBe(3);
      expect(field.isOptional).toBe(false);
    });
  });
});
