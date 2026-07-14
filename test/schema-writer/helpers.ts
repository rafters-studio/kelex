import type { FieldDescriptor, FormDescriptor } from "../../src/introspection";

export function makeField(overrides: Partial<FieldDescriptor>): FieldDescriptor {
  return {
    name: "test",
    label: "Test",
    type: "string",
    isOptional: false,
    isNullable: false,
    constraints: {},
    metadata: { kind: "string" },
    ...overrides,
  };
}

export function makeForm(overrides: Partial<FormDescriptor> = {}): FormDescriptor {
  return {
    name: "TestForm",
    fields: [],
    schemaImportPath: "./schema",
    schemaExportName: "testSchema",
    warnings: [],
    ...overrides,
  };
}
