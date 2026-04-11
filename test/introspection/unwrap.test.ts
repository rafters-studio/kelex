import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { unwrapSchema } from "../../src/introspection/unwrap";

describe("unwrapSchema", () => {
  it("returns non-optional string as-is with isOptional: false", () => {
    const schema = z.string();
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(false);
    expect(result.inner._zod.def.type).toBe("string");
  });

  it("unwraps optional string and returns isOptional: true", () => {
    const schema = z.string().optional();
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(true);
    expect(result.inner._zod.def.type).toBe("string");
  });

  it("unwraps optional number and returns isOptional: true", () => {
    const schema = z.number().optional();
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(true);
    expect(result.inner._zod.def.type).toBe("number");
  });

  it("unwraps z.optional() wrapper", () => {
    const schema = z.optional(z.boolean());
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(true);
    expect(result.inner._zod.def.type).toBe("boolean");
  });

  it("handles deeply nested optionals", () => {
    const schema = z.optional(z.optional(z.string()));
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(true);
    expect(result.inner._zod.def.type).toBe("string");
  });

  it("handles non-optional boolean", () => {
    const schema = z.boolean();
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(false);
    expect(result.inner._zod.def.type).toBe("boolean");
  });

  it("handles non-optional date", () => {
    const schema = z.date();
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(false);
    expect(result.inner._zod.def.type).toBe("date");
  });

  it("handles optional enum", () => {
    const schema = z.enum(["a", "b", "c"]).optional();
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(true);
    expect(result.inner._zod.def.type).toBe("enum");
  });

  it("throws for non-Zod4 schema (null)", () => {
    expect(() => unwrapSchema(null as unknown as z.ZodType)).toThrow(
      "Schema is not a valid Zod 4 schema",
    );
  });

  it("throws for non-Zod4 schema (plain object)", () => {
    expect(() => unwrapSchema({} as unknown as z.ZodType)).toThrow(
      "Schema is not a valid Zod 4 schema",
    );
  });

  it("throws for non-Zod4 schema (undefined)", () => {
    expect(() => unwrapSchema(undefined as unknown as z.ZodType)).toThrow(
      "Schema is not a valid Zod 4 schema",
    );
  });

  // Complex schema types
  it("handles optional object schema", () => {
    const schema = z.object({ name: z.string() }).optional();
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(true);
    expect(result.inner._zod.def.type).toBe("object");
  });

  it("handles optional array schema", () => {
    const schema = z.array(z.string()).optional();
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(true);
    expect(result.inner._zod.def.type).toBe("array");
  });

  it("handles optional union schema", () => {
    const schema = z.union([z.string(), z.number()]).optional();
    const result = unwrapSchema(schema);

    expect(result.isOptional).toBe(true);
    expect(result.inner._zod.def.type).toBe("union");
  });

  // z.default() unwrapping
  it("unwraps z.default() to expose the inner type", () => {
    const schema = z.string().default("hello");
    const result = unwrapSchema(schema);

    expect(result.inner._zod.def.type).toBe("string");
    expect(result.isOptional).toBe(false);
    expect(result.isNullable).toBe(false);
  });

  it("unwraps z.number().default() to expose number type", () => {
    const schema = z.number().default(0);
    const result = unwrapSchema(schema);

    expect(result.inner._zod.def.type).toBe("number");
  });

  it("unwraps optional().default() combination", () => {
    const schema = z.string().optional().default("fallback");
    const result = unwrapSchema(schema);

    expect(result.inner._zod.def.type).toBe("string");
    expect(result.isOptional).toBe(true);
  });

  it("throws for malformed schema with _zod but no def", () => {
    const malformed = { _zod: {} } as unknown as z.ZodType;
    expect(() => unwrapSchema(malformed)).toThrow(
      "Schema is not a valid Zod 4 schema",
    );
  });

  it("throws for malformed schema with _zod.def but no type", () => {
    const malformed = { _zod: { def: {} } } as unknown as z.ZodType;
    expect(() => unwrapSchema(malformed)).toThrow(
      "Schema is not a valid Zod 4 schema",
    );
  });
});
