import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { FORMAT_VERSION, introspect } from "../../src/introspection";
import { compositeTarget } from "../../src/targets";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };

describe("descriptor format version (#185)", () => {
  it("carries a numeric formatVersion distinct from the content hash", () => {
    const d = introspect(z.object({ a: z.string() }), OPTIONS);
    expect(d.formatVersion).toBe(FORMAT_VERSION);
    expect(typeof d.formatVersion).toBe("number");
    // It is a separate field, not the content hash.
    expect(d.formatVersion).not.toBe(d.version);
  });

  it("does not participate in the content hash", () => {
    // Two different schemas hash differently, but both carry the same
    // formatVersion -- the format version is constant, so it cannot be what
    // distinguishes their content versions.
    const a = introspect(z.object({ x: z.string() }), OPTIONS);
    const b = introspect(z.object({ y: z.number() }), OPTIONS);
    expect(a.formatVersion).toBe(b.formatVersion);
    expect(a.version).not.toBe(b.version);
    // The canonical fixture's pinned hash is unchanged by adding formatVersion:
    // proven by the untouched version.test.ts pin still passing (11617b63d9d43a33).
  });

  it("is stamped top-level in the composite artifact", () => {
    const d = introspect(z.object({ a: z.string() }), OPTIONS);
    const parsed = JSON.parse(compositeTarget.generate(d, {}).files[0].content);
    expect(parsed.formatVersion).toBe(FORMAT_VERSION);
  });

  it("exports FORMAT_VERSION for a consumer to pin against", () => {
    // Bumped to 2 when the `ref` metadata kind was added (#214).
    expect(FORMAT_VERSION).toBe(2);
  });
});
