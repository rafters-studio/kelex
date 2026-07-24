import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection/introspect";

const defaultOptions = {
  formName: "TestForm",
  schemaImportPath: "./schema",
  schemaExportName: "testSchema",
};

describe("introspect", () => {
  describe("basic functionality", () => {
    it("introspects a simple object schema", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = introspect(schema, defaultOptions);

      expect(result.name).toBe("TestForm");
      expect(result.schemaImportPath).toBe("./schema");
      expect(result.schemaExportName).toBe("testSchema");
      expect(result.fields).toHaveLength(2);
    });

    it("returns fields in order", () => {
      const schema = z.object({
        first: z.string(),
        second: z.number(),
        third: z.boolean(),
      });

      const result = introspect(schema, defaultOptions);
      const names = result.fields.map((f) => f.name);

      expect(names).toEqual(["first", "second", "third"]);
    });
  });

  describe("field type detection", () => {
    it("detects string type", () => {
      const schema = z.object({ field: z.string() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].type).toBe("string");
      expect(result.fields[0].metadata).toEqual({ kind: "string" });
    });

    it("detects number type", () => {
      const schema = z.object({ field: z.number() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].type).toBe("number");
      expect(result.fields[0].metadata).toEqual({ kind: "number" });
    });

    it("detects boolean type", () => {
      const schema = z.object({ field: z.boolean() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].type).toBe("boolean");
      expect(result.fields[0].metadata).toEqual({ kind: "boolean" });
    });

    it("detects date type", () => {
      const schema = z.object({ field: z.date() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].type).toBe("date");
      expect(result.fields[0].metadata).toEqual({ kind: "date" });
    });

    it("detects enum type with values", () => {
      const schema = z.object({ field: z.enum(["a", "b", "c"]) });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].type).toBe("enum");
      expect(result.fields[0].metadata).toEqual({
        kind: "enum",
        values: ["a", "b", "c"],
      });
    });
  });

  describe("optional handling", () => {
    it("marks required fields as not optional", () => {
      const schema = z.object({ field: z.string() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].isOptional).toBe(false);
    });

    it("marks optional fields as optional", () => {
      const schema = z.object({ field: z.string().optional() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].isOptional).toBe(true);
    });

    it("unwraps optional to get inner type", () => {
      const schema = z.object({ field: z.number().optional() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].type).toBe("number");
      expect(result.fields[0].isOptional).toBe(true);
    });
  });

  describe("nullable handling", () => {
    it("marks nullable fields as nullable", () => {
      const schema = z.object({ field: z.string().nullable() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].isNullable).toBe(true);
      expect(result.fields[0].isOptional).toBe(false);
      expect(result.fields[0].type).toBe("string");
    });

    it("handles nullish (optional + nullable)", () => {
      const schema = z.object({ field: z.string().nullish() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].isNullable).toBe(true);
      expect(result.fields[0].isOptional).toBe(true);
      expect(result.fields[0].type).toBe("string");
    });

    it("handles nullable optional", () => {
      const schema = z.object({ field: z.string().nullable().optional() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].isNullable).toBe(true);
      expect(result.fields[0].isOptional).toBe(true);
    });

    it("marks non-nullable fields as not nullable", () => {
      const schema = z.object({ field: z.string() });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].isNullable).toBe(false);
    });
  });

  describe("constraint extraction", () => {
    it("extracts string constraints", () => {
      const schema = z.object({
        field: z.string().min(1).max(100).email(),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].constraints).toEqual({
        minLength: 1,
        maxLength: 100,
        format: "email",
      });
    });

    it("extracts number constraints", () => {
      const schema = z.object({
        field: z.number().min(0).max(10).int(),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].constraints).toEqual({
        min: 0,
        max: 10,
        isInt: true,
      });
    });

    it("extracts constraints from optional field", () => {
      const schema = z.object({
        field: z.string().email().optional(),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].constraints).toEqual({ format: "email" });
      expect(result.fields[0].isOptional).toBe(true);
    });

    it("extracts constraints from field with default value", () => {
      const schema = z.object({
        field: z.string().email().default("user@example.com"),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].type).toBe("string");
      expect(result.fields[0].constraints).toEqual({ format: "email" });
      expect(result.warnings).toHaveLength(0);
    });

    it("correctly types number field with default value", () => {
      const schema = z.object({
        count: z.number().min(0).max(100).default(0),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].type).toBe("number");
      expect(result.fields[0].constraints).toEqual({ min: 0, max: 100 });
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("label generation", () => {
    it("converts camelCase to Title Case", () => {
      const schema = z.object({
        firstName: z.string(),
        lastName: z.string(),
        emailAddress: z.string(),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].label).toBe("First Name");
      expect(result.fields[1].label).toBe("Last Name");
      expect(result.fields[2].label).toBe("Email Address");
    });

    it("capitalizes single word names", () => {
      const schema = z.object({
        email: z.string(),
        age: z.number(),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].label).toBe("Email");
      expect(result.fields[1].label).toBe("Age");
    });

    it("handles names starting with uppercase", () => {
      const schema = z.object({
        URL: z.string(),
        ID: z.number(),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].label).toBe("URL");
      expect(result.fields[1].label).toBe("ID");
    });

    it("handles acronyms followed by words", () => {
      const schema = z.object({
        URLPath: z.string(),
        myURLPath: z.string(),
        userID: z.number(),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].label).toBe("URL Path");
      expect(result.fields[1].label).toBe("My URL Path");
      expect(result.fields[2].label).toBe("User ID");
    });
  });

  describe("description handling", () => {
    it("includes description when present", () => {
      const schema = z.object({
        field: z.string().describe("A helpful description"),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].description).toBe("A helpful description");
    });

    it("omits description when not present", () => {
      const schema = z.object({
        field: z.string(),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].description).toBeUndefined();
    });

    it("includes description on optional fields", () => {
      const schema = z.object({
        field: z.string().describe("Help text").optional(),
      });
      const result = introspect(schema, defaultOptions);

      expect(result.fields[0].description).toBe("Help text");
      expect(result.fields[0].isOptional).toBe(true);
    });
  });

  describe("full schema test", () => {
    it("handles complex schema with all field types", () => {
      const userSchema = z.object({
        firstName: z.string().min(1),
        email: z.string().email(),
        age: z.number().min(0).max(150).optional(),
        role: z.enum(["admin", "user"]),
        isActive: z.boolean(),
        createdAt: z.date(),
      });

      const result = introspect(userSchema, {
        formName: "UserForm",
        schemaImportPath: "./schema",
        schemaExportName: "userSchema",
      });

      expect(result.name).toBe("UserForm");
      expect(result.fields).toHaveLength(6);

      // firstName
      expect(result.fields[0]).toEqual({
        name: "firstName",
        label: "First Name",
        type: "string",
        isOptional: false,
        isNullable: false,
        constraints: { minLength: 1 },
        metadata: { kind: "string" },
      });

      // email
      expect(result.fields[1].constraints.format).toBe("email");

      // age (optional)
      expect(result.fields[2].isOptional).toBe(true);
      expect(result.fields[2].type).toBe("number");

      // role (enum)
      expect(result.fields[3].metadata).toEqual({
        kind: "enum",
        values: ["admin", "user"],
      });

      // isActive (boolean)
      expect(result.fields[4].type).toBe("boolean");

      // createdAt (date)
      expect(result.fields[5].type).toBe("date");
    });
  });

  describe("error handling", () => {
    it("throws for non-object schema", () => {
      const schema = z.string();

      expect(() => introspect(schema, defaultOptions)).toThrow(
        "kelex only supports z.object() schemas at the top level",
      );
    });

    it("throws for array schema at top level", () => {
      const schema = z.array(z.string());

      expect(() => introspect(schema, defaultOptions)).toThrow(
        "kelex only supports z.object() schemas at the top level",
      );
    });

    it("handles array field type", () => {
      const schema = z.object({
        items: z.array(z.string()),
      });

      const result = introspect(schema, defaultOptions);
      expect(result.fields[0].type).toBe("array");
      expect(result.fields[0].metadata.kind).toBe("array");
    });

    it("handles nested object field type", () => {
      const schema = z.object({
        address: z.object({ street: z.string() }),
      });

      const result = introspect(schema, defaultOptions);
      expect(result.fields[0].type).toBe("object");
      expect(result.fields[0].metadata.kind).toBe("object");
    });
  });
});
