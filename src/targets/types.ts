import type { FormDescriptor } from "../introspection/types";

/** Base options that all targets accept. Extend for target-specific options. */
// biome-ignore lint/suspicious/noEmptyInterface: intentionally empty base for target option subtypes
export interface TargetOptions {}

/** A single file produced by a target */
export interface TargetOutputFile {
  /** Filename relative to the output directory (no path separators expected) */
  filename: string;

  /** File content */
  content: string;
}

/** Result returned by a target's generate method */
export interface TargetResult {
  /** Generated output files. First file is the primary output. */
  files: [TargetOutputFile, ...TargetOutputFile[]];

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
  readonly defaultExtension: `.${string}`;

  /** Generate output files from a FormDescriptor */
  generate(form: FormDescriptor, options: TOptions): TargetResult;
}
