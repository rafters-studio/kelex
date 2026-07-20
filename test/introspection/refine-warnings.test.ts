import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";

const OPTIONS = {
  formName: "RefineForm",
  schemaImportPath: "./refine-fixture",
  schemaExportName: "refineSchema",
};

function warningsFor(schema: Parameters<typeof introspect>[0]): string[] {
  return introspect(schema, OPTIONS).warnings;
}

const pair = z.object({ start: z.number(), end: z.number() });

describe("refine warning detail (#156)", () => {
  // Criterion 1: the author already wrote a sentence naming the relationship.
  // Discarding it and reporting "a refine exists" throws away the only
  // human-readable description of the rule the consumer must reimplement.
  it("includes a constant message", () => {
    const [warning] = warningsFor(
      pair.refine((v) => v.end > v.start, { message: "end must be after start" }),
    );
    expect(warning).toContain("end must be after start");
  });

  // Criterion 2: an explicit path names the field, and the WHOLE path, not
  // just its first segment.
  it("names the field from an explicit path", () => {
    const [warning] = warningsFor(pair.refine(() => true, { message: "bad end", path: ["end"] }));
    expect(warning).toContain('Field "end"');
  });

  it("renders a multi-segment refinement path in full", () => {
    const [warning] = warningsFor(
      z
        .object({ range: z.object({ end: z.number() }) })
        .refine(() => true, { message: "nested rule", path: ["range", "end"] }),
    );
    expect(warning).toContain('Field "range.end"');
  });

  // Criterion 3 and 4: no path means the constrained fields genuinely are not
  // recoverable -- Zod keeps only the opaque predicate. Saying so beats
  // reporting a bare "(form)", which reads like a field actually named that.
  it("reports a pathless refinement as form-level and says fields are unrecoverable", () => {
    const [warning] = warningsFor(pair.refine(() => true, { message: "some rule" }));
    expect(warning).toContain("Form-level");
    expect(warning).toContain("not recoverable");
    expect(warning).not.toContain('Field "(form)"');
  });

  it("distinguishes form-level from field-level in the text", () => {
    const [formLevel] = warningsFor(pair.refine(() => true, { message: "m" }));
    const [fieldLevel] = warningsFor(pair.refine(() => true, { message: "m", path: ["end"] }));
    expect(formLevel).toContain("Form-level");
    expect(fieldLevel).toContain('Field "end"');
    expect(fieldLevel).not.toContain("Form-level");
  });

  it("still warns when a refinement carries neither message nor path", () => {
    const [warning] = warningsFor(pair.refine(() => true));
    expect(warning).toContain("Form-level");
    expect(warning).toContain(".refine()");
  });

  // The refusal-to-fabricate rule. Zod stores { message } as an error FUNCTION,
  // so the string is only reachable by calling it -- and a user-supplied error
  // callback may format from the failing value, where calling it here would
  // invent a message for an input that never existed.
  it("does not surface a value-dependent error message", () => {
    const [warning] = warningsFor(
      pair.refine(() => true, {
        error: (issue: { input?: unknown }) => `got ${String(issue?.input)}`,
      }),
    );
    // The probe inputs must never leak into a warning.
    expect(warning).not.toContain("kelex-probe");
    expect(warning).toContain("Form-level");
  });

  it("survives an error callback that throws on a synthetic issue", () => {
    const [warning] = warningsFor(
      pair.refine(() => true, {
        error: (issue: { input: { deep: { deeper: string } } }) => issue.input.deep.deeper,
      }),
    );
    expect(warning).toContain(".refine()");
  });

  // Criterion 5: content changes, count does not.
  it("does not change how many warnings are produced", () => {
    const warnings = warningsFor(
      pair
        .refine(() => true, { message: "one" })
        .refine(() => true, { message: "two", path: ["end"] }),
    );
    expect(warnings).toHaveLength(2);
  });

  // superRefine surfaces as the same "custom" check kind.
  it("applies the same treatment to superRefine", () => {
    const [warning] = warningsFor(pair.superRefine(() => undefined));
    expect(warning).toContain(".superRefine()");
  });
});
