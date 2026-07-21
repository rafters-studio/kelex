import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import type { FieldDescriptor } from "../../src/introspection/types";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };

function field(schema: Parameters<typeof introspect>[0]): FieldDescriptor {
  return introspect(schema, OPTIONS).fields[0];
}

function warnings(schema: Parameters<typeof introspect>[0]): string[] {
  return introspect(schema, OPTIONS).warnings.map((w) => w.message);
}

describe("default handling (#175)", () => {
  // B2: a static default is recorded, unchanged.
  it("records a static default", () => {
    expect(field(z.object({ a: z.number().default(42) })).defaultValue).toBe(42);
    expect(field(z.object({ a: z.string().default("x") })).defaultValue).toBe("x");
  });

  // B2: a constant function default reads the same both times, so it is safe to
  // record -- the field always defaults to that value.
  it("records a constant function default", () => {
    expect(field(z.object({ a: z.number().default(() => 42) })).defaultValue).toBe(42);
  });

  // B2: a function returning a fresh mutable value each call is a legitimate
  // default whose VALUE is stable -- record it, do not warn.
  it("records a fresh-object function default by value", () => {
    expect(field(z.object({ a: z.array(z.string()).default(() => []) })).defaultValue).toEqual([]);
    expect(
      field(z.object({ a: z.object({ x: z.number() }).default(() => ({ x: 1 })) })).defaultValue,
    ).toEqual({ x: 1 });
  });

  // B2 (the fix): a default whose VALUE varies per call must not be baked in --
  // recording a per-call value would make the descriptor and its version hash
  // non-deterministic. Record nothing, warn.
  it("refuses a varying function default and warns", () => {
    const d = introspect(z.object({ a: z.number().default(() => Math.random()) }), OPTIONS);
    expect(d.fields[0].defaultValue).toBeUndefined();
    expect("defaultValue" in d.fields[0]).toBe(false);
    expect(d.warnings.some((w) => w.message.includes("different value each call"))).toBe(true);
  });

  it("refuses a counter-style function default", () => {
    let n = 0;
    const d = introspect(z.object({ a: z.number().default(() => n++) }), OPTIONS);
    expect(d.fields[0].defaultValue).toBeUndefined();
    expect(d.warnings.some((w) => w.message.includes("different value each call"))).toBe(true);
  });

  // The warning is path-qualified for a nested default.
  it("path-qualifies the varying-default warning", () => {
    const d = introspect(
      z.object({ outer: z.object({ token: z.string().default(() => `${Math.random()}`) }) }),
      OPTIONS,
    );
    expect(d.warnings.some((w) => w.message.includes('Field "outer.token"'))).toBe(true);
  });

  // H1: default-of-default. Zod applies the OUTERMOST; the reader must record it.
  it("records the outermost of stacked defaults", () => {
    expect(field(z.object({ a: z.string().default("inner").default("outer") })).defaultValue).toBe(
      "outer",
    );
    // Sanity: Zod itself applies "outer".
    expect(z.string().default("inner").default("outer").parse(undefined)).toBe("outer");
  });

  // H1 + B2: an unstable OUTER default shadows a stable inner one -- record
  // nothing (the outer is what applies), do not fall through to the inner value.
  it("does not fall through to an inner default when the outer is unstable", () => {
    const d = introspect(
      z.object({
        a: z
          .string()
          .default("inner")
          .default(() => `${Math.random()}`),
      }),
      OPTIONS,
    );
    expect(d.fields[0].defaultValue).toBeUndefined();
    expect(d.warnings.some((w) => w.message.includes("different value each call"))).toBe(true);
  });

  // A field with no default carries no defaultValue key at all.
  it("omits defaultValue when there is no default", () => {
    expect("defaultValue" in field(z.object({ a: z.string() }))).toBe(false);
  });

  // A stable default still round-trips and does not warn.
  it("does not warn for a stable default", () => {
    expect(warnings(z.object({ a: z.number().default(7) }))).toEqual([]);
  });

  // Default composed with optional/nullable still resolves the value.
  it("records a default composed with optional and nullable", () => {
    const f = field(z.object({ a: z.string().default("d").optional() }));
    expect(f.defaultValue).toBe("d");
    expect(f.isOptional).toBe(true);
  });
});
