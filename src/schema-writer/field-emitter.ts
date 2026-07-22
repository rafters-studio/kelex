import type { FieldDescriptor } from "../introspection";

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

const SUPPORTED_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "date",
  "enum",
  "literal",
  "array",
  "tuple",
  "object",
  "record",
  "union",
]);

/**
 * Emits a Zod v4 expression string for a single FieldDescriptor.
 * If the field has a schemaRef, returns the identifier with optional/nullable
 * chaining but without re-emitting the full schema body.
 * All field types are now supported.
 */
export function emitField(field: FieldDescriptor, warnings?: string[]): string {
  let expr: string;

  // Named schema reference: emit validated identifier without the schema body.
  if (field.schemaRef) {
    if (!VALID_IDENTIFIER.test(field.schemaRef)) {
      throw new Error(
        `Invalid schemaRef "${field.schemaRef}" for field "${field.name}". ` +
          "schemaRef must be a valid JavaScript identifier.",
      );
    }
    expr = field.schemaRef;
  } else {
    if (!SUPPORTED_TYPES.has(field.type)) {
      throw new Error(
        `Unsupported field type "${field.type}" for field "${field.name}". ` +
          "Only string, number, boolean, date, enum, array, tuple, object, record, and union are supported.",
      );
    }
    expr = emitBaseExpression(field, warnings);
  }

  if (field.isNullable) {
    expr += ".nullable()";
  }

  if (field.isOptional) {
    expr += ".optional()";
  }

  expr += emitDefault(field, warnings);
  expr += emitMeta(field, warnings);

  return expr;
}

/**
 * Emits `.default(value)` for a captured default. Applied after
 * optional/nullable so the wrapper order matches what the reader unwraps.
 */
function emitDefault(field: FieldDescriptor, warnings?: string[]): string {
  if (field.defaultValue === undefined) {
    return "";
  }

  const literal = emitLiteral(field.defaultValue);
  if (literal === undefined) {
    warnings?.push(
      `Field "${field.name}": default value is not a JSON literal (e.g. a Date or class instance) ` +
        "and was not re-emitted; re-apply the .default() by hand.",
    );
    return "";
  }

  return `.default(${literal})`;
}

/**
 * Emits the `.meta()` payload, falling back to `.describe()` for descriptors
 * built by hand with only a description. Meta already contains `description`,
 * so emitting both would duplicate it.
 */
function emitMeta(field: FieldDescriptor, warnings?: string[]): string {
  if (field.meta && Object.keys(field.meta).length > 0) {
    const literal = emitLiteral(field.meta);
    if (literal === undefined) {
      warnings?.push(
        `Field "${field.name}": .meta() payload is not JSON-serializable and was not re-emitted.`,
      );
      return "";
    }
    return `.meta(${literal})`;
  }

  if (field.description) {
    return `.describe(${JSON.stringify(field.description)})`;
  }

  return "";
}

/**
 * Renders a value as a source literal, or undefined when it cannot survive the
 * trip. Anything not JSON-shaped (Date, Map, class instance) would stringify
 * into something that re-reads as a different type -- a silent corruption, so
 * the caller warns instead.
 */
function emitLiteral(value: unknown): string | undefined {
  if (!isJsonSafe(value)) {
    return undefined;
  }
  return JSON.stringify(value);
}

function isJsonSafe(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  const type = typeof value;
  if (type === "number") {
    // Reject NaN and +/-Infinity: JSON.stringify renders them as `null`, so a
    // `.default(Infinity)` would silently re-emit as `.default(null)` (#192/L3).
    return Number.isFinite(value);
  }
  if (type === "string" || type === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonSafe);
  }

  if (type === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return false;
    }
    return Object.values(value as Record<string, unknown>).every(isJsonSafe);
  }

  return false;
}

function emitBaseExpression(field: FieldDescriptor, warnings?: string[]): string {
  switch (field.type) {
    case "string":
      return emitString(field);
    case "number":
      return emitNumber(field);
    case "boolean":
      return "z.boolean()";
    case "literal":
      return emitLiteralField(field);
    case "date":
      return emitDate(field);
    case "enum":
      return emitEnum(field);
    case "array":
      return emitArray(field, warnings);
    case "tuple":
      return emitTuple(field, warnings);
    case "object":
      return emitObject(field, warnings);
    case "record":
      return emitRecord(field, warnings);
    case "union":
      return emitUnion(field, warnings);
    default:
      throw new Error(`Unexpected field type: ${field.type}`);
  }
}

