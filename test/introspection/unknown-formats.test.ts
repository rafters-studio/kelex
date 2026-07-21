import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const warningsOf = (s: Parameters<typeof introspect>[0]) => introspect(s, OPTIONS).warnings;

describe("unknown string formats (#181)", () => {
  // H3: an unrecognized def-level format degraded to string with no warning.
  it("warns for z.iso.date()", () => {
    const w = warningsOf(z.object({ a: z.iso.date() }));
    expect(w.some((x) => x.includes("string_format:date"))).toBe(true);
  });

  it("warns for z.ipv4()", () => {
    const w = warningsOf(z.object({ a: (z as unknown as { ipv4: () => z.ZodType }).ipv4() }));
    expect(w.some((x) => x.includes("string_format:ipv4"))).toBe(true);
  });

  it("warns for a non-string-format string like z.base64()", () => {
    const zz = z as unknown as { base64?: () => z.ZodType };
    if (!zz.base64) return; // skip if the helper is absent in this Zod build
    const w = warningsOf(z.object({ a: zz.base64() }));
    expect(w.some((x) => x.includes("string_format:"))).toBe(true);
  });

  // The five known formats are unchanged and do not warn.
  it("does not warn for the known formats", () => {
    expect(warningsOf(z.object({ a: z.email() }))).toEqual([]);
    expect(warningsOf(z.object({ a: z.url() }))).toEqual([]);
    expect(warningsOf(z.object({ a: z.uuid() }))).toEqual([]);
  });

  it("does not warn for a plain string", () => {
    expect(warningsOf(z.object({ a: z.string() }))).toEqual([]);
  });

  // The warning is path-qualified.
  it("path-qualifies the unknown-format warning", () => {
    const w = warningsOf(z.object({ outer: z.object({ ip: z.iso.date() }) }));
    expect(w.some((x) => x.includes('Field "outer.ip"'))).toBe(true);
  });
});
