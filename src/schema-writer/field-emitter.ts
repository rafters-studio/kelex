import type { FieldDescriptor } from "../introspection";

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

const SUPPORTED_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "date",
  "enum",
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
export function emitField(field: FieldDescriptor): string {
  // Named schema reference: emit validated identifier, chain optional/nullable.
  if (field.schemaRef) {
    if (!VALID_IDENTIFIER.test(field.schemaRef)) {
      throw new Error(
        `Invalid schemaRef "${field.schemaRef}" for field "${field.name}". ` +
          "schemaRef must be a valid JavaScript identifier.",
      );
    }
    let expr = field.schemaRef;
    if (field.isNullable) expr += ".nullable()";
    if (field.isOptional) expr += ".optional()";
    return expr;
  }

  if (!SUPPORTED_TYPES.has(field.type)) {
    throw new Error(
      `Unsupported field type "${field.type}" for field "${field.name}". ` +
        "Only string, number, boolean, date, enum, array, tuple, object, record, and union are supported.",
    );
  }

  let expr = emitBaseExpression(field);

  if (field.isNullable) {
    expr += ".nullable()";
  }

  if (field.isOptional) {
    expr += ".optional()";
  }

  if (field.description) {
    expr += `.describe(${JSON.stringify(field.description)})`;
  }

  return expr;
}

function emitBaseExpression(field: FieldDescriptor): string {
  switch (field.type) {
    case "string":
      return emitString(field);
    case "number":
      return emitNumber(field);
    case "boolean":
      return "z.boolean()";
    case "date":
      return "z.date()";
    case "enum":
      return emitEnum(field);
    case "array":
      return emitArray(field);
    case "tuple":
      return emitTuple(field);
    case "object":
      return emitObject(field);
    case "record":
      return emitRecord(field);
    case "union":
      return emitUnion(field);
    default:
      throw new Error(`Unexpected field type: ${field.type}`);
  }
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
  if (constraints.pattern !== undefined) {
    base += `.regex(/${constraints.pattern}/)`;
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
  if (constraints.min !== undefined) {
    base += `.min(${constraints.min})`;
  }
  if (constraints.max !== undefined) {
    base += `.max(${constraints.max})`;
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

  const values = field.metadata.values.map((v) => JSON.stringify(v)).join(", ");
  return `z.enum([${values}])`;
}

function emitArray(field: FieldDescriptor): string {
  if (field.metadata.kind !== "array") {
    throw new Error(
      `Field "${field.name}" has type "array" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  const elementExpr = emitField(field.metadata.element);
  let base = `z.array(${elementExpr})`;

  if (field.constraints.minItems !== undefined) {
    base += `.min(${field.constraints.minItems})`;
  }
  if (field.constraints.maxItems !== undefined) {
    base += `.max(${field.constraints.maxItems})`;
  }

  return base;
}

function emitTuple(field: FieldDescriptor): string {
  if (field.metadata.kind !== "tuple") {
    throw new Error(
      `Field "${field.name}" has type "tuple" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  const elements = field.metadata.elements.map((el) => emitField(el)).join(", ");
  return `z.tuple([${elements}])`;
}

function emitObject(field: FieldDescriptor): string {
  if (field.metadata.kind !== "object") {
    throw new Error(
      `Field "${field.name}" has type "object" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  const entries = field.metadata.fields.map((child) => {
    const key = VALID_IDENTIFIER.test(child.name) ? child.name : JSON.stringify(child.name);
    return `${key}: ${emitField(child)}`;
  });
  return `z.object({ ${entries.join(", ")} })`;
}

function emitRecord(field: FieldDescriptor): string {
  if (field.metadata.kind !== "record") {
    throw new Error(
      `Field "${field.name}" has type "record" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  const valueExpr = emitField(field.metadata.valueDescriptor);
  return `z.record(z.string(), ${valueExpr})`;
}

function emitUnion(field: FieldDescriptor): string {
  if (field.metadata.kind !== "union") {
    throw new Error(
      `Field "${field.name}" has type "union" but metadata kind is "${field.metadata.kind}"`,
    );
  }

  const { discriminator, variants } = field.metadata;

  if (discriminator !== undefined) {
    return emitDiscriminatedUnion(discriminator, variants);
  }

  return emitPlainUnion(variants);
}

function emitDiscriminatedUnion(
  discriminator: string,
  variants: { value: string; fields: FieldDescriptor[] }[],
): string {
  const variantExprs = variants.map((variant) => {
    const entries = variant.fields.map((child) => {
      // The discriminator field introspects as a plain string; reconstruct as z.literal(value).
      if (child.name === discriminator) {
        return `${child.name}: z.literal(${JSON.stringify(variant.value)})`;
      }
      return `${child.name}: ${emitField(child)}`;
    });
    return `z.object({ ${entries.join(", ")} })`;
  });

  return `z.discriminatedUnion(${JSON.stringify(discriminator)}, [${variantExprs.join(", ")}])`;
}

function emitPlainUnion(variants: { value: string; fields: FieldDescriptor[] }[]): string {
  const optionExprs = variants.map((variant) => {
    // Heuristic: the introspector wraps non-object union members in synthetic
    // single-field objects named "variant_N" / "option_N" (see introspect.ts
    // buildUnionMetadata). Real object variants preserve their original field
    // names, so this pattern only matches synthetics.
    const isSyntheticScalar =
      variant.value.startsWith("variant_") &&
      variant.fields.length === 1 &&
      variant.fields[0].name.startsWith("option_");

    if (isSyntheticScalar) {
      return emitField(variant.fields[0]);
    }

    const entries = variant.fields.map((child) => `${child.name}: ${emitField(child)}`);
    return `z.object({ ${entries.join(", ")} })`;
  });

  return `z.union([${optionExprs.join(", ")}])`;
}
