import type { $ZodType } from "zod/v4/core";
import { introspect } from "../introspection";
import { reactTanStackTarget } from "../targets/react-tanstack";
import type { ReactTanStackOptions } from "../targets/react-tanstack/types";
import type {
  CodegenTarget,
  TargetOptions,
  TargetOutputFile,
} from "../targets/types";

export interface GenerateOptions {
  /** The Zod schema to generate from */
  schema: $ZodType;

  /** Name for the form component */
  formName: string;

  /** Import path for the schema */
  schemaImportPath: string;

  /** Exported name of the schema */
  schemaExportName: string;

  /** UI component import path. When omitted, generates built-in primitives. */
  uiImportPath?: string;

  /** Code generation target. Defaults to react-tanstack. */
  target?: CodegenTarget;

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

  /** The generated form component code (first file content, for backwards compat) */
  code: string;

  /** Generated primitive components file (present when no custom uiImportPath) */
  primitives?: string;
}

/**
 * Generates a form component from a Zod schema.
 */
export function generate(options: GenerateOptions): GenerateResult {
  const { schema, formName, schemaImportPath, schemaExportName } = options;
  const target = options.target ?? reactTanStackTarget;

  // 1. Introspect schema -> FormDescriptor
  const formDescriptor = introspect(schema, {
    formName,
    schemaImportPath,
    schemaExportName,
  });

  // Collect warnings from introspection
  const introspectionWarnings = [...formDescriptor.warnings];

  // 2. Build target options
  const targetOptions = buildTargetOptions(target, options);

  // 3. Run target
  const targetResult = target.generate(formDescriptor, targetOptions);

  // Merge warnings
  const warnings = [...introspectionWarnings, ...targetResult.warnings];

  // Use fields reported by the target (respects failed resolutions)
  const fields = targetResult.fields;

  // Backwards-compat: extract code and primitives from files
  const primaryFile = targetResult.files[0];
  const primitivesFile = targetResult.files.find(
    (f) => f.filename === "primitives.tsx",
  );

  return {
    files: targetResult.files,
    fields,
    warnings,
    code: primaryFile?.content ?? "",
    ...(primitivesFile ? { primitives: primitivesFile.content } : {}),
  };
}

function buildTargetOptions(
  target: CodegenTarget,
  options: GenerateOptions,
): TargetOptions {
  if (options.targetOptions) {
    return options.targetOptions;
  }

  // Backwards compat: map legacy uiImportPath to react-tanstack options
  if (target === reactTanStackTarget) {
    const rtOpts: ReactTanStackOptions = {};
    if (options.uiImportPath !== undefined) {
      rtOpts.uiImportPath = options.uiImportPath;
    }
    return rtOpts;
  }

  return {};
}
