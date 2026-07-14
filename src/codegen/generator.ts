import type { $ZodType } from "zod/v4/core";
import { introspect } from "../introspection";
import type { CodegenTarget, TargetOptions, TargetOutputFile } from "../targets/types";

export interface GenerateOptions {
  /** The Zod schema to generate from */
  schema: $ZodType;

  /** Name for the form component */
  formName: string;

  /** Import path for the schema */
  schemaImportPath: string;

  /** Exported name of the schema */
  schemaExportName: string;

  /** Code generation target */
  target: CodegenTarget;

  /** Target-specific options passed to target.generate() */
  targetOptions?: TargetOptions;
}

export interface GenerateResult {
  /** Generated output files */
  files: TargetOutputFile[];

  /** List of fields that were processed */
  fields: string[];

  /** Any warnings (e.g., unsupported features skipped) */
  warnings: string[];
}

/**
 * Generates form artifacts from a Zod schema via the given target.
 */
export function generate(options: GenerateOptions): GenerateResult {
  const { schema, formName, schemaImportPath, schemaExportName, target } = options;

  const formDescriptor = introspect(schema, {
    formName,
    schemaImportPath,
    schemaExportName,
  });

  const targetResult = target.generate(formDescriptor, options.targetOptions ?? {});

  return {
    files: targetResult.files,
    fields: targetResult.fields,
    warnings: [...formDescriptor.warnings, ...targetResult.warnings],
  };
}
