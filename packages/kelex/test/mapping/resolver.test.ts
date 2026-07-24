import { describe, expect, it } from "vitest";
import type { FieldDescriptor } from "../../src/introspection";
import type { MappingRule } from "../../src/mapping";
import { resolveField } from "../../src/mapping/resolver";

// Helper to create test fields
function createField(
  overrides: Partial<FieldDescriptor> & Pick<FieldDescriptor, "type">,
): FieldDescriptor {
  const base: FieldDescriptor = {
    name: "testField",
    label: "Test Field",
    type: "string",
    isOptional: false,
    isNullable: false,
    constraints: {},
    metadata: { kind: "string" },
  };

  if (overrides.type === "enum" && !overrides.metadata) {
    return {
      ...base,
      ...overrides,
      metadata: { kind: "enum", values: ["a", "b", "c"] as const },
    };
  }
  if (overrides.type === "number" && !overrides.metadata) {
    return { ...base, ...overrides, metadata: { kind: "number" } };
  }
  if (overrides.type === "boolean" && !overrides.metadata) {
    return { ...base, ...overrides, metadata: { kind: "boolean" } };
  }
  if (overrides.type === "date" && !overrides.metadata) {
    return { ...base, ...overrides, metadata: { kind: "date" } };
  }

  return { ...base, ...overrides };
}

describe("resolveField", () => {
  describe("with default rules", () => {
    it("resolves email field to Input[email]", () => {
      const field = createField({
        name: "email",
        label: "Email",
        type: "string",
        constraints: { format: "email" },
      });

      const config = resolveField(field);

      expect(config.component).toBe("Input");
      expect(config.componentProps.type).toBe("email");
      expect(config.fieldProps.label).toBe("Email");
      expect(config.fieldProps.required).toBe(true);
    });

    it("resolves optional boolean to Checkbox with required=false", () => {
      const field = createField({
        name: "isActive",
        label: "Is Active",
        type: "boolean",
        isOptional: true,
      });

      const config = resolveField(field);

      expect(config.component).toBe("Checkbox");
      expect(config.fieldProps.required).toBe(false);
    });

    it("resolves small enum to RadioGroup with options", () => {
      const field = createField({
        name: "role",
        label: "Role",
        type: "enum",
        metadata: { kind: "enum", values: ["admin", "user", "guest"] as const },
      });

      const config = resolveField(field);

      expect(config.component).toBe("RadioGroup");
      expect(config.componentProps.options).toEqual(["admin", "user", "guest"]);
    });

    it("resolves large enum to Select", () => {
      const field = createField({
        name: "country",
        label: "Country",
        type: "enum",
        metadata: {
          kind: "enum",
          values: ["US", "UK", "CA", "DE", "FR"] as const,
        },
      });

      const config = resolveField(field);

      expect(config.component).toBe("Select");
      expect(config.componentProps.options).toEqual(["US", "UK", "CA", "DE", "FR"]);
    });

    it("resolves date to DatePicker", () => {
      const field = createField({
        name: "birthDate",
        label: "Birth Date",
        type: "date",
      });

      const config = resolveField(field);

      expect(config.component).toBe("DatePicker");
    });

    it("resolves bounded number to Slider", () => {
      const field = createField({
        name: "priority",
        label: "Priority",
        type: "number",
        constraints: { min: 1, max: 10 },
      });

      const config = resolveField(field);

      expect(config.component).toBe("Slider");
      expect(config.componentProps).toEqual({ min: 1, max: 10, step: 1 });
    });

    it("resolves unbounded number to Input[number]", () => {
      const field = createField({
        name: "age",
        label: "Age",
        type: "number",
        constraints: { min: 0 },
      });

      const config = resolveField(field);

      expect(config.component).toBe("Input");
      expect(config.componentProps.type).toBe("number");
    });

    it("resolves long string to Textarea", () => {
      const field = createField({
        name: "bio",
        label: "Bio",
        type: "string",
        constraints: { maxLength: 500 },
      });

      const config = resolveField(field);

      expect(config.component).toBe("Textarea");
      expect(config.componentProps.maxLength).toBe(500);
    });

    it("resolves plain string to Input[text]", () => {
      const field = createField({
        name: "firstName",
        label: "First Name",
        type: "string",
        constraints: { minLength: 1, maxLength: 50 },
      });

      const config = resolveField(field);

      expect(config.component).toBe("Input");
      expect(config.componentProps.type).toBe("text");
      expect(config.componentProps.minLength).toBe(1);
      expect(config.componentProps.maxLength).toBe(50);
    });

    it("includes description in fieldProps when present", () => {
      const field = createField({
        name: "notes",
        label: "Notes",
        description: "Add any additional notes here",
        type: "string",
      });

      const config = resolveField(field);

      expect(config.fieldProps.description).toBe("Add any additional notes here");
    });

    it("omits description in fieldProps when not present", () => {
      const field = createField({
        name: "name",
        label: "Name",
        type: "string",
      });

      const config = resolveField(field);

      expect(config.fieldProps.description).toBeUndefined();
    });
  });

  describe("with custom rules", () => {
    it("uses custom rules when provided", () => {
      const customRules: MappingRule[] = [
        {
          name: "always-textarea",
          match: () => true,
          component: "Textarea",
          getProps: () => ({ rows: 5 }),
        },
      ];

      const field = createField({ type: "string" });
      const config = resolveField(field, customRules);

      expect(config.component).toBe("Textarea");
      expect(config.componentProps.rows).toBe(5);
    });

    it("returns first matching rule", () => {
      const customRules: MappingRule[] = [
        {
          name: "first-rule",
          match: (f) => f.type === "string",
          component: "Input",
          getProps: () => ({ first: true }),
        },
        {
          name: "second-rule",
          match: (f) => f.type === "string",
          component: "Textarea",
          getProps: () => ({ second: true }),
        },
      ];

      const field = createField({ type: "string" });
      const config = resolveField(field, customRules);

      expect(config.component).toBe("Input");
      expect(config.componentProps.first).toBe(true);
    });
  });

  describe("error handling", () => {
    it("throws when no rule matches", () => {
      const noMatchRules: MappingRule[] = [
        {
          name: "never-match",
          match: () => false,
          component: "Input",
          getProps: () => ({}),
        },
      ];

      const field = createField({
        name: "unknownField",
        type: "string",
      });

      expect(() => resolveField(field, noMatchRules)).toThrow(
        'No mapping rule matched field "unknownField" of type "string"',
      );
    });

    it("includes field name and type in error message", () => {
      const noMatchRules: MappingRule[] = [];

      const field = createField({
        name: "myField",
        type: "number",
      });

      expect(() => resolveField(field, noMatchRules)).toThrow(
        'No mapping rule matched field "myField" of type "number"',
      );
    });
  });
});
