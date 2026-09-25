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

describe("recursion spelled with getters, the Zod 4 idiom (#251)", () => {
  // Walks a field tree and returns [dotted path, target] for every ref node.
  const refsOf = (fields: readonly unknown[], prefix = ""): [string, unknown][] => {
    const out: [string, unknown][] = [];
    for (const raw of fields) {
      const f = raw as { name: string; type: string; metadata: Record<string, unknown> };
      const here = prefix ? `${prefix}.${f.name}` : f.name;
      if (f.type === "ref") out.push([here, f.metadata.target]);
      const m = f.metadata;
      if (Array.isArray(m.fields)) out.push(...refsOf(m.fields, here));
      if (m.element) out.push(...refsOf([m.element], here));
    }
    return out;
  };

  const getterNode = () => {
    const Node = z.object({
      name: z.string(),
      get kids() {
        return z.array(Node);
      },
    });
    return Node;
  };

  it("emits a ref to the ancestor instead of overflowing the stack", () => {
    const d = introspect(z.object({ root: getterNode() }), OPTS);
    expect(refsOf(d.fields)).toEqual([["root.kids.item", ["root"]]]);
    expect(d.warnings.some((w) => w.code === "unsupported-type")).toBe(false);
  });

  it("produces the same descriptor as the z.lazy spelling of the same schema", () => {
    const LazyNode: z.ZodType = z.object({
      name: z.string(),
      kids: z.array(z.lazy(() => LazyNode)),
    });
    const viaGetter = introspect(z.object({ root: getterNode() }), OPTS);
    const viaLazy = introspect(z.object({ root: LazyNode }), OPTS);
    expect(viaGetter.fields).toEqual(viaLazy.fields);
    expect(viaGetter.version).toBe(viaLazy.version);
  });

  it("terminates on mutual recursion between two getter-recursive objects", () => {
    const A = z.object({
      a: z.string(),
      get b() {
        return B.optional();
      },
    });
    const B = z.object({
      b: z.number(),
      get a() {
        return A.optional();
      },
    });
    const d = introspect(z.object({ root: A }), OPTS);
    expect(refsOf(d.fields)).toEqual([["root.b.a", ["root"]]]);
  });

  it("closes a cycle through a union with no z.lazy anywhere", () => {
    const Expr = z.object({
      get value() {
        return z.union([z.number(), Expr]);
      },
    });
    const d = introspect(z.object({ root: Expr }), OPTS);
    expect(JSON.stringify(d.fields)).toContain('"kind":"ref"');
  });

  it("closes a cycle through an intersection, which is flattened anew on every visit", () => {
    const Base = z.object({ name: z.string() });
    const Node: z.ZodType = z.intersection(
      Base,
      z.object({
        get child() {
          return Node.optional();
        },
      }),
    );
    const d = introspect(z.object({ root: Node }), OPTS);
    expect(refsOf(d.fields)).toEqual([["root.child", ["root"]]]);
  });

  it("keys on the path, not the schema: a sibling reusing one schema still expands", () => {
    const Address = z.object({ street: z.string() });
    const d = introspect(z.object({ home: Address, work: Address }), OPTS);
    expect(d.fields.map((f) => f.type)).toEqual(["object", "object"]);
    expect(refsOf(d.fields)).toEqual([]);
  });
});
