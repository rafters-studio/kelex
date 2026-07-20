import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";

const OPTIONS = {
  formName: "PathForm",
  schemaImportPath: "./path-fixture",
  schemaExportName: "pathSchema",
};

function warningsFor(schema: Parameters<typeof introspect>[0]): string[] {
  return introspect(schema, OPTIONS).warnings;
}

/** An unrepresentable type, so every case below has something to warn about. */
const unsupported = z.map(z.string(), z.string());

describe("warning paths (#158)", () => {
  // Criterion 3: the common case must not regress into bracket noise. A
  // top-level field still reads as a bare name.
  it("names a top-level field by its plain name", () => {
    const [warning] = warningsFor(z.object({ title: unsupported }));
    expect(warning).toContain('Field "title"');
    expect(warning).not.toContain("[");
  });

  // Criterion 2: the reported defect. A nested field said Field "name" with no
  // indication of which branch it lived in.
  it("names a nested field by its full dotted path", () => {
    const [warning] = warningsFor(
      z.object({
        identity: z.object({ origin: z.object({ discipline: z.object({ name: unsupported }) }) }),
      }),
    );
    expect(warning).toContain('Field "identity.origin.discipline.name"');
  });

  // Criterion 4: each composite kind gets a locator, so a sibling with the same
  // leaf name in a different branch is distinguishable.
  it("locates array elements by index", () => {
    const [warning] = warningsFor(z.object({ bag: z.array(z.object({ item: unsupported })) }));
    expect(warning).toContain('Field "bag[0].item"');
  });

  it("locates tuple elements by index", () => {
    const warnings = warningsFor(z.object({ coords: z.tuple([unsupported, unsupported]) }));
    expect(warnings[0]).toContain('Field "coords[0]"');
    expect(warnings[1]).toContain('Field "coords[1]"');
    // The defect this fixes: these two were both reported as Field "0" and
    // Field "1", with nothing tying them to coords.
    expect(warnings[0]).not.toBe(warnings[1]);
  });

  it("locates a record value with a wildcard segment", () => {
    const [warning] = warningsFor(z.object({ stats: z.record(z.string(), unsupported) }));
    // The real key is not known until validation, so the position is a template.
    expect(warning).toContain('Field "stats.*"');
  });

  it("locates union variant fields under the union's own path", () => {
    const warnings = warningsFor(
      z.object({
        payment: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("card"), detail: unsupported }),
          z.object({ kind: z.literal("bank"), detail: unsupported }),
        ]),
      }),
    );
    // Variants are alternatives at the same position, not children of it, so a
    // ~standard issue for either would report at payment.detail.
    expect(warnings.every((w) => w.includes('Field "payment.detail"'))).toBe(true);
  });

  // Criterion 4, the point of the whole card: two fields with the same leaf
  // name in different branches must produce distinguishable warnings.
  it("distinguishes same-named fields in different branches", () => {
    const warnings = warningsFor(
      z.object({
        shipping: z.object({ line: unsupported }),
        billing: z.object({ line: unsupported }),
      }),
    );
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('Field "shipping.line"');
    expect(warnings[1]).toContain('Field "billing.line"');
    expect(warnings[0]).not.toBe(warnings[1]);
  });

  it("locates a field nested under several composite kinds at once", () => {
    const [warning] = warningsFor(
      z.object({
        orders: z.array(z.object({ lines: z.array(z.object({ sku: unsupported })) })),
      }),
    );
    expect(warning).toContain('Field "orders[0].lines[0].sku"');
  });

  // Criterion 5: content changes, count does not. A path-qualified warning must
  // not become two warnings, or a consumer counting them sees a regression.
  it("does not change how many warnings are produced", () => {
    const warnings = warningsFor(
      z.object({
        a: unsupported,
        b: z.object({ c: unsupported }),
        d: z.array(unsupported),
      }),
    );
    expect(warnings).toHaveLength(3);
  });

  // The catch and record-key warnings route through the same path, so they are
  // pinned too rather than assumed to have been updated.
  it("applies paths to catch warnings", () => {
    const [warning] = warningsFor(
      z.object({ bag: z.array(z.object({ count: z.number().catch(0) })) }),
    );
    expect(warning).toContain('Field "bag[0].count"');
    expect(warning).toContain(".catch()");
  });

  it("applies paths to record-key warnings", () => {
    const [warning] = warningsFor(
      z.object({ outer: z.object({ dict: z.record(z.enum(["a"]), z.string()) }) }),
    );
    expect(warning).toContain('Field "outer.dict"');
    expect(warning).toContain("record key schema");
  });
});
