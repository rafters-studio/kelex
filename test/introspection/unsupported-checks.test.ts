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

  it("names the range z.int64() and z.uint64() imply, which live on the format, not a check", () => {
    const [, int64] = warningsFor(z.int64());
    expect(int64).toEqual([
      "check-dropped",
      expect.stringContaining('"int64: >= -9223372036854775808n and <= 9223372036854775807n"'),
    ]);
    const [, uint64, bound] = warningsFor(z.uint64().min(5n));
    expect(uint64[1]).toContain('"uint64: >= 0n and <= 18446744073709551615n"');
    expect(bound[1]).toContain('">= 5n"');
  });

  it("reports a refine on a fallback type as refine-unrepresented, as on any other type", () => {
    const warnings = warningsFor(z.bigint().refine((v) => v > 0n, "must be positive"));
    expect(warnings.map(([code]) => code)).toEqual(["unsupported-type", "refine-unrepresented"]);
  });

  it("names non-bigint fallback checks with their values: file size and mime, set size", () => {
    const file = warningsFor(z.file().min(1).max(10).mime("image/png"))
      .filter(([code]) => code === "check-dropped")
      .map(([, message]) => message);
    expect(file[0]).toContain('"min size 1"');
    expect(file[1]).toContain('"max size 10"');
    expect(file[2]).toContain('"mime image/png"');
    const set = warningsFor(z.set(z.string()).min(1).max(5)).map(([, message]) => message);
    expect(set.some((m) => m.includes('"min size 1"'))).toBe(true);
    expect(set.some((m) => m.includes('"max size 5"'))).toBe(true);
  });

  it("emits only the type warning for a bigint with no checks", () => {
    expect(warningsFor(z.bigint()).map(([code]) => code)).toEqual(["unsupported-type"]);
  });
});