function emitLiteralField(field: FieldDescriptor): string {
  if (field.metadata.kind !== "literal") {
    throw new Error(
      `Field "${field.name}" has type "literal" but metadata kind is "${field.metadata.kind}"`,
    );
  }
  const emit = (v: unknown): string => (typeof v === "bigint" ? `${v}n` : JSON.stringify(v));
  const { values } = field.metadata;
  // A single value emits z.literal(v); multiple emit z.literal([...]).
  return values.length === 1
    ? `z.literal(${emit(values[0])})`
    : `z.literal([${values.map(emit).join(", ")}])`;
}

function emitDate(field: FieldDescriptor): string {
  const { constraints } = field;
  let base = "z.date()";
  if (constraints.minDate !== undefined) {
    base += `.min(new Date(${JSON.stringify(constraints.minDate)}))`;
  }
  if (constraints.maxDate !== undefined) {
    base += `.max(new Date(${JSON.stringify(constraints.maxDate)}))`;
  }
  return base;
}

function emitString(field: FieldDescriptor): string {
  const { constraints } = field;

  // Zod v4 top-level format types
  let base: string;
  switch (constraints.format) {
    case "email":
      base = "z.email()";
      break;
    case "url":
      base = "z.url()";
      break;
    case "uuid":
      base = "z.uuid()";
      break;
    case "cuid":
      base = "z.cuid()";
      break;
    case "datetime":
      base = "z.iso.datetime()";
      break;
    default:
      base = "z.string()";
      break;
  }

  if (constraints.minLength !== undefined) {
    base += `.min(${constraints.minLength})`;
  }
  if (constraints.maxLength !== undefined) {
    base += `.max(${constraints.maxLength})`;
  }
  if (constraints.length !== undefined) {
    base += `.length(${constraints.length})`;
  }
  if (constraints.startsWith !== undefined) {
    base += `.startsWith(${JSON.stringify(constraints.startsWith)})`;
  }
  if (constraints.endsWith !== undefined) {
    base += `.endsWith(${JSON.stringify(constraints.endsWith)})`;
  }
  if (constraints.pattern !== undefined) {
    base += `.regex(/${constraints.pattern}/${constraints.patternFlags ?? ""})`;
  }

  return base;
}

function emitNumber(field: FieldDescriptor): string {
  const { constraints } = field;

  // Always use z.number() base with .int() chain instead of z.int() top-level.
  // z.int() stores format in def differently than z.number().int() stores it
  // in checks, and the introspection extracts isInt from checks only.
  let base = "z.number()";

  if (constraints.isInt) {
    base += ".int()";
  }
  // .min()/.max() are the inclusive bounds; exclusive ones must emit .gt()/.lt()
  // or .positive() round-trips back as .nonnegative() -- an off-by-one at the
  // validation boundary, not a cosmetic difference.
  if (constraints.min !== undefined) {
    base += constraints.minExclusive ? `.gt(${constraints.min})` : `.min(${constraints.min})`;
  }
  if (constraints.max !== undefined) {
    base += constraints.maxExclusive ? `.lt(${constraints.max})` : `.max(${constraints.max})`;
  }
  if (constraints.step !== undefined) {
    base += `.multipleOf(${constraints.step})`;
  }

  return base;
}

