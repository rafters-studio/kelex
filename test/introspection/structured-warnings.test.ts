import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { generate } from "../../src/codegen";
import { introspect } from "../../src/introspection";
import type { Warning } from "../../src/introspection/types";
import { compositeTarget } from "../../src/targets";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };

describe("structured warnings (#184)", () => {
  // Each warning is an object with path, code, and message -- not a prose string.
  it("emits warnings as { path, code, message } objects", () => {
    const [w] = introspect(
      z.object({ token: z.string().transform((s) => s.length) }),
      OPTIONS,
    ).warnings;
    expect(w).toBeDefined();
    expect(typeof w.message).toBe("string");
    expect(w.code).toBe("transform-output-dropped");
    expect(Array.isArray(w.path)).toBe(true);
  });

  // The path is the Standard Schema PathSegment[], matchable against a ~standard
  // issue path -- not a pre-rendered string.
  it("carries the raw PathSegment[] as the path", () => {
    const [w] = introspect(
      z.object({ bag: z.array(z.object({ v: z.number().catch(0) })) }),
      OPTIONS,
    ).warnings;
    expect(w.path).toEqual(["bag", 0, "v"]);
    expect(w.code).toBe("catch-fallback-dropped");
  });

  it("uses an empty path for a form-level warning", () => {
    const [w] = introspect(
      z.object({ a: z.string(), b: z.string() }).refine(() => true, { message: "cross" }),
      OPTIONS,
    ).warnings;
    expect(w.path).toEqual([]);
    expect(w.code).toBe("refine-unrepresented");
  });

  // A consumer can bind to a field by code + path without parsing prose.
  it("lets a consumer select a warning by code and path", () => {
    const warnings = introspect(
      z.object({
        a: z.coerce.number(),
        b: z.iso.date(),
      }),
      OPTIONS,
    ).warnings;
    const coerce = warnings.find((w: Warning) => w.code === "coerce-unrepresented");
    expect(coerce?.path).toEqual(["a"]);
    const format = warnings.find((w: Warning) => w.code === "format-unrecognized");
    expect(format?.path).toEqual(["b"]);
  });

  // Distinct codes cover the distinct warning kinds.
  it("assigns a stable code per warning kind", () => {
    const codeOf = (schema: Parameters<typeof introspect>[0]) =>
      introspect(schema, OPTIONS).warnings[0]?.code;
    expect(codeOf(z.object({ a: z.string().catch("x") }))).toBe("catch-fallback-dropped");
    expect(codeOf(z.object({ a: z.number().default(() => Math.random()) }))).toBe(
      "default-unstable",
    );
    expect(codeOf(z.object({ a: z.string().transform((s) => s) }))).toBe(
      "transform-output-dropped",
    );
    expect(codeOf(z.object({ a: z.strictObject({ x: z.string() }) }))).toBe(
      "key-policy-unrepresented",
    );
    expect(codeOf(z.object({ a: z.map(z.string(), z.string()) }))).toBe("unsupported-type");
  });

  // generate() wraps a target's prose warnings as structured with a target code.
  it("wraps target warnings with a target-warning code", () => {
    const result = generate({
      schema: z.object({ lookup: z.record(z.enum(["a"]), z.number()) }),
      formName: OPTIONS.formName,
      schemaImportPath: OPTIONS.schemaImportPath,
      schemaExportName: OPTIONS.schemaExportName,
      target: compositeTarget,
    });
    // All entries are structured, and the introspection ones keep their real codes.
    expect(result.warnings.every((w) => typeof w.code === "string")).toBe(true);
    expect(result.warnings.some((w) => w.code === "record-key-narrowed")).toBe(true);
  });
});
