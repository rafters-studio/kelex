import type { $ZodType } from "zod/v4/core";
import { introspect } from "../introspection";
import type { Warning } from "../introspection/types";
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

  /**
   * Structured warnings, combining introspection warnings (which carry a real
   * `path` and `code`) with the target's own warnings (wrapped with a
   * `target-warning` code and an empty path, since a target reports prose).
   */
  warnings: Warning[];
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
    warnings: [
      ...formDescriptor.warnings,
      // A target reports prose; wrap it as a structured warning so the combined
      // list is uniform. Targets do not track a field path.
      ...targetResult.warnings.map(
        (message): Warning => ({ path: [], code: "target-warning", message }),
      ),
    ],
  };
}
