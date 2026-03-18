import type { FormDescriptor } from "../introspection/types";

/** Base options that all targets accept */
export interface TargetOptions {
  [key: string]: unknown;
}

/** A single file produced by a target */
export interface TargetOutputFile {
  /** Filename (relative, e.g. "user-form.tsx" or "user-form.composite.json") */
  filename: string;

  /** File content */
  content: string;
}

/** Result returned by a target's generate method */
export interface TargetResult {
  /** Generated output files */
  files: TargetOutputFile[];

  /** Field names that were successfully processed */
  fields: string[];

  /** Warnings produced during generation */
  warnings: string[];
}

/** A pluggable code generation target */
export interface CodegenTarget<TOptions extends TargetOptions = TargetOptions> {
  /** Unique target name used in CLI (e.g. "react-tanstack") */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Default file extension for the primary output (e.g. ".tsx", ".json") */
  readonly defaultExtension: string;

  /** Generate output files from a FormDescriptor */
  generate(form: FormDescriptor, options: TOptions): TargetResult;
}
