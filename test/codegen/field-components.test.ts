import { describe, expect, it } from "vitest";
import { generateFieldJSX } from "../../src/codegen/templates/field-components";
import type { FieldDescriptor } from "../../src/introspection";
import type { ComponentConfig } from "../../src/mapping";

function createField(
  overrides: Partial<FieldDescriptor> = {},
): FieldDescriptor {
  return {
    name: "testField",
    label: "Test Field",
    type: "string",
    isOptional: false,
    isNullable: false,
    constraints: {},
    metadata: { kind: "string" },
    ...overrides,
  };
}

function createConfig(
  overrides: Partial<ComponentConfig> = {},
): ComponentConfig {
  return {
    component: "Input",
    componentProps: { type: "text" },
    fieldProps: {
      label: "Test Field",
      required: true,
    },
    ...overrides,
  };
}

describe("generateFieldJSX", () => {
  describe("field wrapper", () => {
    it("generates form.Field with correct name", () => {
      const field = createField({ name: "email" });
      const config = createConfig();

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("<form.Field");
      expect(jsx).toContain('name="email"');
    });

    it("includes label in Field props", () => {
      const field = createField();
      const config = createConfig({
        fieldProps: { label: "Email Address", required: true },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain('label="Email Address"');
    });

    it("includes description when present", () => {
      const field = createField();
      const config = createConfig({
        fieldProps: {
          label: "Email",
          description: "Enter your email",
          required: true,
        },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain('description="Enter your email"');
    });

    it("omits description when not present", () => {
      const field = createField();
      const config = createConfig({
        fieldProps: { label: "Email", required: true },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).not.toContain("description=");
    });

    it("includes required prop when true", () => {
      const field = createField();
      const config = createConfig({
        fieldProps: { label: "Email", required: true },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toMatch(/required\s*\n/);
    });

    it("omits required prop when false", () => {
      const field = createField();
      const config = createConfig({
        fieldProps: { label: "Email", required: false },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).not.toMatch(/required\s*\n/);
    });

    it("includes error prop", () => {
      const field = createField();
      const config = createConfig();

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("error={field.state.meta.errors?.[0]}");
    });
  });

  describe("Input component", () => {
    it("generates Input with type", () => {
      const field = createField({ name: "email" });
      const config = createConfig({
        component: "Input",
        componentProps: { type: "email" },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("<Input");
      expect(jsx).toContain('type="email"');
    });

    it("includes value and onChange handlers", () => {
      const field = createField();
      const config = createConfig({ component: "Input" });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain('value={field.state.value ?? ""}');
      expect(jsx).toContain(
        "onChange={(e) => field.handleChange(e.target.value)}",
      );
      expect(jsx).toContain("onBlur={field.handleBlur}");
    });

    it("uses valueAsNumber onChange for number input", () => {
      const field = createField({
        type: "number",
        metadata: { kind: "number" },
      });
      const config = createConfig({
        component: "Input",
        componentProps: { type: "number" },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain(
        "onChange={(e) => field.handleChange(e.target.valueAsNumber)}",
      );
    });

    it("uses string value onChange for text input", () => {
      const field = createField();
      const config = createConfig({
        component: "Input",
        componentProps: { type: "text" },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain(
        "onChange={(e) => field.handleChange(e.target.value)}",
      );
    });

    it("includes min/max/step for number input", () => {
      const field = createField();
      const config = createConfig({
        component: "Input",
        componentProps: { type: "number", min: 0, max: 100, step: 1 },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("min={0}");
      expect(jsx).toContain("max={100}");
      expect(jsx).toContain("step={1}");
    });

    it("includes minLength/maxLength/pattern for text input", () => {
      const field = createField();
      const config = createConfig({
        component: "Input",
        componentProps: {
          type: "text",
          minLength: 1,
          maxLength: 50,
          pattern: "^[a-z]+$",
        },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("minLength={1}");
      expect(jsx).toContain("maxLength={50}");
      expect(jsx).toContain('pattern="^[a-z]+$"');
    });
  });

  describe("Textarea component", () => {
    it("generates Textarea", () => {
      const field = createField();
      const config = createConfig({
        component: "Textarea",
        componentProps: { maxLength: 500 },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("<Textarea");
      expect(jsx).toContain("maxLength={500}");
    });

    it("includes value and onChange handlers", () => {
      const field = createField();
      const config = createConfig({ component: "Textarea" });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain('value={field.state.value ?? ""}');
      expect(jsx).toContain(
        "onChange={(e) => field.handleChange(e.target.value)}",
      );
    });
  });

  describe("Checkbox component", () => {
    it("generates Checkbox", () => {
      const field = createField();
      const config = createConfig({
        component: "Checkbox",
        componentProps: {},
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("<Checkbox");
    });

    it("uses checked and onCheckedChange", () => {
      const field = createField();
      const config = createConfig({ component: "Checkbox" });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("checked={field.state.value ?? false}");
      expect(jsx).toContain(
        "onCheckedChange={(checked) => field.handleChange(checked)}",
      );
    });
  });

  describe("Select component", () => {
    it("generates Select with options", () => {
      const field = createField();
      const config = createConfig({
        component: "Select",
        componentProps: { options: ["admin", "user", "guest"] },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("<Select");
      expect(jsx).toContain("<Select.Trigger>");
      expect(jsx).toContain("<Select.Value");
      expect(jsx).toContain("<Select.Content>");
      expect(jsx).toContain('<Select.Item value="admin">Admin</Select.Item>');
      expect(jsx).toContain('<Select.Item value="user">User</Select.Item>');
      expect(jsx).toContain('<Select.Item value="guest">Guest</Select.Item>');
    });

    it("includes value and onValueChange", () => {
      const field = createField();
      const config = createConfig({
        component: "Select",
        componentProps: { options: ["a"] },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("value={field.state.value}");
      expect(jsx).toContain("onValueChange={field.handleChange}");
    });
  });

  describe("RadioGroup component", () => {
    it("generates RadioGroup with options", () => {
      const field = createField({ name: "role" });
      const config = createConfig({
        component: "RadioGroup",
        componentProps: { options: ["admin", "user"] },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("<RadioGroup");
      expect(jsx).toContain('<RadioGroup.Item value="admin" id="role-admin"');
      expect(jsx).toContain('<Label htmlFor="role-admin">Admin</Label>');
      expect(jsx).toContain('<RadioGroup.Item value="user" id="role-user"');
      expect(jsx).toContain('<Label htmlFor="role-user">User</Label>');
    });

    it("includes value and onValueChange", () => {
      const field = createField();
      const config = createConfig({
        component: "RadioGroup",
        componentProps: { options: ["a"] },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("value={field.state.value}");
      expect(jsx).toContain("onValueChange={field.handleChange}");
    });

    it("generates unique IDs from field name and option", () => {
      const field = createField({ name: "priority" });
      const config = createConfig({
        component: "RadioGroup",
        componentProps: { options: ["low", "high"] },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain('id="priority-low"');
      expect(jsx).toContain('id="priority-high"');
    });
  });

  describe("Slider component", () => {
    it("generates Slider with min/max/step", () => {
      const field = createField();
      const config = createConfig({
        component: "Slider",
        componentProps: { min: 1, max: 10, step: 1 },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("<Slider");
      expect(jsx).toContain("min={1}");
      expect(jsx).toContain("max={10}");
      expect(jsx).toContain("step={1}");
    });

    it("uses array value and destructuring in onChange", () => {
      const field = createField();
      const config = createConfig({
        component: "Slider",
        componentProps: { min: 0, max: 100 },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("value={[field.state.value ?? 0]}");
      expect(jsx).toContain("onValueChange={([v]) => field.handleChange(v)}");
    });

    it("uses min as default value", () => {
      const field = createField();
      const config = createConfig({
        component: "Slider",
        componentProps: { min: 5, max: 15 },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("value={[field.state.value ?? 5]}");
    });
  });

  describe("DatePicker component", () => {
    it("generates DatePicker", () => {
      const field = createField();
      const config = createConfig({
        component: "DatePicker",
        componentProps: {},
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("<DatePicker");
    });

    it("includes value and onValueChange", () => {
      const field = createField();
      const config = createConfig({ component: "DatePicker" });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain("value={field.state.value}");
      expect(jsx).toContain("onValueChange={field.handleChange}");
    });
  });

  describe("option label formatting", () => {
    it("capitalizes first letter", () => {
      const field = createField();
      const config = createConfig({
        component: "Select",
        componentProps: { options: ["admin"] },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain(">Admin</Select.Item>");
    });

    it("converts camelCase to Title Case", () => {
      const field = createField();
      const config = createConfig({
        component: "Select",
        componentProps: { options: ["superAdmin"] },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain(">Super Admin</Select.Item>");
    });

    it("converts snake_case to readable format", () => {
      const field = createField();
      const config = createConfig({
        component: "Select",
        componentProps: { options: ["super_admin"] },
      });

      const jsx = generateFieldJSX(field, config);

      expect(jsx).toContain(">Super admin</Select.Item>");
    });
  });
});
