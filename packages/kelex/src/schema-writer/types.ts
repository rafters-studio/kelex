import type { FormDescriptor } from "../introspection";

/**
 * A named schema to be emitted as a separate export declaration.
 * Used when composing multiple schemas in a single file.
 */
export interface EmbeddedSchema {
  /** The FormDescriptor describing the schema's fields */
  form: FormDescriptor;
}

export interface SchemaWriterOptions {
  /** The primary FormDescriptor to convert */
  form: FormDescriptor;
  /**
   * Optional embedded schemas that the primary schema (or each other) may
   * reference via FieldDescriptor.schemaRef. They are emitted as separate
   * `export const` declarations before the primary schema, topologically
   * sorted so dependencies come first.
   */
  embeddedSchemas?: EmbeddedSchema[];
}

export interface SchemaWriterResult {
  /** Generated Zod v4 source code */
  code: string;
  /** Warnings from generation (e.g., unsupported features skipped) */
  warnings: string[];
}
