import type { $ZodType } from "zod/v4/core";
import { extractConstraints } from "./checks";
import type { FieldDescriptor, FieldMetadata, FieldType, FormDescriptor } from "./types";
import { unwrapSchema } from "./unwrap";

export interface IntrospectOptions {
  /** Name for the generated form component */
  formName: string;
  /** Import path for the schema file */
  schemaImportPath: string;
  /** Exported name of the schema */
  schemaExportName: string;
}

interface ZodObjectDef {
  type: string;
  shape: Record<string, $ZodType>;
}

interface ZodEnumDef {
  type: string;
  entries: Record<string, string>;
}

interface ZodArrayDef {
  type: string;
  element: $ZodType;
}

interface ZodUnionDef {
  type: string;
  options: $ZodType[];
  discriminator?: string;
}

interface ZodTupleDef {
  type: string;
  items: $ZodType[];
}

interface ZodRecordDef {
  type: string;
  keyType: $ZodType;
  valueType: $ZodType;
}

interface ZodIntersectionDef {
  type: string;
  left: $ZodType;
  right: $ZodType;
}

interface ZodLiteralDef {
  type: string;
  values: unknown[];
}

const SCALAR_TYPES = ["string", "number", "boolean", "date", "enum"] as const;

const COMPOSITE_TYPES = ["object", "array", "union", "tuple", "record"] as const;

type ScalarType = (typeof SCALAR_TYPES)[number];
type CompositeType = (typeof COMPOSITE_TYPES)[number];

function isScalarType(t: string): t is ScalarType {
  return (SCALAR_TYPES as readonly string[]).includes(t);
}

function isCompositeType(t: string): t is CompositeType {
  return (COMPOSITE_TYPES as readonly string[]).includes(t);
}

/**
 * Converts a camelCase or PascalCase field name to a human-readable label.
 */
