import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import type { FieldDescriptor } from "../../src/introspection/types";
import { writeSchema } from "../../src/schema-writer/writer";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "testSchema" };
const field = (s: Parameters<typeof introspect>[0]): FieldDescriptor =>
  introspect(s, OPTIONS).fields[0];

describe("literals (#186)", () => {
  // H4: z.literal("x") had type "string" with metadata.kind "literal" -- an
  // in-band contradiction the writer resolved by emitting z.string().
  it("gives a literal a first-class type, no type/metadata contradiction", () => {
    const f = field(z.object({ a: z.literal("xyz") }));
    expect(f.type).toBe("literal");
    expect(f.metadata).toEqual({ kind: "literal", values: ["xyz"] });
  });

  it("carries a numeric literal without collapsing to number", () => {
    const f = field(z.object({ a: z.literal(42) }));
    expect(f.type).toBe("literal");
    expect(f.metadata).toEqual({ kind: "literal", values: [42] });
  });

  // H4: a multi-value literal dropped all but the first.
  it("preserves every value of a multi-value literal", () => {
    const f = field(z.object({ a: z.literal(["draft", "published", "archived"]) }));
    if (f.metadata.kind !== "literal") throw new Error("expected literal");
    expect(f.metadata.values).toEqual(["draft", "published", "archived"]);
  });

  it("round-trips a single literal as z.literal, not z.string()", () => {
    const before = introspect(z.object({ a: z.literal("xyz") }), OPTIONS);
    const code = writeSchema({ form: before }).code;
    expect(code).toContain('z.literal("xyz")');
    const after = introspect(evaluateSchemaCode(code), OPTIONS);
    expect(after.fields).toEqual(before.fields);
  });

  it("re-emits a literal that accepts only its value", () => {
    const before = introspect(z.object({ a: z.literal("xyz") }), OPTIONS);
    const schema = evaluateSchemaCode(writeSchema({ form: before }).code) as z.ZodObject;
    expect(schema.shape.a.parse("xyz")).toBe("xyz");
    expect(() => schema.shape.a.parse("other")).toThrow();
  });

  it("round-trips a multi-value literal", () => {
    const before = introspect(z.object({ a: z.literal(["a", "b"]) }), OPTIONS);
    const after = introspect(evaluateSchemaCode(writeSchema({ form: before }).code), OPTIONS);
    expect(after.fields).toEqual(before.fields);
  });

  // A literal value change moves the version (values are structural).
  it("moves the version when the literal value changes", () => {
    const v = (lit: "a" | "b") => introspect(z.object({ x: z.literal(lit) }), OPTIONS).version;
    expect(v("a")).not.toBe(v("b"));
  });
});
