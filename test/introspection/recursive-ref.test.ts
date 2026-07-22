import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import type { FieldMetadata } from "../../src/introspection/types";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };

describe("recursive schema ref nodes (#214)", () => {
  it("unwraps a non-recursive z.lazy transparently, no warning", () => {
    const d = introspect(z.object({ v: z.lazy(() => z.string().min(3)) }), OPTS);
    const f = d.fields[0];
    expect(f.type).toBe("string");
    expect(f.constraints.minLength).toBe(3);
    expect(d.warnings).toEqual([]);
  });

  it("emits a ref at a direct self-reference instead of looping", () => {
    const Category: z.ZodType = z.lazy(() =>
      z.object({ name: z.string(), children: z.array(Category) }),
    );
    const d = introspect(z.object({ root: Category }), OPTS);

    const root = d.fields[0];
    expect(root.type).toBe("object");
    const rootMeta = root.metadata as Extract<FieldMetadata, { kind: "object" }>;
    const children = rootMeta.fields.find((x) => x.name === "children");
    expect(children?.type).toBe("array");
    const arrMeta = children?.metadata as Extract<FieldMetadata, { kind: "array" }>;
    const element = arrMeta.element;

    expect(element.type).toBe("ref");
    const refMeta = element.metadata as Extract<FieldMetadata, { kind: "ref" }>;
    expect(refMeta.kind).toBe("ref");
    // Target is the ancestor where the lazy first appeared: the root field.
    expect(refMeta.target).toEqual(["root"]);
  });

  it("does not warn unsupported-type for a handled recursive ref", () => {
    const Category: z.ZodType = z.lazy(() =>
      z.object({ name: z.string(), children: z.array(Category) }),
    );
    const d = introspect(z.object({ root: Category }), OPTS);
    expect(d.warnings.some((w) => w.code === "unsupported-type")).toBe(false);
  });

  it("terminates on mutual recursion (A -> B -> A) and stays serializable", () => {
    const A: z.ZodType = z.lazy(() => z.object({ b: B.optional() }));
    const B: z.ZodType = z.lazy(() => z.object({ a: A.optional() }));
    const d = introspect(z.object({ root: A }), OPTS);
    expect(d.fields[0].type).toBe("object");
    expect(JSON.stringify(d)).toContain('"kind":"ref"'); // no real cycle in the output
  });

  it("introspects a deep-but-finite lazy chain without overflow", () => {
    const leaf = z.object({ v: z.string() });
    const l1 = z.lazy(() => leaf);
    const l2 = z.lazy(() => z.object({ inner: l1 }));
    const l3 = z.lazy(() => z.object({ inner: l2 }));
    const d = introspect(z.object({ root: l3 }), OPTS);
    expect(d.fields[0].type).toBe("object");
    expect(d.warnings.some((w) => w.code === "unsupported-type")).toBe(false);
  });

  it("bumps FORMAT_VERSION for the new metadata kind", () => {
    expect(introspect(z.object({ a: z.string() }), OPTS).formatVersion).toBeGreaterThanOrEqual(2);
  });
});
