import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { generate } from "../../src/codegen/generator";
import { introspect } from "../../src/introspection";
import { compositeTarget } from "../../src/targets/composite";

describe("compositeTarget", () => {
  it("has correct metadata", () => {
    expect(compositeTarget.name).toBe("composite");
    expect(compositeTarget.defaultExtension).toBe(".composite.json");
  });

  it("surfaces introspection warnings through generate()", () => {
    const schema = z.object({
      name: z.string(),
      lookup: z.map(z.string(), z.string()),
    });

    const result = generate({
      schema,
      formName: "WarnForm",
      schemaImportPath: "./schema",
      schemaExportName: "warnSchema",
      target: compositeTarget,
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.map((w) => w.message).join("; ")).toContain("lookup");
    expect(result.warnings.map((w) => w.message).join("; ")).toContain("unsupported");
  });

  it("outputs valid JSON", () => {
    const schema = z.object({
      name: z.string(),
      email: z.string().email(),
      age: z.number().optional(),
    });

    const form = introspect(schema, {
      formName: "UserForm",
      schemaImportPath: "./schema",
      schemaExportName: "userSchema",
    });

    const result = compositeTarget.generate(form, {});
    expect(result.files).toHaveLength(1);

    const parsed = JSON.parse(result.files[0].content);
    expect(parsed).toBeDefined();
  });

  it("includes all fields in JSON output", () => {
    const schema = z.object({
      name: z.string(),
      email: z.string().email(),
      active: z.boolean(),
    });

    const form = introspect(schema, {
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "testSchema",
    });

    const result = compositeTarget.generate(form, {});
    const parsed = JSON.parse(result.files[0].content);

    expect(parsed.fields).toHaveLength(3);
    expect(parsed.fields.map((f: { name: string }) => f.name)).toEqual(["name", "email", "active"]);
  });

  it("preserves FormDescriptor structure", () => {
    const schema = z.object({
      name: z.string().min(1),
      role: z.enum(["admin", "user"]),
    });

    const form = introspect(schema, {
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "testSchema",
    });

    const result = compositeTarget.generate(form, {});
    const parsed = JSON.parse(result.files[0].content);

    expect(parsed.name).toBe("TestForm");
    expect(parsed.schemaImportPath).toBe("./schema");
    expect(parsed.schemaExportName).toBe("testSchema");
    expect(parsed.fields[0].constraints.minLength).toBe(1);
    expect(parsed.fields[1].metadata.kind).toBe("enum");
  });

  it("derives filename from form name", () => {
    const schema = z.object({ name: z.string() });
    const form = introspect(schema, {
      formName: "UserProfileForm",
      schemaImportPath: "./schema",
      schemaExportName: "schema",
    });

    const result = compositeTarget.generate(form, {});
    expect(result.files[0].filename).toBe("user-profile.composite.json");
  });

  it("reports all fields", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const form = introspect(schema, {
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "schema",
    });

    const result = compositeTarget.generate(form, {});
    expect(result.fields).toEqual(["name", "age"]);
  });

  it("has no warnings for valid schemas", () => {
    const schema = z.object({ name: z.string() });
    const form = introspect(schema, {
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "schema",
    });

    const result = compositeTarget.generate(form, {});
    expect(result.warnings).toEqual([]);
  });

  it("works through generate() with target option", () => {
    const schema = z.object({ name: z.string() });

    const result = generate({
      schema,
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "testSchema",
      target: compositeTarget,
    });

    const parsed = JSON.parse(result.files[0].content);
    expect(parsed.name).toBe("TestForm");
    expect(result.files).toHaveLength(1);
  });

  it("respects custom indent option", () => {
    const schema = z.object({ name: z.string() });
    const form = introspect(schema, {
      formName: "TestForm",
      schemaImportPath: "./schema",
      schemaExportName: "schema",
    });

    const result4 = compositeTarget.generate(form, { indent: 4 });
    expect(result4.files[0].content).toContain("    ");

    const result0 = compositeTarget.generate(form, { indent: 0 });
    expect(result0.files[0].content).not.toContain("  ");
  });
});