function nameToLabel(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Resolves a schema to its root, unwrapping intersections into a merged
 * object shape. Returns the resolved schema and any warnings.
 */
function resolveRootSchema(schema: $ZodType): {
  resolved: $ZodType;
  warnings: string[];
} {
  const def = schema._zod.def as { type: string };

  if (def.type === "intersection") {
    const shape = flattenIntersection(schema);
    // Build a synthetic object-like schema view
    return {
      resolved: buildSyntheticObjectSchema(shape),
      warnings: [],
    };
  }

  return { resolved: schema, warnings: [] };
}

/**
 * Recursively flattens an intersection into a single merged shape.
 */
function flattenIntersection(schema: $ZodType): Record<string, $ZodType> {
  const def = schema._zod.def as { type: string };

  if (def.type === "intersection") {
    const intDef = def as unknown as ZodIntersectionDef;
    const leftShape = flattenIntersection(intDef.left);
    const rightShape = flattenIntersection(intDef.right);
    return { ...leftShape, ...rightShape };
  }

  if (def.type === "object") {
    const objDef = def as unknown as ZodObjectDef;
    return { ...objDef.shape };
  }

  throw new Error(`Intersection members must be objects, got "${def.type}"`);
}

/**
 * Creates a minimal synthetic schema object that looks like a z.object() to
 * the introspector. We only need _zod.def.type and _zod.def.shape.
 */
function buildSyntheticObjectSchema(shape: Record<string, $ZodType>): $ZodType {
  return {
    _zod: {
      def: {
        type: "object",
        shape,
      },
    },
  } as unknown as $ZodType;
}

/**
 * Builds FieldMetadata based on the field type.
 */
function buildMetadata(inner: $ZodType, warnings: string[]): FieldMetadata {
  const def = inner._zod.def as { type: string };
  const type = def.type;

  if (type === "enum") {
    const enumDef = def as unknown as ZodEnumDef;
    const values = Object.keys(enumDef.entries);
    return { kind: "enum", values };
  }

  if (type === "object") {
    const objDef = def as unknown as ZodObjectDef;
    const fields = introspectShape(objDef.shape, warnings);
    return { kind: "object", fields };
  }

  if (type === "array") {
    const arrDef = def as unknown as ZodArrayDef;
    const element = introspectField("item", arrDef.element, warnings);
    return { kind: "array", element };
  }

  if (type === "union") {
    return buildUnionMetadata(def as unknown as ZodUnionDef, warnings);
  }

  if (type === "tuple") {
    const tupDef = def as unknown as ZodTupleDef;
    const elements = tupDef.items.map((item, i) => introspectField(String(i), item, warnings));
    return { kind: "tuple", elements };
  }

  if (type === "record") {
    const recDef = def as unknown as ZodRecordDef;
    const valueDescriptor = introspectField("value", recDef.valueType, warnings);
    return { kind: "record", valueDescriptor };
  }

  return { kind: type as "string" | "number" | "boolean" | "date" };
}

/**
 * Builds union metadata, detecting discriminated unions.
 */
function buildUnionMetadata(def: ZodUnionDef, warnings: string[]): FieldMetadata {
  const discriminator = def.discriminator;
  const variants: { value: string; fields: FieldDescriptor[] }[] = [];

  for (const option of def.options) {
    const optDef = option._zod.def as { type: string };

    if (discriminator && optDef.type === "object") {
      const objDef = optDef as unknown as ZodObjectDef;
      const discField = objDef.shape[discriminator];

      let value = "unknown";
      if (discField) {
        const discDef = discField._zod.def as { type: string };
        if (discDef.type === "literal") {
          const litDef = discDef as unknown as ZodLiteralDef;
          value = String(litDef.values[0]);
        }
      }

      const fields = introspectShape(objDef.shape, warnings);
      variants.push({ value, fields });
    } else if (optDef.type === "object") {
      const objDef = optDef as unknown as ZodObjectDef;
      const fields = introspectShape(objDef.shape, warnings);
      variants.push({ value: `variant_${variants.length}`, fields });
    } else {
      // Non-object union option -- wrap as a single-field variant
      const field = introspectField(`option_${variants.length}`, option, warnings);
      variants.push({
        value: `variant_${variants.length}`,
        fields: [field],
      });
    }
  }

  return {
    kind: "union",
    discriminator,
    variants,
  };
}

/**
 * Introspects all fields in an object shape.
 */
function introspectShape(shape: Record<string, $ZodType>, warnings: string[]): FieldDescriptor[] {
  const fields: FieldDescriptor[] = [];

  for (const [name, fieldSchema] of Object.entries(shape)) {
    fields.push(introspectField(name, fieldSchema, warnings));
  }

  return fields;
}

/**
 * Resolves the effective type string from an unwrapped schema def.
 * Handles Zod v4 top-level format shortcuts (z.email() -> string with format).
 * Also handles pipe/transform by extracting the input type.
 */
function resolveType(inner: $ZodType): string {
  const def = inner._zod.def as { type: string; format?: string };
  const type = def.type;

  // z.email(), z.url(), z.uuid() are strings with def.format set
  // Their def.type is already "string", so they pass through naturally.

  // z.int() is a number with def.format "safeint" -- type is already "number"

  // pipe/transform: use the input type
  if (type === "pipe") {
    const pipeDef = def as unknown as { type: string; in: $ZodType };
    return resolveType(pipeDef.in);
  }

  // literal: map to the JS type of the literal value for scalar representation
  if (type === "literal") {
    const litDef = def as unknown as ZodLiteralDef;
    if (litDef.values.length > 0) {
      const val = litDef.values[0];
      if (typeof val === "string") return "string";
      if (typeof val === "number") return "number";
      if (typeof val === "boolean") return "boolean";
    }
    return "string";
  }

  return type;
}

/**
 * Introspects a single field schema into a FieldDescriptor.
 */
function introspectField(name: string, fieldSchema: $ZodType, warnings: string[]): FieldDescriptor {
  const { inner, isOptional, isNullable } = unwrapSchema(fieldSchema);
  const type = resolveType(inner);

  // Check if it's a supported type
  if (!isScalarType(type) && !isCompositeType(type)) {
    warnings.push(`Field "${name}": unsupported type "${type}", treating as string`);
    return {
      name,
      label: nameToLabel(name),
      type: "string",
      isOptional,
      isNullable,
      constraints: {},
      metadata: { kind: "string" },
    };
  }

  const fieldType = type as FieldType;
  const constraints = extractConstraints(inner);
  const metadata = buildMetadata(inner, warnings);
  const description = (inner as { description?: string }).description;

  const field: FieldDescriptor = {
    name,
    label: nameToLabel(name),
    type: fieldType,
    isOptional,
    isNullable,
    constraints,
    metadata,
  };

  if (description) {
    field.description = description;
  }

  return field;
}

/**
 * Introspects a Zod object schema and returns a FormDescriptor.
 * Accepts z.object(), z.intersection(), and z.object().check() at the top level.
 */
export function introspect(schema: $ZodType, options: IntrospectOptions): FormDescriptor {
  const warnings: string[] = [];

  // Resolve root schema (handles intersection -> merged object)
  const { resolved, warnings: resolveWarnings } = resolveRootSchema(schema);
  warnings.push(...resolveWarnings);

  const def = resolved._zod.def as ZodObjectDef;

  if (def.type !== "object") {
    throw new Error(`kelex only supports z.object() schemas at the top level, got "${def.type}"`);
  }

  const fields = introspectShape(def.shape, warnings);

  return {
    name: options.formName,
    fields,
    schemaImportPath: options.schemaImportPath,
    schemaExportName: options.schemaExportName,
    warnings,
  };
}
