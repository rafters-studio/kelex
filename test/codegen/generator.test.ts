import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { generate } from "../../src/codegen";
import { compositeTarget } from "../../src/targets";
import type { CodegenTarget, TargetResult } from "../../src/targets/types";

const schema = z.object({ name: z.string(), age: z.number() });

const BASE = {
  schema,
  formName: "TestForm",
  schemaImportPath: "./schema",
  schemaExportName: "testSchema",
};

function fakeTarget(name: string, gen: CodegenTarget["generate"]): CodegenTarget {
  return { name, description: "fake", defaultExtension: ".fake", generate: gen };
}

describe("generate() target validation (#189)", () => {
  // AC1: omitted descriptor field -> warning naming the field and the target.
  it("warns naming the field and the target when a target omits a descriptor field", () => {
    const target = fakeTarget("partial", () => ({
      files: [{ filename: "f.fake", content: "" }],
      fields: ["name"], // "age" omitted
      warnings: [],
    }));
    const result = generate({ ...BASE, target });
    const omissions = result.warnings.filter((w) => w.code === "target-field-unprocessed");
    expect(omissions).toHaveLength(1);
    expect(omissions[0].message).toContain("age");
    expect(omissions[0].message).toContain("partial");
    expect(omissions[0].path).toEqual(["age"]);
  });

  // AC2: malformed result -> clear error naming the target, not a raw access failure.
  it("rejects a non-object result, naming the target", () => {
    const target = fakeTarget("null-result", () => null as unknown as TargetResult);
    expect(() => generate({ ...BASE, target })).toThrow(/null-result.*malformed/);
  });

  it("rejects an empty files array, naming the target", () => {
    const target = fakeTarget(
      "no-files",
      () => ({ files: [], fields: [], warnings: [] }) as unknown as TargetResult,
    );
    expect(() => generate({ ...BASE, target })).toThrow(/no-files/);
    expect(() => generate({ ...BASE, target })).toThrow(/files/);
  });

  it("rejects a file entry missing content, pointing at the entry not a raw property access", () => {
    const target = fakeTarget(
      "bad-file",
      () =>
        ({ files: [{ filename: "f.fake" }], fields: [], warnings: [] }) as unknown as TargetResult,
    );
    expect(() => generate({ ...BASE, target })).toThrow(/bad-file/);
    expect(() => generate({ ...BASE, target })).toThrow(/files\[0\]/);
  });

  it("rejects a non-string entry in fields, naming the target", () => {
    const target = fakeTarget(
      "bad-fields",
      () =>
        ({
          files: [{ filename: "f.fake", content: "x" }],
          fields: [1, 2],
          warnings: [],
        }) as unknown as TargetResult,
    );
    expect(() => generate({ ...BASE, target })).toThrow(/bad-fields.*fields/);
  });

  // AC3: a target throw surfaces an error naming the target and enough context.
  it("wraps a target throw with the target name and form context", () => {
    const target = fakeTarget("boom", () => {
      throw new Error("inner detail");
    });
    expect(() => generate({ ...BASE, target })).toThrow(/boom/);
    expect(() => generate({ ...BASE, target })).toThrow(/TestForm/);
    expect(() => generate({ ...BASE, target })).toThrow(/inner detail/);
  });

  it("preserves the original throw as the error cause", () => {
    const inner = new Error("inner");
    const target = fakeTarget("boom2", () => {
      throw inner;
    });
    try {
      generate({ ...BASE, target });
      expect.unreachable("generate should have thrown");
    } catch (e) {
      expect((e as Error).cause).toBe(inner);
    }
  });

  // AC4: the composite target passes cleanly, no new warnings.
  it("adds no warnings for the composite target, which processes every field", () => {
    const result = generate({ ...BASE, target: compositeTarget });
    expect(result.warnings).toEqual([]);
  });

  // AC5: the check runs for a third-party target too (well-formed one passes).
  it("runs the checks for a third-party target and passes a well-formed one through", () => {
    const target = fakeTarget("third-party", () => ({
      files: [{ filename: "f.fake", content: "x" }],
      fields: ["name", "age"],
      warnings: ["custom prose"],
    }));
    const result = generate({ ...BASE, target });
    expect(result.warnings.some((w) => w.code === "target-field-unprocessed")).toBe(false);
    expect(result.warnings).toContainEqual({
      path: [],
      code: "target-warning",
      message: "custom prose",
    });
  });
});
