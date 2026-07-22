/** Supported field types after unwrapping */
export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "literal"
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
  /** Flags of a `.regex()` pattern (e.g. "i", "gm"). Absent when there are none. */
  patternFlags?: string;
  /** Literal prefix from z.string().startsWith(p) */
  startsWith?: string;
  /** Literal suffix from z.string().endsWith(s) */
  endsWith?: string;
  format?: "email" | "url" | "uuid" | "cuid" | "datetime";

  // Date constraints (ISO strings, so numeric min/max stay strictly numeric)
  /** Lower bound of a z.date(), as an ISO 8601 string. */
  minDate?: string;
  /** Upper bound of a z.date(), as an ISO 8601 string. */
  maxDate?: string;

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

/**
 * Stable machine code for a warning. Consumers switch on this rather than
 * parsing prose; the `message` is for human display only.
 */
export type WarningCode =
  | "unsupported-type"
  | "refine-unrepresented"
  | "catch-fallback-dropped"
  | "default-unstable"
  | "transform-output-dropped"
  | "coerce-unrepresented"
  | "key-policy-unrepresented"
  | "format-unrecognized"
  | "check-dropped"
  | "record-key-narrowed"
  | "intersection-key-overlap"
  | "numeric-enum-as-union"
  | "discriminator-unresolved"
  // A plain union had more than one field that could serve as a discriminator,
  // so none was promoted (#212) -- the ambiguity must be resolved upstream.
  | "discriminator-ambiguous"
  | "target-warning"
  // Emitted only at the generate() seam (never by introspect() into a
  // FormDescriptor): a target did not report processing a descriptor field, so
  // its output may be missing it (#189).
  | "target-field-unprocessed";

/**
 * A structured introspection warning. `path` follows Standard Schema's
 * `PathSegment[]` convention (string object keys, numeric indices; empty for a
 * form-level warning), so it can be matched against a `~standard` issue path.
 * `code` is stable machine-readable; `message` is human-readable prose that
 * embeds the same location for CLI display.
 */
export interface Warning {
  path: (string | number)[];
  code: WarningCode;
  message: string;
}

/** Type-specific metadata */
export type FieldMetadata =
  | { kind: "string" }
  | { kind: "number" }
  | { kind: "boolean" }
  | { kind: "date" }
  | { kind: "enum"; values: readonly (string | number)[] }
  | { kind: "object"; fields: FieldDescriptor[] }
  | { kind: "array"; element: FieldDescriptor }
  | {
      kind: "union";
      discriminator?: string;
      /**
       * `value` is the variant's discriminator value with its real type
       * (`"card"`, `true`, `1`), not a stringified one (#187). Undiscriminated
       * variants carry a `"variant_N"` placeholder string.
       *
       * `synthetic` is `true` only for a wrapped scalar member: the reader wraps
       * a non-object union option (the `z.number()` in
       * `z.union([z.object({...}), z.number()])`) in a single-field object so
       * every variant has a uniform shape. Consumers and the writer read this
       * marker to unwrap it back to the bare scalar, instead of guessing from
       * the field name -- a guess that misfires on a real object whose only
       * field is literally named `option_0` (#188).
       *
       * `meta` is the variant member's own `.meta()` payload (verbatim, like
       * `FieldDescriptor.meta`), so a consumer can label the variant chooser
       * (#213). Absent when the member carries no meta. It is presentation, not
       * contract, so it is excluded from the content `version` hash.
       */
      variants: {
        value: string | number | boolean;
        fields: FieldDescriptor[];
        synthetic?: true;
        meta?: Record<string, unknown>;
      }[];
    }
  | { kind: "tuple"; elements: FieldDescriptor[] }
  | { kind: "record"; valueDescriptor: FieldDescriptor }
  | { kind: "literal"; values: readonly unknown[] };

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
   *
   * KNOWN LIMITATION (#192/L1): a genuine `.default(undefined)` is indistinguishable
   * from no default -- both leave this key absent. This is the degenerate case;
   * `.default(undefined)` has no practical effect.
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

/**
 * The descriptor FORMAT version -- the shape of `FormDescriptor` itself, bumped
 * by hand when the descriptor structure changes (a new metadata kind, a new
 * constraint field). Distinct from `version`, which hashes one schema's content.
 *
 * A consumer that does not recognize the `formatVersion` it reads should FAIL
 * CLOSED (refuse to consume) rather than guess at an unknown shape (#185).
 */
export const FORMAT_VERSION = 1;

/** Complete form descriptor */
export interface FormDescriptor {
  /**
   * The descriptor FORMAT version (see `FORMAT_VERSION`) -- the shape of this
   * object, not the content of one schema. Excluded from the content `version`
   * hash. A consumer reading an unrecognized value should fail closed.
   */
  formatVersion: number;

  /**
   * Deterministic content hash of the fields -- the descriptor's data contract.
   * Identical schemas hash identically and any contract change produces a new
   * value with no human bump, so consumers can pin against it and detect
   * schema evolution on their own. Presentation and cosmetic options are
   * excluded; see `computeVersion`.
   */
  version: string;

  /** Form name for the generated component */
  name: string;

  /** All fields in order */
  fields: FieldDescriptor[];

  /** Import path for the schema */
  schemaImportPath: string;

  /** Exported schema name */
  schemaExportName: string;

  /**
   * Structured warnings from introspection. Each carries a `path`, a stable
   * `code`, and a human `message` -- consumers switch on `code` and locate by
   * `path` rather than parsing prose (#184).
   */
  warnings: Warning[];

  /** Steps for multi-step (wizard) form generation. When undefined, a single-step form is generated. */
  steps?: FormStep[];
}
