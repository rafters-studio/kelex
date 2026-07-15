import { describe, expect, it } from "vitest";
import type { FieldDescriptor } from "../../src/introspection";
import { defaultMappingRules, findMatchingRule } from "../../src/mapping/default-map";

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

  // Handle metadata based on type
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

describe("defaultMappingRules", () => {
  it("has 15 rules", () => {
    expect(defaultMappingRules).toHaveLength(15);
  });

  it("has rules in correct order", () => {
    const names = defaultMappingRules.map((r) => r.name);
    expect(names).toEqual([
      "object-fieldset",
      "array-field-array",
      "union-switch",
      "tuple-fieldset",
      "record-field-array",
      "boolean-checkbox",
      "enum-radio-group",
      "enum-select",
      "date-picker",
      "number-slider",
      "number-input",
      "string-email",
      "string-url",
      "string-textarea",
      "string-default",
    ]);
  });

  describe("boolean-checkbox", () => {
    const rule = defaultMappingRules[5];

    it("matches boolean type", () => {
      const field = createField({ type: "boolean" });
      expect(rule.match(field)).toBe(true);
    });

    it("does not match other types", () => {
      expect(rule.match(createField({ type: "string" }))).toBe(false);
      expect(rule.match(createField({ type: "number" }))).toBe(false);
    });

    it("returns Checkbox component", () => {
      expect(rule.component).toBe("Checkbox");
    });

    it("returns empty props", () => {
      const field = createField({ type: "boolean" });
      expect(rule.getProps(field)).toEqual({});
    });
  });

  describe("enum-radio-group", () => {
    const rule = defaultMappingRules[6];

    it("matches enum with 4 or fewer values", () => {
      const field = createField({
        type: "enum",
        metadata: { kind: "enum", values: ["a", "b", "c"] as const },
      });
      expect(rule.match(field)).toBe(true);
    });

    it("matches enum with exactly 4 values", () => {
      const field = createField({
        type: "enum",
        metadata: { kind: "enum", values: ["a", "b", "c", "d"] as const },
      });
      expect(rule.match(field)).toBe(true);
    });

    it("does not match enum with more than 4 values", () => {
      const field = createField({
        type: "enum",
        metadata: {
          kind: "enum",
          values: ["a", "b", "c", "d", "e"] as const,
        },
      });
      expect(rule.match(field)).toBe(false);
    });

    it("returns RadioGroup component", () => {
      expect(rule.component).toBe("RadioGroup");
    });

    it("returns options prop with values", () => {
      const field = createField({
        type: "enum",
        metadata: { kind: "enum", values: ["x", "y"] as const },
      });
      expect(rule.getProps(field)).toEqual({ options: ["x", "y"] });
    });
  });

  describe("enum-select", () => {
    const rule = defaultMappingRules[7];

    it("matches any enum type", () => {
      const field = createField({
        type: "enum",
        metadata: {
          kind: "enum",
          values: ["a", "b", "c", "d", "e", "f"] as const,
        },
      });
      expect(rule.match(field)).toBe(true);
    });

    it("returns Select component", () => {
      expect(rule.component).toBe("Select");
    });

    it("returns options prop with values", () => {
      const field = createField({
        type: "enum",
        metadata: { kind: "enum", values: ["one", "two", "three"] as const },
      });
      expect(rule.getProps(field)).toEqual({
        options: ["one", "two", "three"],
      });
    });
  });

  describe("date-picker", () => {
    const rule = defaultMappingRules[8];

    it("matches date type", () => {
      const field = createField({ type: "date" });
      expect(rule.match(field)).toBe(true);
    });

    it("returns DatePicker component", () => {
      expect(rule.component).toBe("DatePicker");
    });

    it("returns empty props", () => {
      const field = createField({ type: "date" });
      expect(rule.getProps(field)).toEqual({});
    });
  });

  describe("number-slider", () => {
    const rule = defaultMappingRules[9];

    it("matches number with bounded range <= 100", () => {
      const field = createField({
        type: "number",
        constraints: { min: 0, max: 100 },
      });
      expect(rule.match(field)).toBe(true);
    });

    it("matches number with range exactly 100", () => {
      const field = createField({
        type: "number",
        constraints: { min: 50, max: 150 },
      });
      expect(rule.match(field)).toBe(true);
    });

    it("matches number with smaller range", () => {
      const field = createField({
        type: "number",
        constraints: { min: 1, max: 10 },
      });
      expect(rule.match(field)).toBe(true);
    });

    it("does not match number with range > 100", () => {
      const field = createField({
        type: "number",
        constraints: { min: 0, max: 200 },
      });
      expect(rule.match(field)).toBe(false);
    });

    it("does not match number without min", () => {
      const field = createField({
        type: "number",
        constraints: { max: 100 },
      });
      expect(rule.match(field)).toBe(false);
    });

    it("does not match number without max", () => {
      const field = createField({
        type: "number",
        constraints: { min: 0 },
      });
      expect(rule.match(field)).toBe(false);
    });

    it("returns Slider component", () => {
      expect(rule.component).toBe("Slider");
    });

    it("returns min, max, step props", () => {
      const field = createField({
        type: "number",
        constraints: { min: 0, max: 10, step: 0.5 },
      });
      expect(rule.getProps(field)).toEqual({ min: 0, max: 10, step: 0.5 });
    });

    it("defaults step to 1 if not specified", () => {
      const field = createField({
        type: "number",
        constraints: { min: 0, max: 10 },
      });
      expect(rule.getProps(field)).toEqual({ min: 0, max: 10, step: 1 });
    });
  });

  describe("number-input", () => {
    const rule = defaultMappingRules[10];

    it("matches any number type", () => {
      const field = createField({ type: "number" });
      expect(rule.match(field)).toBe(true);
    });

    it("returns Input component", () => {
      expect(rule.component).toBe("Input");
    });

    it("returns type number with constraints", () => {
      const field = createField({
        type: "number",
        constraints: { min: 0, max: 1000, step: 10 },
      });
      expect(rule.getProps(field)).toEqual({
        type: "number",
        min: 0,
        max: 1000,
        step: 10,
      });
    });

    it("returns undefined for missing constraints", () => {
      const field = createField({ type: "number" });
      expect(rule.getProps(field)).toEqual({
        type: "number",
        min: undefined,
        max: undefined,
        step: undefined,
      });
    });
  });

  describe("string-email", () => {
    const rule = defaultMappingRules[11];

    it("matches string with email format", () => {
      const field = createField({
        type: "string",
        constraints: { format: "email" },
      });
      expect(rule.match(field)).toBe(true);
    });

    it("does not match string without email format", () => {
      const field = createField({ type: "string" });
      expect(rule.match(field)).toBe(false);
    });

    it("does not match string with other format", () => {
      const field = createField({
        type: "string",
        constraints: { format: "url" },
      });
      expect(rule.match(field)).toBe(false);
    });

    it("returns Input component", () => {
      expect(rule.component).toBe("Input");
    });

    it("returns type email", () => {
      const field = createField({
        type: "string",
        constraints: { format: "email" },
      });
      expect(rule.getProps(field)).toEqual({ type: "email" });
    });
  });

  describe("string-url", () => {
    const rule = defaultMappingRules[12];

    it("matches string with url format", () => {
      const field = createField({
        type: "string",
        constraints: { format: "url" },
      });
      expect(rule.match(field)).toBe(true);
    });

    it("does not match string without url format", () => {
      const field = createField({ type: "string" });
      expect(rule.match(field)).toBe(false);
    });

    it("returns Input component", () => {
      expect(rule.component).toBe("Input");
    });

    it("returns type url", () => {
      const field = createField({
        type: "string",
        constraints: { format: "url" },
      });
      expect(rule.getProps(field)).toEqual({ type: "url" });
    });
  });

  describe("string-textarea", () => {
    const rule = defaultMappingRules[13];

    it("matches string with maxLength > 100", () => {
      const field = createField({
        type: "string",
        constraints: { maxLength: 500 },
      });
      expect(rule.match(field)).toBe(true);
    });

    it("does not match string with maxLength <= 100", () => {
      const field = createField({
        type: "string",
        constraints: { maxLength: 100 },
      });
      expect(rule.match(field)).toBe(false);
    });

    it("does not match string without maxLength", () => {
      const field = createField({ type: "string" });
      expect(rule.match(field)).toBe(false);
    });

    it("returns Textarea component", () => {
      expect(rule.component).toBe("Textarea");
    });

    it("returns maxLength prop", () => {
      const field = createField({
        type: "string",
        constraints: { maxLength: 500 },
      });
      expect(rule.getProps(field)).toEqual({ maxLength: 500 });
    });
  });

  describe("string-default", () => {
    const rule = defaultMappingRules[14];

    it("matches any string type", () => {
      const field = createField({ type: "string" });
      expect(rule.match(field)).toBe(true);
    });

    it("returns Input component", () => {
      expect(rule.component).toBe("Input");
    });

    it("returns type text with constraints", () => {
      const field = createField({
        type: "string",
        constraints: { minLength: 1, maxLength: 50, pattern: "^[a-z]+$" },
      });
      expect(rule.getProps(field)).toEqual({
        type: "text",
        minLength: 1,
        maxLength: 50,
        pattern: "^[a-z]+$",
      });
    });

    it("returns undefined for missing constraints", () => {
      const field = createField({ type: "string" });
      expect(rule.getProps(field)).toEqual({
        type: "text",
        minLength: undefined,
        maxLength: undefined,
        pattern: undefined,
      });
    });
  });
});

