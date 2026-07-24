import { describe, expect, it } from "vitest";
import type { FieldDescriptor } from "../../src/introspection";
import type { ComponentConfig, ComponentType, MappingRule } from "../../src/mapping";

describe("Mapping Types", () => {
  describe("ComponentType", () => {
    it("supports all expected component types", () => {
      const types: ComponentType[] = [
        "Input",
        "Textarea",
        "Select",
        "Checkbox",
        "RadioGroup",
        "Slider",
        "DatePicker",
        "Fieldset",
        "FieldArray",
        "UnionSwitch",
      ];
      expect(types).toHaveLength(10);
    });
  });

  describe("ComponentConfig", () => {
    it("accepts complete component config", () => {
      const config: ComponentConfig = {
        component: "Input",
        componentProps: { type: "email" },
        fieldProps: {
          label: "Email",
          required: true,
        },
      };
      expect(config.component).toBe("Input");
      expect(config.componentProps.type).toBe("email");
      expect(config.fieldProps.label).toBe("Email");
      expect(config.fieldProps.required).toBe(true);
    });

    it("accepts config with optional description", () => {
      const config: ComponentConfig = {
        component: "Textarea",
        componentProps: { maxLength: 500 },
        fieldProps: {
          label: "Bio",
          description: "Tell us about yourself",
          required: false,
        },
      };
      expect(config.fieldProps.description).toBe("Tell us about yourself");
    });

    it("accepts slider config with numeric props", () => {
      const config: ComponentConfig = {
        component: "Slider",
        componentProps: { min: 0, max: 100, step: 1 },
        fieldProps: {
          label: "Priority",
          required: true,
        },
      };
      expect(config.component).toBe("Slider");
      expect(config.componentProps.min).toBe(0);
      expect(config.componentProps.max).toBe(100);
    });

    it("accepts select config with options array", () => {
      const config: ComponentConfig = {
        component: "Select",
        componentProps: { options: ["admin", "user", "guest"] },
        fieldProps: {
          label: "Role",
          required: true,
        },
      };
      expect(config.component).toBe("Select");
      expect(config.componentProps.options).toEqual(["admin", "user", "guest"]);
    });
  });

  describe("MappingRule", () => {
    const emailField: FieldDescriptor = {
      name: "email",
      label: "Email",
      type: "string",
      isOptional: false,
      isNullable: false,
      constraints: { format: "email" },
      metadata: { kind: "string" },
    };

    const ageField: FieldDescriptor = {
      name: "age",
      label: "Age",
      type: "number",
      isOptional: true,
      isNullable: false,
      constraints: { min: 0, max: 150 },
      metadata: { kind: "number" },
    };

    it("accepts complete mapping rule", () => {
      const rule: MappingRule = {
        name: "email-input",
        match: (f) => f.type === "string" && f.constraints.format === "email",
        component: "Input",
        getProps: () => ({ type: "email" }),
      };
      expect(rule.name).toBe("email-input");
      expect(rule.component).toBe("Input");
      expect(rule.match(emailField)).toBe(true);
      expect(rule.match(ageField)).toBe(false);
      expect(rule.getProps(emailField)).toEqual({ type: "email" });
    });

    it("accepts rule with dynamic props", () => {
      const rule: MappingRule = {
        name: "number-input",
        match: (f) => f.type === "number",
        component: "Input",
        getProps: (f) => ({
          type: "number",
          min: f.constraints.min,
          max: f.constraints.max,
        }),
      };
      expect(rule.match(ageField)).toBe(true);
      expect(rule.getProps(ageField)).toEqual({
        type: "number",
        min: 0,
        max: 150,
      });
    });

    it("accepts rule for checkbox component", () => {
      const boolField: FieldDescriptor = {
        name: "isActive",
        label: "Is Active",
        type: "boolean",
        isOptional: false,
        isNullable: false,
        constraints: {},
        metadata: { kind: "boolean" },
      };

      const rule: MappingRule = {
        name: "boolean-checkbox",
        match: (f) => f.type === "boolean",
        component: "Checkbox",
        getProps: () => ({}),
      };
      expect(rule.match(boolField)).toBe(true);
      expect(rule.component).toBe("Checkbox");
    });

    it("accepts rule for enum with metadata access", () => {
      const roleField: FieldDescriptor = {
        name: "role",
        label: "Role",
        type: "enum",
        isOptional: false,
        isNullable: false,
        constraints: {},
        metadata: { kind: "enum", values: ["admin", "user"] as const },
      };

      const rule: MappingRule = {
        name: "enum-select",
        match: (f) => f.type === "enum",
        component: "Select",
        getProps: (f) => {
          if (f.metadata.kind === "enum") {
            return { options: f.metadata.values };
          }
          return {};
        },
      };
      expect(rule.match(roleField)).toBe(true);
      expect(rule.getProps(roleField)).toEqual({
        options: ["admin", "user"],
      });
    });
  });
});
