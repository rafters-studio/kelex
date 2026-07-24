import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const warningsOf = (s: Parameters<typeof introspect>[0]) =>
  introspect(s, OPTIONS).warnings.map((w) => w.message);

describe("coerce and unknown-key policy (#183)", () => {
  // M1: coercion changes what inputs are accepted; it was dropped silently.
  it("warns for z.coerce.number()", () => {
    const w = warningsOf(z.object({ a: z.coerce.number() }));
    expect(w.some((x) => x.includes("coercion"))).toBe(true);
  });

  it("warns for z.coerce.date()", () => {
    const w = warningsOf(z.object({ a: z.coerce.date() }));
    expect(w.some((x) => x.includes("coercion"))).toBe(true);
  });

  // M3: strict/catchall/passthrough silently became a plain object.
  it("warns for a nested strictObject", () => {
    const w = warningsOf(z.object({ a: z.strictObject({ x: z.string() }) }));
    expect(w.some((x) => x.includes("unknown-key policy"))).toBe(true);
  });

  it("warns for .catchall()/passthrough", () => {
    const w = warningsOf(z.object({ a: z.object({ x: z.string() }).catchall(z.unknown()) }));
    expect(w.some((x) => x.includes("unknown-key policy"))).toBe(true);
  });

  // A top-level strictObject carries the policy on the root def.
  it("warns for a top-level strictObject at (form)", () => {
    const w = warningsOf(z.strictObject({ a: z.string() }));
    expect(w.some((x) => x.includes("unknown-key policy") && x.includes("(form)"))).toBe(true);
  });

  // Path-qualified for a nested field.
  it("path-qualifies the policy warning", () => {
    const w = warningsOf(z.object({ outer: z.object({ inner: z.coerce.number() }) }));
    expect(w.some((x) => x.includes('Field "outer.inner"'))).toBe(true);
  });

  // Plain fields and plain nested objects do not warn.
  it("does not warn for a plain object or plain scalar", () => {
    expect(warningsOf(z.object({ a: z.number(), b: z.object({ c: z.string() }) }))).toEqual([]);
  });
});
