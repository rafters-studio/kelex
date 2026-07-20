/** Supported field types after unwrapping */
export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "object"
  | "array"
  | "union"
  | "tuple"
  | "record";

/** Validation constraints extracted from Zod checks */
export interface FieldConstraints {
  // String constraints
  minLength?: number;
  maxLength?: number;
  /** Exact length from z.string().length(n) */
  length?: number;
  pattern?: string;
  /** Literal prefix from z.string().startsWith(p) */
  startsWith?: string;
  /** Literal suffix from z.string().endsWith(s) */
  endsWith?: string;
  format?: "email" | "url" | "uuid" | "cuid" | "datetime";

  // Number constraints
  min?: number;
  max?: number;
  /** True when `min` is exclusive (z.number().positive() / .gt()) rather than inclusive (.gte()/.min()) */
  minExclusive?: boolean;
  /** True when `max` is exclusive (z.number().lt()) rather than inclusive (.lte()/.max()) */
  maxExclusive?: boolean;
  step?: number;
  isInt?: boolean;

  // Array constraints
  minItems?: number;
  maxItems?: number;
}

/** Type-specific metadata */
export type FieldMetadata =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "date" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "object"; fields: FieldDescriptor[] }
  | { kind: "array"; element: FieldDescriptor }
  | {
      kind: "union";
      discriminator?: string;
      variants: { value: string; fields: FieldDescriptor[] }[];
    }
  | { kind: "tuple"; elements: FieldDescriptor[] }
  | { kind: "record"; valueDescriptor: FieldDescriptor }
  | { kind: "literal"; value: unknown };

/** Single field descriptor */
export interface FieldDescriptor {
  /** Original key name from schema shape */
  name: string;

  /**
   * Human-readable label. Taken from `.meta({ title })` when the schema author
   * set one; otherwise derived from `name`.
   */
  label: string;

  /** Description from `.meta({ description })` or `.describe()` */
  description?: string;

  /**
   * The full `.meta()`/`.describe()` payload, verbatim. Zod 4 keeps this in
   * `globalRegistry` rather than the schema def, and it is an open record --
   * carrying it whole (not just `title`/`description`) keeps presentation
   * metadata lossless through the round trip.
   */
  meta?: Record<string, unknown>;

  /** Core type after unwrapping optional/nullable */
  type: FieldType;

  /** Whether wrapped in z.optional() */
  isOptional: boolean;

  /** Whether wrapped in z.nullable() */
  isNullable: boolean;

  /** Validation constraints */
  constraints: FieldConstraints;

  /** Type-specific metadata (e.g., enum values) */
  metadata: FieldMetadata;

  /**
   * Default value from z.default(). Captured before the default wrapper is
   * peeled during unwrapping. `undefined` when the field has no default.
   */
  defaultValue?: unknown;

  /**
   * Reference to a named schema export. When set, the schema-writer emits the
   * identifier directly instead of inlining the Zod expression.
   * Example: "addressSchema" causes the field to emit `addressSchema` rather
   * than `z.object({ ... })`.
   */
  schemaRef?: string;
}

/** A single step in a multi-step (wizard) form */
export interface FormStep {
  /** Unique identifier for the step */
  id: string;

  /** Human-readable label shown in the step indicator */
  label: string;

  /** Optional description for the step */
  description?: string;

  /** Field names belonging to this step */
  fields: string[];
}

/** Complete form descriptor */
export interface FormDescriptor {
  /** Form name for the generated component */
  name: string;

  /** All fields in order */
  fields: FieldDescriptor[];

  /** Import path for the schema */
  schemaImportPath: string;

  /** Exported schema name */
  schemaExportName: string;

  /** Warnings from introspection (e.g., skipped features) */
  warnings: string[];

  /** Steps for multi-step (wizard) form generation. When undefined, a single-step form is generated. */
  steps?: FormStep[];
}