function emitEnum(field: FieldDescriptor): string {
  if (field.metadata.kind !== "enum") {
    throw new Error(
      `Field "${field.name}" has type "enum" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  const values = field.metadata.values;
  // z.enum() takes string members. Numeric enum values are re-emitted as a
  // union of literals that accepts the same set (a single value as one literal),
  // since z.enum cannot carry numbers.
  if (values.every((v) => typeof v === "string")) {
    return `z.enum([${values.map((v) => JSON.stringify(v)).join(", ")}])`;
  }
  const literals = values.map((v) => `z.literal(${JSON.stringify(v)})`);
  return literals.length === 1 ? literals[0] : `z.union([${literals.join(", ")}])`;
}

function emitArray(field: FieldDescriptor, warnings?: string[]): string {
  if (field.metadata.kind !== "array") {
    throw new Error(
      `Field "${field.name}" has type "array" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  const elementExpr = emitField(field.metadata.element, warnings);
  let base = `z.array(${elementExpr})`;

  if (field.constraints.minItems !== undefined) {
    base += `.min(${field.constraints.minItems})`;
  }
  if (field.constraints.maxItems !== undefined) {
    base += `.max(${field.constraints.maxItems})`;
  }
  // z.array(x).length(n) reads as length_equals, the same check as the string form.
  if (field.constraints.length !== undefined) {
    base += `.length(${field.constraints.length})`;
  }

  return base;
}

function emitTuple(field: FieldDescriptor, warnings?: string[]): string {
  if (field.metadata.kind !== "tuple") {
    throw new Error(
      `Field "${field.name}" has type "tuple" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  const elements = field.metadata.elements.map((el) => emitField(el, warnings)).join(", ");
  return `z.tuple([${elements}])`;
}

function emitObject(field: FieldDescriptor, warnings?: string[]): string {
  if (field.metadata.kind !== "object") {
    throw new Error(
      `Field "${field.name}" has type "object" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  const entries = field.metadata.fields.map((child) => {
    const key = VALID_IDENTIFIER.test(child.name) ? child.name : JSON.stringify(child.name);
    return `${key}: ${emitField(child, warnings)}`;
  });
  return `z.object({ ${entries.join(", ")} })`;
}

function emitRecord(field: FieldDescriptor, warnings?: string[]): string {
  if (field.metadata.kind !== "record") {
    throw new Error(
      `Field "${field.name}" has type "record" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  // The descriptor carries no key schema (the reader warns and keeps only the
  // value), so the key is always re-emitted as a plain z.string(). A narrowed
  // key -- z.record(z.enum([...]), v) -- cannot be reconstructed from here.
  warnings?.push(
    `Field "${field.name}": record key re-emitted as z.string(); a narrower key schema ` +
      "is not carried by the descriptor and must be re-applied by hand.",
  );

  const valueExpr = emitField(field.metadata.valueDescriptor, warnings);
  return `z.record(z.string(), ${valueExpr})`;
}

function emitUnion(field: FieldDescriptor, warnings?: string[]): string {
  if (field.metadata.kind !== "union") {
    throw new Error(
      `Field "${field.name}" has type "union" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  const { discriminator, variants } = field.metadata;

  if (discriminator !== undefined) {
    return emitDiscriminatedUnion(discriminator, variants, warnings);
  }

  return emitPlainUnion(variants, warnings);
}

function emitDiscriminatedUnion(
  discriminator: string,
  variants: { value: string | number | boolean; fields: FieldDescriptor[] }[],
  warnings?: string[],
): string {
  const variantExprs = variants.map((variant) => {
    const entries = variant.fields.map((child) => {
      // Reconstruct the discriminator as z.literal(value) with its real type --
      // JSON.stringify(true) is `true`, JSON.stringify(1) is `1` (#187).
      if (child.name === discriminator) {
        return `${child.name}: z.literal(${JSON.stringify(variant.value)})`;
      }
      return `${child.name}: ${emitField(child, warnings)}`;
    });
    return `z.object({ ${entries.join(", ")} })`;
  });

  return `z.discriminatedUnion(${JSON.stringify(discriminator)}, [${variantExprs.join(", ")}])`;
}

function emitPlainUnion(
  variants: { value: string | number | boolean; fields: FieldDescriptor[]; synthetic?: true }[],
  warnings?: string[],
): string {
  const optionExprs = variants.map((variant) => {
    // A synthetic variant is the reader's single-field wrapper around a
    // non-object union member (introspect.ts buildUnionMetadata, #188); unwrap
    // it back to the bare scalar. A real object variant carries no marker --
    // including one whose only field is named "option_0" -- and is emitted as
    // an object, not silently deleted the way the old name heuristic did.
    if (variant.synthetic) {
      return emitField(variant.fields[0], warnings);
    }

    const entries = variant.fields.map((child) => `${child.name}: ${emitField(child, warnings)}`);
    return `z.object({ ${entries.join(", ")} })`;
  });

  return `z.union([${optionExprs.join(", ")}])`;
}
