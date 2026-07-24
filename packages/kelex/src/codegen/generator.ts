import type { $ZodType } from "zod/v4/core";
import { introspect } from "../introspection";
import type { FormDescriptor, Warning } from "../introspection/types";
import type {
  CodegenTarget,
  TargetOptions,
  TargetOutputFile,
  TargetResult,
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
 *
 * This is the one seam every target -- built-in or third-party -- passes
 * through, so it is where a user is protected from a buggy plugin (#189): a
 * target that throws, returns a shape that lies about its compile-time
 * `TargetResult` contract, or silently drops a descriptor field is caught here
 * with a message naming the target rather than a raw failure deep in the caller.
 */
export function generate(options: GenerateOptions): GenerateResult {
  const { schema, formName, schemaImportPath, schemaExportName, target } = options;

  const formDescriptor = introspect(schema, {
    formName,
    schemaImportPath,
    schemaExportName,
  });

  let targetResult: TargetResult;
  try {
    targetResult = target.generate(formDescriptor, options.targetOptions ?? {});
  } catch (cause) {
    throw new Error(
      `Target "${target.name}" threw while generating form "${formName}": ${describeError(cause)}`,
      { cause },
    );
  }

  // Validate OUTSIDE the try: a malformed (non-throwing) return must surface its
  // own precise message, not be re-wrapped as "target threw".
  validateTargetResult(targetResult, target.name);

  return {
    files: targetResult.files,
    fields: targetResult.fields,
    warnings: [
      ...formDescriptor.warnings,
      ...unprocessedFieldWarnings(formDescriptor, targetResult, target.name),
      // A target reports prose; wrap it as a structured warning so the combined
      // list is uniform. Targets do not track a field path.
      ...targetResult.warnings.map(
        (message): Warning => ({ path: [], code: "target-warning", message }),
      ),
    ],
  };
}

function describeError(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Runtime-checks a TargetResult's shape before its data is trusted. The type is
 * compile-time only, so a JS plugin can return anything; a clear error naming
 * the target beats a raw property-access failure deep in the caller (#189).
 */
function validateTargetResult(result: TargetResult, targetName: string): void {
  const malformed = (detail: string): never => {
    throw new Error(`Target "${targetName}" returned a malformed result: ${detail}.`);
  };

  const r: unknown = result;
  if (typeof r !== "object" || r === null) {
    return malformed(`expected an object, got ${r === null ? "null" : typeof r}`);
  }

  const record = r as Record<string, unknown>;
  if (!Array.isArray(record.files) || record.files.length === 0) {
    return malformed("`files` must be a non-empty array");
  }
  record.files.forEach((file: unknown, i: number) => {
    const f = file as Record<string, unknown> | null;
    if (
      typeof f !== "object" ||
      f === null ||
      typeof f.filename !== "string" ||
      typeof f.content !== "string"
    ) {
      malformed(`files[${i}] must be a { filename: string, content: string }`);
    }
  });
  if (
    !Array.isArray(record.fields) ||
    !record.fields.every((n: unknown) => typeof n === "string")
  ) {
    return malformed("`fields` must be an array of strings");
  }
  if (
    !Array.isArray(record.warnings) ||
    !record.warnings.every((w: unknown) => typeof w === "string")
  ) {
    return malformed("`warnings` must be an array of strings");
  }
}

/**
 * Warns for each descriptor field the target did not report processing. A
 * target may legitimately choose not to render a field, so this is a warning
 * naming the field and target, not an error -- but a silently dropped field is
 * exactly the failure the target cut was meant to end, so it is surfaced (#189).
 */
function unprocessedFieldWarnings(
  form: FormDescriptor,
  result: TargetResult,
  targetName: string,
): Warning[] {
  const processed = new Set(result.fields);
  const warnings: Warning[] = [];
  for (const field of form.fields) {
    if (!processed.has(field.name)) {
      warnings.push({
        path: [field.name],
        code: "target-field-unprocessed",
        message: `Target "${targetName}" did not process descriptor field "${field.name}"; the generated output may be missing it.`,
      });
    }
  }
  return warnings;
}
