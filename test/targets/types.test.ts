import { describe, expect, it } from "vitest";
import type {
  CodegenTarget,
  TargetOptions,
  TargetOutputFile,
  TargetResult,
} from "../../src/targets/types";

describe("target types", () => {
  it("TargetOutputFile has filename and content", () => {
    const file: TargetOutputFile = {
      filename: "test.tsx",
      content: "export function Test() {}",
    };
    expect(file.filename).toBe("test.tsx");
    expect(file.content).toContain("Test");
  });

  it("TargetResult has files, fields, and warnings", () => {
    const result: TargetResult = {
      files: [{ filename: "test.tsx", content: "" }],
      fields: ["name"],
      warnings: ["something skipped"],
    };
    expect(result.files).toHaveLength(1);
    expect(result.fields).toEqual(["name"]);
    expect(result.warnings).toHaveLength(1);
  });

  it("CodegenTarget interface is implementable", () => {
    const target: CodegenTarget = {
      name: "test",
      description: "A test target",
      defaultExtension: ".test",
      generate(_form, _options) {
        return { files: [], fields: [], warnings: [] };
      },
    };
    expect(target.name).toBe("test");
    expect(target.defaultExtension).toBe(".test");
  });

  it("TargetOptions is extensible", () => {
    interface CustomOptions extends TargetOptions {
      customProp: string;
    }
    const opts: CustomOptions = { customProp: "value" };
    expect(opts.customProp).toBe("value");
  });
});