describe("findMatchingRule", () => {
  it("returns first matching rule", () => {
    const field = createField({ type: "boolean" });
    const rule = findMatchingRule(field);
    expect(rule?.name).toBe("boolean-checkbox");
  });

  it("returns undefined for unsupported field", () => {
    // Create a field with an unsupported type (cast to bypass type checking)
    const field = createField({ type: "string" as const });
    (field as { type: string }).type = "unsupported";
    const rule = findMatchingRule(field);
    expect(rule).toBeUndefined();
  });

  it("prioritizes enum-radio-group over enum-select for small enums", () => {
    const field = createField({
      type: "enum",
      metadata: { kind: "enum", values: ["a", "b"] as const },
    });
    const rule = findMatchingRule(field);
    expect(rule?.name).toBe("enum-radio-group");
  });

  it("uses enum-select for large enums", () => {
    const field = createField({
      type: "enum",
      metadata: {
        kind: "enum",
        values: ["a", "b", "c", "d", "e"] as const,
      },
    });
    const rule = findMatchingRule(field);
    expect(rule?.name).toBe("enum-select");
  });

  it("prioritizes number-slider over number-input for bounded ranges", () => {
    const field = createField({
      type: "number",
      constraints: { min: 1, max: 10 },
    });
    const rule = findMatchingRule(field);
    expect(rule?.name).toBe("number-slider");
  });

  it("uses number-input for unbounded numbers", () => {
    const field = createField({ type: "number" });
    const rule = findMatchingRule(field);
    expect(rule?.name).toBe("number-input");
  });

  it("prioritizes string-email over string-default", () => {
    const field = createField({
      type: "string",
      constraints: { format: "email" },
    });
    const rule = findMatchingRule(field);
    expect(rule?.name).toBe("string-email");
  });

  it("prioritizes string-textarea over string-default for long text", () => {
    const field = createField({
      type: "string",
      constraints: { maxLength: 500 },
    });
    const rule = findMatchingRule(field);
    expect(rule?.name).toBe("string-textarea");
  });

  it("uses string-default as fallback for strings", () => {
    const field = createField({ type: "string" });
    const rule = findMatchingRule(field);
    expect(rule?.name).toBe("string-default");
  });

  it("accepts custom rules array", () => {
    const customRules = [
      {
        name: "custom-rule",
        match: () => true,
        component: "Input" as const,
        getProps: () => ({ custom: true }),
      },
    ];
    const field = createField({ type: "string" });
    const rule = findMatchingRule(field, customRules);
    expect(rule?.name).toBe("custom-rule");
  });
});
