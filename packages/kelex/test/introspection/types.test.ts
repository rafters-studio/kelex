import { describe, expect, it } from "vitest";
import type {
  FieldConstraints,
  FieldDescriptor,
  FieldMetadata,
  FieldType,
  FormDescriptor,
} from "../../src/introspection";

describe("Introspection Types", () => {
  describe("FieldType", () => {
    it("supports all expected types", () => {
      const types: FieldType[] = [
        "string",
        "number",
        "boolean",
        "date",
        "enum",
        "object",
        "array",
        "union",
        "tuple",
        "record",
      ];
      expect(types).toHaveLength(10);
    });
  });

  describe("FieldConstraints", () => {
    it("accepts string constraints", () => {
      const constraints: FieldConstraints = {
        minLength: 1,
        maxLength: 100,
        pattern: "^[a-z]+$",
        format: "email",
      };
      expect(constraints.format).toBe("email");
    });

    it("accepts number constraints", () => {
      const constraints: FieldConstraints = {
        min: 0,
        max: 100,
        step: 1,
        isInt: true,
      };
      expect(constraints.isInt).toBe(true);
    });

    it("accepts empty constraints", () => {
      const constraints: FieldConstraints = {};
      expect(constraints).toEqual({});
    });
  });

  describe("FieldMetadata", () => {
    it("supports string metadata", () => {
      const metadata: FieldMetadata = { kind: "string" };
      expect(metadata.kind).toBe("string");
    });

    it("supports number metadata", () => {
      const metadata: FieldMetadata = { kind: "number" };
      expect(metadata.kind).toBe("number");
    });

    it("supports boolean metadata", () => {
      const metadata: FieldMetadata = { kind: "boolean" };
      expect(metadata.kind).toBe("boolean");
    });

    it("supports date metadata", () => {
      const metadata: FieldMetadata = { kind: "date" };
      expect(metadata.kind).toBe("date");
    });

    it("supports enum metadata with values", () => {
      const metadata: FieldMetadata = {
        kind: "enum",
        values: ["admin", "user", "guest"] as const,
      };
      expect(metadata.kind).toBe("enum");
      if (metadata.kind === "enum") {
        expect(metadata.values).toEqual(["admin", "user", "guest"]);
      }
    });
  });

  describe("FieldDescriptor", () => {
    it("accepts complete field descriptor", () => {
      const field: FieldDescriptor = {
        name: "email",
        label: "Email",
        type: "string",
        isOptional: false,
        isNullable: false,
        constraints: { format: "email" },
        metadata: { kind: "string" },
      };
      expect(field.name).toBe("email");
      expect(field.label).toBe("Email");
      expect(field.type).toBe("string");
      expect(field.isOptional).toBe(false);
      expect(field.constraints.format).toBe("email");
      expect(field.metadata.kind).toBe("string");
    });

    it("accepts field descriptor with description", () => {
      const field: FieldDescriptor = {
        name: "bio",
        label: "Bio",
        description: "Tell us about yourself",
        type: "string",
        isOptional: true,
        isNullable: false,
        constraints: { maxLength: 500 },
        metadata: { kind: "string" },
      };
      expect(field.description).toBe("Tell us about yourself");
    });

    it("accepts enum field descriptor", () => {
      const field: FieldDescriptor = {
        name: "role",
        label: "Role",
        type: "enum",
        isOptional: false,
        isNullable: false,
        constraints: {},
        metadata: { kind: "enum", values: ["admin", "user"] as const },
      };
      expect(field.type).toBe("enum");
      if (field.metadata.kind === "enum") {
        expect(field.metadata.values).toHaveLength(2);
      }
    });
  });

  describe("FormDescriptor", () => {
    it("accepts complete form descriptor", () => {
      const emailField: FieldDescriptor = {
        name: "email",
        label: "Email",
        type: "string",
        isOptional: false,
        isNullable: false,
        constraints: { format: "email" },
        metadata: { kind: "string" },
      };

      const form: FormDescriptor = {
        name: "UserForm",
        fields: [emailField],
        schemaImportPath: "./schema",
        schemaExportName: "userSchema",
        warnings: [],
      };

      expect(form.name).toBe("UserForm");
      expect(form.fields).toHaveLength(1);
      expect(form.schemaImportPath).toBe("./schema");
      expect(form.schemaExportName).toBe("userSchema");
    });

    it("accepts form with multiple fields", () => {
      const fields: FieldDescriptor[] = [
        {
          name: "firstName",
          label: "First Name",
          type: "string",
          isOptional: false,
          isNullable: false,
          constraints: { minLength: 1 },
          metadata: { kind: "string" },
        },
        {
          name: "age",
          label: "Age",
          type: "number",
          isOptional: true,
          isNullable: false,
          constraints: { min: 0, max: 150 },
          metadata: { kind: "number" },
        },
        {
          name: "isActive",
          label: "Is Active",
          type: "boolean",
          isOptional: false,
          isNullable: false,
          constraints: {},
          metadata: { kind: "boolean" },
        },
      ];

      const form: FormDescriptor = {
        name: "ProfileForm",
        fields,
        schemaImportPath: "@/schemas/profile",
        schemaExportName: "profileSchema",
        warnings: [],
      };

      expect(form.fields).toHaveLength(3);
    });
  });
});
