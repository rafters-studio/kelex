import type { FieldDescriptor, FormDescriptor } from "../introspection";
import { emitField } from "./field-emitter";
import type { EmbeddedSchema, SchemaWriterOptions, SchemaWriterResult } from "./types";

/**
 * Generates Zod v4 source code from a FormDescriptor.
 *
 * When embeddedSchemas are provided, they are emitted as separate
 * `export const` + `export type` declarations before the primary schema.
 * Declarations are topologically sorted so dependencies appear first.
 */
export function writeSchema(options: SchemaWriterOptions): SchemaWriterResult {
  const { form, embeddedSchemas } = options;

  const lines: string[] = ['import { z } from "zod/v4";', ""];
  const warnings: string[] = [];

  if (embeddedSchemas && embeddedSchemas.length > 0) {
    const sorted = topologicalSort(embeddedSchemas);
    for (const schema of sorted) {
      lines.push(...emitSchemaDeclaration(schema.form, warnings));
      lines.push("");
    }
  }

  lines.push(...emitSchemaDeclaration(form, warnings));
  lines.push("");

  return { code: lines.join("\n"), warnings };
}

/**
 * Infers TypeScript type name from schema export name.
 * userSchema -> User
 */
function inferTypeName(schemaExportName: string): string {
  const stripped = schemaExportName.replace(/Schema$/i, "");

  if (stripped.trim().length === 0) {
    return "Schema";
  }

  return stripped.replace(/^./, (s) => s.toUpperCase());
}

/**
 * Emits a single schema declaration block:
 *   export const fooSchema = z.object({ ... });
 *   export type Foo = z.infer<typeof fooSchema>;
 */
function emitSchemaDeclaration(form: FormDescriptor, warnings?: string[]): string[] {
  const fieldEntries = form.fields.map(
    (field) => `  ${field.name}: ${emitField(field, warnings)},`,
  );

  const typeName = inferTypeName(form.schemaExportName);

  return [
    `export const ${form.schemaExportName} = z.object({`,
    ...fieldEntries,
    "});",
    "",
    `export type ${typeName} = z.infer<typeof ${form.schemaExportName}>;`,
  ];
}

/**
 * Collects all schemaRef identifiers used by a FormDescriptor's fields,
 * recursing into all nested structures.
 */
function collectSchemaRefs(form: FormDescriptor): Set<string> {
  const refs = new Set<string>();

  function walk(fields: FieldDescriptor[]): void {
    for (const field of fields) {
      if (field.schemaRef) {
        refs.add(field.schemaRef);
      }
      if (field.metadata.kind === "object") {
        walk(field.metadata.fields);
      } else if (field.metadata.kind === "array") {
        walk([field.metadata.element]);
      } else if (field.metadata.kind === "union") {
        for (const variant of field.metadata.variants) {
          walk(variant.fields);
        }
      } else if (field.metadata.kind === "tuple") {
        walk(field.metadata.elements);
      } else if (field.metadata.kind === "record") {
        walk([field.metadata.valueDescriptor]);
      }
    }
  }

  walk(form.fields);
  return refs;
}

/**
 * Topologically sorts embedded schemas so that dependencies (schemas
 * referenced by other schemas) are emitted before their dependents.
 *
 * Uses Kahn's algorithm. Throws on circular references.
 */
function topologicalSort(schemas: EmbeddedSchema[]): EmbeddedSchema[] {
  const names = schemas.map((s) => s.form.schemaExportName);
  const nameSet = new Set(names);

  // Build lookup tables: each name maps to its schema, adjacency list, and in-degree.
  // All entries are initialized here, so subsequent .get() calls are guaranteed non-undefined.
  const byName = new Map<string, EmbeddedSchema>();
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const schema of schemas) {
    const name = schema.form.schemaExportName;
    byName.set(name, schema);
    adj.set(name, []);
    inDegree.set(name, 0);
  }

  // Build edges: if schema A references schema B, B must come before A.
  for (const schema of schemas) {
    const name = schema.form.schemaExportName;
    const refs = collectSchemaRefs(schema.form);
    for (const ref of refs) {
      if (nameSet.has(ref) && ref !== name) {
        (adj.get(ref) ?? []).push(name);
        inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
      }
    }
  }

  // Kahn's algorithm: start with nodes that have no incoming edges
  const queue: string[] = [];
  for (const name of names) {
    if (inDegree.get(name) === 0) {
      queue.push(name);
    }
  }

  const sorted: EmbeddedSchema[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    sorted.push(byName.get(current) as EmbeddedSchema);

    for (const neighbor of adj.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== schemas.length) {
    throw new Error(
      "Circular reference detected among embedded schemas. " +
        "All schema references must form a directed acyclic graph.",
    );
  }

  return sorted;
}
