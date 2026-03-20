import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";
import { generate } from "../../src/codegen/generator";
import * as resolver from "../../src/mapping/resolver";
import { compositeTarget } from "../../src/targets/composite";

describe("generate", () => {
  describe("basic functionality", () => {
    it("generates form code from simple schema", () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
        active: z.boolean(),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("'use client'");
      expect(result.code).toContain("export function TestForm");
      expect(result.code).toContain("form.Field");
      expect(result.code).toContain('name="name"');
      expect(result.code).toContain('name="email"');
      expect(result.code).toContain('name="active"');
      expect(result.fields).toEqual(["name", "email", "active"]);
      expect(result.warnings).toEqual([]);
    });

    it("returns list of processed fields", () => {
      const schema = z.object({
        firstName: z.string(),
        lastName: z.string(),
        age: z.number(),
      });

      const result = generate({
        schema,
        formName: "UserForm",
        schemaImportPath: "./user",
        schemaExportName: "userSchema",
      });

      expect(result.fields).toEqual(["firstName", "lastName", "age"]);
    });

    it("returns empty warnings when all fields are valid", () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = generate({
        schema,
        formName: "SimpleForm",
        schemaImportPath: "./simple",
        schemaExportName: "simpleSchema",
      });

      expect(result.warnings).toEqual([]);
    });
  });

  describe("options", () => {
    it("generates primitives and imports from ./primitives when no uiImportPath", () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("from './primitives'");
      expect(result.primitives).toBeDefined();
      expect(result.primitives).toContain("export function Field");
      expect(result.primitives).toContain("export function Button");
      expect(result.primitives).toContain("export function Input");
    });

    it("uses custom UI import path when specified", () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
        uiImportPath: "@/components/ui",
      });

      expect(result.code).toContain("from '@/components/ui'");
      expect(result.primitives).toBeUndefined();
    });

    it("uses provided form name", () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = generate({
        schema,
        formName: "CustomFormName",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("export function CustomFormName");
      expect(result.code).toContain("interface CustomFormNameProps");
    });

    it("uses provided schema import path and export name", () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "@/schemas/user",
        schemaExportName: "userProfileSchema",
      });

      expect(result.code).toContain("from '@/schemas/user'");
      expect(result.code).toContain("userProfileSchema");
      expect(result.code).toContain("type UserProfile");
    });
  });

  describe("field type handling", () => {
    it("handles string fields", () => {
      const schema = z.object({
        name: z.string(),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("<Input");
      expect(result.code).toContain('type="text"');
    });

    it("handles email fields", () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("<Input");
      expect(result.code).toContain('type="email"');
    });

    it("handles number fields", () => {
      const schema = z.object({
        age: z.number(),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("<Input");
      expect(result.code).toContain('type="number"');
    });

    it("handles boolean fields", () => {
      const schema = z.object({
        active: z.boolean(),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("<Checkbox");
    });

    it("handles enum fields with few options as RadioGroup", () => {
      const schema = z.object({
        role: z.enum(["admin", "user"]),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("<RadioGroup");
    });

    it("handles enum fields with many options as Select", () => {
      const schema = z.object({
        country: z.enum(["us", "uk", "ca", "au", "nz"]),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("<Select");
    });

    it("handles date fields", () => {
      const schema = z.object({
        birthDate: z.date(),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("<DatePicker");
    });

    it("handles optional fields", () => {
      const schema = z.object({
        nickname: z.string().optional(),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      // Optional fields should not have required prop
      // Find the nickname field section and verify it doesn't have required
      const nicknameFieldStart = result.code.indexOf('name="nickname"');
      expect(nicknameFieldStart).toBeGreaterThan(-1);
      const afterNickname = result.code.slice(nicknameFieldStart);
      const nextFieldIndex = afterNickname.indexOf("<form.Field", 1);
      const nicknameSection =
        nextFieldIndex === -1
          ? afterNickname
          : afterNickname.slice(0, nextFieldIndex);
      expect(nicknameSection).not.toMatch(/\srequired(\s|>|\/)/);
    });

    it("handles slider for bounded number range", () => {
      const schema = z.object({
        priority: z.number().min(1).max(10),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("<Slider");
    });

    it("handles textarea for long text", () => {
      const schema = z.object({
        bio: z.string().max(500),
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toContain("<Textarea");
    });
  });

  describe("error handling", () => {
    it("throws for non-object schemas", () => {
      const schema = z.string();

      expect(() =>
        generate({
          schema,
          formName: "TestForm",
          schemaImportPath: "./schema",
          schemaExportName: "testSchema",
        }),
      ).toThrow("z.object()");
    });

    it("adds warning and skips field when resolveField fails", () => {
      const schema = z.object({
        name: z.string(),
        broken: z.string(),
      });

      const originalResolveField = resolver.resolveField;
      vi.spyOn(resolver, "resolveField").mockImplementation((field) => {
        if (field.name === "broken") {
          throw new Error("Unsupported field type");
        }
        return originalResolveField(field);
      });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.fields).toContain("name");
      expect(result.fields).not.toContain("broken");
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Unsupported field type"),
        ]),
      );

      vi.restoreAllMocks();
    });
  });

  describe("complete form", () => {
    it("generates complete form with multiple field types", () => {
      const schema = z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        age: z.number().min(0).max(150).optional(),
        role: z.enum(["admin", "user", "guest"]),
        newsletter: z.boolean(),
        birthDate: z.date().optional(),
      });

      const result = generate({
        schema,
        formName: "UserForm",
        schemaImportPath: "./schema",
        schemaExportName: "userSchema",
      });

      // Check all fields are present
      expect(result.fields).toHaveLength(7);
      expect(result.fields).toContain("firstName");
      expect(result.fields).toContain("lastName");
      expect(result.fields).toContain("email");
      expect(result.fields).toContain("age");
      expect(result.fields).toContain("role");
      expect(result.fields).toContain("newsletter");
      expect(result.fields).toContain("birthDate");

      // Check structure
      expect(result.code).toContain("'use client'");
      expect(result.code).toContain("import { useForm }");
      expect(result.code).toContain("import { userSchema, type User }");
      expect(result.code).toContain("export function UserForm");
      expect(result.code).toContain("onSubmit: userSchema");
      expect(result.code).toContain('<Button type="submit">Submit</Button>');

      // No warnings
      expect(result.warnings).toEqual([]);
    });
  });

  describe("target integration", () => {
    it("passes targetOptions to target.generate()", () => {
      const schema = z.object({ name: z.string() });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
        target: compositeTarget,
        targetOptions: { indent: 4 },
      });

      expect(result.code).toContain("    ");
    });

    it("code equals first file content", () => {
      const schema = z.object({ name: z.string() });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      expect(result.code).toBe(result.files[0].content);
    });

    it("primitives matches primitives.tsx file content", () => {
      const schema = z.object({ name: z.string() });

      const result = generate({
        schema,
        formName: "TestForm",
        schemaImportPath: "./schema",
        schemaExportName: "testSchema",
      });

      const primitivesFile = result.files.find(
        (f) => f.filename === "primitives.tsx",
      );
      expect(result.primitives).toBe(primitivesFile?.content);
    });
  });
});
