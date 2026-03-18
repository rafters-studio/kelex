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

  const formDescriptor = introspect(schema, {
    formName,
    schemaImportPath,
    schemaExportName,
  });

  const targetOptions = buildTargetOptions(target, options);
  const targetResult = target.generate(formDescriptor, targetOptions);

  const primitivesFile = targetResult.files.find(
    (f) => f.filename === "primitives.tsx",
  );

  return {
    files: targetResult.files,
    fields: targetResult.fields,
    warnings: [...formDescriptor.warnings, ...targetResult.warnings],
    code: targetResult.files[0]?.content ?? "",
    primitives: primitivesFile?.content,
  };
}

function buildTargetOptions(
  target: CodegenTarget,
  options: GenerateOptions,
): TargetOptions {
  if (options.targetOptions) {
    return options.targetOptions;
  }

  if (target === reactTanStackTarget && options.uiImportPath !== undefined) {
    return {
      uiImportPath: options.uiImportPath,
    } satisfies ReactTanStackOptions;
  }

  return {};
}
