import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import { compositeTarget } from "../../src/targets";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const versionOf = (s: Parameters<typeof introspect>[0]) => introspect(s, OPTIONS).version;

describe("version hardening (#176)", () => {
  // B4: a bigint anywhere used to crash computeVersion via JSON.stringify.
  it("does not crash on a bigint literal", () => {
    expect(() => versionOf(z.object({ a: z.literal(1n) }))).not.toThrow();
    expect(versionOf(z.object({ a: z.literal(1n) }))).toMatch(/^[0-9a-f]{16}$/);
  });

  it("does not crash on a bigint default", () => {
    expect(() => versionOf(z.object({ a: z.bigint().default(5n) }))).not.toThrow();
  });

  it("distinguishes different bigint literals", () => {
    expect(versionOf(z.object({ a: z.literal(1n) }))).not.toBe(
      versionOf(z.object({ a: z.literal(2n) })),
    );
  });

  // H2: presentation keys were stripped at every depth, including inside a
  // default value object -- so two different defaults collided.
  it("distinguishes defaults that differ only in a presentation-named key", () => {
    const mk = (label: string) =>
      z.object({ a: z.object({ label: z.string(), x: z.number() }).default({ label, x: 1 }) });
    expect(versionOf(mk("aaa"))).not.toBe(versionOf(mk("bbb")));
  });

  it("distinguishes a default with vs without a presentation-named key", () => {
    const withLabel = z.object({
      a: z.object({ label: z.string(), x: z.number() }).default({ label: "l", x: 1 }),
    });
    const withoutLabel = z.object({
      a: z.object({ label: z.string(), x: z.number() }).default({ label: "", x: 1 }),
    });
    expect(versionOf(withLabel)).not.toBe(versionOf(withoutLabel));
  });

  // The FieldDescriptor-level exclusion still holds: a label edit does not churn.
  it("still ignores a field-level .meta() label", () => {
    expect(versionOf(z.object({ a: z.string().meta({ title: "Alpha" }) }))).toBe(
      versionOf(z.object({ a: z.string() })),
    );
  });

  it("still ignores a field-level description", () => {
    expect(versionOf(z.object({ a: z.string().describe("a note") }))).toBe(
      versionOf(z.object({ a: z.string() })),
    );
  });

  // Determinism preserved.
  it("is deterministic across runs", () => {
    const s = z.object({ a: z.string().min(2), b: z.number().int() });
    expect(versionOf(s)).toBe(versionOf(s));
  });

  // The composite target had the same JSON.stringify(bigint) landmine.
  it("composite target serializes a bigint field without crashing", () => {
    const descriptor = introspect(z.object({ a: z.literal(1n) }), OPTIONS);
    expect(() => compositeTarget.generate(descriptor, {})).not.toThrow();
    const parsed = JSON.parse(compositeTarget.generate(descriptor, {}).files[0].content);
    expect(parsed.version).toBe(descriptor.version);
  });
});
