import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { generate } from "../../src/codegen/generator";
import { introspect } from "../../src/introspection";
import { reactTanStackTarget } from "../../src/targets/react-tanstack";

describe("reactTanStackTarget", () => {
  it("has correct metadata", () => {
    expect(reactTanStackTarget.name).toBe("react-tanstack");
    expect(reactTanStackTarget.defaultExtension).toBe(".tsx");
  });

  it("generates same output as generate() for simple schema", () => {
    const schema = z.object({
      name: z.string(),
      email: z.string().email(),
      active: z.boolean(),
    });

    const legacyResult = generate({
      schema,
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "testSchema",
    });

    const form = introspect(schema, {
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "testSchema",
    });

    const targetResult = reactTanStackTarget.generate(form, {});

    // Primary file content should match
    expect(targetResult.files[0].content).toBe(legacyResult.code);
  });

  it("generates primitives when no uiImportPath", () => {
    const schema = z.object({ name: z.string() });
    const form = introspect(schema, {
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "testSchema",
    });

    const result = reactTanStackTarget.generate(form, {});
    const primitivesFile = result.files.find(
      (f) => f.filename === "primitives.tsx",
    );
    expect(primitivesFile).toBeDefined();
    expect(primitivesFile?.content).toContain("export function Field");
  });

  it("skips primitives when uiImportPath is set", () => {
    const schema = z.object({ name: z.string() });
    const form = introspect(schema, {
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "testSchema",
    });

    const result = reactTanStackTarget.generate(form, {
      uiImportPath: "@/components/ui",
    });
    const primitivesFile = result.files.find(
      (f) => f.filename === "primitives.tsx",
    );
    expect(primitivesFile).toBeUndefined();
  });

  it("reports processed fields", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const form = introspect(schema, {
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "testSchema",
    });

    const result = reactTanStackTarget.generate(form, {});
    expect(result.fields).toEqual(["name", "age"]);
  });

  it("passes through target via generate()", () => {
    const schema = z.object({ name: z.string() });

    const result = generate({
      schema,
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "testSchema",
      target: reactTanStackTarget,
    });

    expect(result.code).toContain("export function TestForm");
    expect(result.files.length).toBeGreaterThanOrEqual(1);
  });
});
