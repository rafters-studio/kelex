import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };

const warningsFor = (schema: unknown) =>
  introspect(z.object({ a: schema as never }), OPTS).warnings.map((w) => [w.code, w.message]);

describe("checks on a field that falls back to a string (#254)", () => {
  it("warns once per dropped bigint bound, naming the bound and its value", () => {
    const warnings = warningsFor(z.bigint().min(5n).max(10n));
    expect(warnings.map(([code]) => code)).toEqual([
      "unsupported-type",
      "check-dropped",
      "check-dropped",
    ]);
    expect(warnings[1][1]).toContain('dropped check ">= 5n"');
    expect(warnings[2][1]).toContain('dropped check "<= 10n"');
  });

  it("warns for every other check too: exclusive bounds and multipleOf", () => {
    const messages = warningsFor(z.bigint().positive().lt(100n).multipleOf(2n))
      .filter(([code]) => code === "check-dropped")
      .map(([, message]) => message);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toContain('"> 0n"');
    expect(messages[1]).toContain('"< 100n"');
    expect(messages[2]).toContain('"multipleOf 2n"');
  });

  it("emits only the type warning for a bigint with no checks", () => {
    expect(warningsFor(z.bigint()).map(([code]) => code)).toEqual(["unsupported-type"]);
  });
});
