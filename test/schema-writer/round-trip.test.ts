import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import { writeSchema } from "../../src/schema-writer/writer";
import { architectureObject } from "../fixtures/architecture-fixture";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

const INTROSPECT_OPTS = {
  formName: "TestForm",
  schemaImportPath: "./schema",
  schemaExportName: "testSchema",
};

/**
 * Introspects a schema, writes it back to source, evaluates the source,
 * introspects the result, and compares the two descriptors.
 */
function roundTrip(schema: z.ZodObject) {
  const descriptor1 = introspect(schema, INTROSPECT_OPTS);
  const { code } = writeSchema({ form: descriptor1 });

  const testSchema = evaluateSchemaCode(code);
  const descriptor2 = introspect(testSchema, INTROSPECT_OPTS);

  return { descriptor1, descriptor2, code };
}

describe("round-trip: schema -> introspect -> writeSchema -> eval -> introspect", () => {
  it("round-trips a plain string field", () => {
    const schema = z.object({ name: z.string() });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields).toHaveLength(1);
    expect(descriptor2.fields[0].type).toBe("string");
    expect(descriptor2.fields[0].name).toBe(descriptor1.fields[0].name);
    expect(descriptor2.fields[0].isOptional).toBe(false);
    expect(descriptor2.fields[0].isNullable).toBe(false);
  });

  it("round-trips string with constraints", () => {
    const schema = z.object({
      username: z.string().min(3).max(20),
    });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    const f1 = descriptor1.fields[0];
    const f2 = descriptor2.fields[0];
    expect(f2.constraints.minLength).toBe(f1.constraints.minLength);
    expect(f2.constraints.maxLength).toBe(f1.constraints.maxLength);
  });

  it("round-trips email format", () => {
    const schema = z.object({ email: z.email() });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].constraints.format).toBe("email");
    expect(descriptor2.fields[0].constraints.format).toBe(descriptor1.fields[0].constraints.format);
  });

  it("round-trips url format", () => {
    const schema = z.object({ website: z.url() });
    const { descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].constraints.format).toBe("url");
  });

  it("round-trips uuid format", () => {
    const schema = z.object({ id: z.uuid() });
    const { descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].constraints.format).toBe("uuid");
  });

  it("round-trips a number field", () => {
    const schema = z.object({ count: z.number() });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].type).toBe("number");
    expect(descriptor2.fields[0].name).toBe(descriptor1.fields[0].name);
  });

  it("round-trips number with min/max", () => {
    const schema = z.object({ score: z.number().min(0).max(100) });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    const f1 = descriptor1.fields[0];
    const f2 = descriptor2.fields[0];
    expect(f2.constraints.min).toBe(f1.constraints.min);
    expect(f2.constraints.max).toBe(f1.constraints.max);
  });

  it("round-trips z.int() (via z.number().int() chain)", () => {
    // z.int() is a top-level Zod v4 type that stores format in def, not checks.
    // The introspection currently extracts isInt only from z.number().int() chains.
    // This test verifies the round-trip fidelity for the chain form.
    const schema = z.object({ age: z.number().int() });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].constraints.isInt).toBe(true);
    expect(descriptor2.fields[0].constraints.isInt).toBe(descriptor1.fields[0].constraints.isInt);
  });

  it("round-trips a boolean field", () => {
    const schema = z.object({ active: z.boolean() });
    const { descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].type).toBe("boolean");
  });

  it("round-trips a date field", () => {
    const schema = z.object({ createdAt: z.date() });
    const { descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].type).toBe("date");
  });

  it("round-trips an enum field", () => {
    const schema = z.object({
      role: z.enum(["admin", "user", "guest"]),
    });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].type).toBe("enum");
    expect(descriptor2.fields[0].metadata.kind).toBe("enum");
    expect(descriptor1.fields[0].metadata.kind).toBe("enum");
    if (
      descriptor2.fields[0].metadata.kind === "enum" &&
      descriptor1.fields[0].metadata.kind === "enum"
    ) {
      expect(descriptor2.fields[0].metadata.values).toEqual(descriptor1.fields[0].metadata.values);
    }
  });

  it("round-trips an array of strings", () => {
    const schema = z.object({ tags: z.array(z.string()) });
    const { descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].type).toBe("array");
    expect(descriptor2.fields[0].metadata.kind).toBe("array");
    if (descriptor2.fields[0].metadata.kind === "array") {
      expect(descriptor2.fields[0].metadata.element.type).toBe("string");
    }
  });

  it("round-trips an array of enums", () => {
    const schema = z.object({
      permissions: z.array(z.enum(["read", "write", "delete"])),
    });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].type).toBe("array");
    expect(descriptor2.fields[0].metadata.kind).toBe("array");
    expect(descriptor1.fields[0].metadata.kind).toBe("array");
    if (
      descriptor2.fields[0].metadata.kind === "array" &&
      descriptor1.fields[0].metadata.kind === "array"
    ) {
      expect(descriptor2.fields[0].metadata.element.type).toBe("enum");
      expect(descriptor2.fields[0].metadata.element.metadata.kind).toBe("enum");
      expect(descriptor1.fields[0].metadata.element.metadata.kind).toBe("enum");
      if (
        descriptor2.fields[0].metadata.element.metadata.kind === "enum" &&
        descriptor1.fields[0].metadata.element.metadata.kind === "enum"
      ) {
        expect(descriptor2.fields[0].metadata.element.metadata.values).toEqual(
          descriptor1.fields[0].metadata.element.metadata.values,
        );
      }
    }
  });

  it("round-trips a tuple with mixed types", () => {
    const schema = z.object({
      coord: z.tuple([z.string(), z.number(), z.boolean()]),
    });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].type).toBe("tuple");
    expect(descriptor2.fields[0].metadata.kind).toBe("tuple");
    expect(descriptor1.fields[0].metadata.kind).toBe("tuple");
    if (
      descriptor2.fields[0].metadata.kind === "tuple" &&
      descriptor1.fields[0].metadata.kind === "tuple"
    ) {
      expect(descriptor2.fields[0].metadata.elements).toHaveLength(
        descriptor1.fields[0].metadata.elements.length,
      );
      expect(descriptor2.fields[0].metadata.elements[0].type).toBe("string");
      expect(descriptor2.fields[0].metadata.elements[1].type).toBe("number");
      expect(descriptor2.fields[0].metadata.elements[2].type).toBe("boolean");
    }
  });

  it("round-trips a tuple of [string, number]", () => {
    const schema = z.object({
      pair: z.tuple([z.string(), z.number()]),
    });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].type).toBe("tuple");
    expect(descriptor2.fields[0].metadata.kind).toBe("tuple");
    expect(descriptor1.fields[0].metadata.kind).toBe("tuple");
    if (
      descriptor2.fields[0].metadata.kind === "tuple" &&
      descriptor1.fields[0].metadata.kind === "tuple"
    ) {
      expect(descriptor2.fields[0].metadata.elements).toHaveLength(
        descriptor1.fields[0].metadata.elements.length,
      );
    }
  });

  it("round-trips optional fields", () => {
    const schema = z.object({
      nickname: z.string().optional(),
    });
    const { descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].isOptional).toBe(true);
    expect(descriptor2.fields[0].isNullable).toBe(false);
  });

  it("round-trips nullable fields", () => {
    const schema = z.object({
      middleName: z.string().nullable(),
    });
    const { descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].isNullable).toBe(true);
    expect(descriptor2.fields[0].isOptional).toBe(false);
  });

  it("round-trips nullable + optional fields", () => {
    const schema = z.object({
      bio: z.string().nullable().optional(),
    });
    const { descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].isNullable).toBe(true);
    expect(descriptor2.fields[0].isOptional).toBe(true);
  });

  it("round-trips a simple nested object", () => {
    const schema = z.object({
      address: z.object({
        street: z.string(),
        city: z.string(),
      }),
    });
    const { descriptor2 } = roundTrip(schema);

    const address = descriptor2.fields[0];
    expect(address.type).toBe("object");
    expect(address.name).toBe("address");
    expect(address.metadata.kind).toBe("object");
    if (address.metadata.kind === "object") {
      expect(address.metadata.fields).toHaveLength(2);
      expect(address.metadata.fields[0].name).toBe("street");
      expect(address.metadata.fields[0].type).toBe("string");
      expect(address.metadata.fields[1].name).toBe("city");
      expect(address.metadata.fields[1].type).toBe("string");
    }
  });

  it("round-trips deeply nested objects", () => {
    const schema = z.object({
      company: z.object({
        hq: z.object({
          city: z.string(),
          zip: z.string().min(5).max(10),
        }),
      }),
    });
    const { descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields).toHaveLength(1);
    const company = descriptor2.fields[0];
    expect(company.type).toBe("object");
    expect(company.metadata.kind).toBe("object");
    if (company.metadata.kind === "object") {
      const hq = company.metadata.fields[0];
      expect(hq.type).toBe("object");
      expect(hq.metadata.kind).toBe("object");
      if (hq.metadata.kind === "object") {
        expect(hq.metadata.fields[0].name).toBe("city");
        expect(hq.metadata.fields[1].name).toBe("zip");
        expect(hq.metadata.fields[1].constraints.minLength).toBe(5);
        expect(hq.metadata.fields[1].constraints.maxLength).toBe(10);
      }
    }
  });

  it("round-trips an array of objects", () => {
    const schema = z.object({
      items: z.array(
        z.object({
          id: z.number().int(),
          label: z.string(),
        }),
      ),
    });
    const { descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields).toHaveLength(1);
    const items = descriptor2.fields[0];
    expect(items.type).toBe("array");
    expect(items.metadata.kind).toBe("array");
    if (items.metadata.kind === "array") {
      expect(items.metadata.element.type).toBe("object");
      expect(items.metadata.element.metadata.kind).toBe("object");
      if (items.metadata.element.metadata.kind === "object") {
        const fields = items.metadata.element.metadata.fields;
        expect(fields).toHaveLength(2);
        expect(fields[0].name).toBe("id");
        expect(fields[0].constraints.isInt).toBe(true);
        expect(fields[1].name).toBe("label");
        expect(fields[1].type).toBe("string");
      }
    }
  });

  it("round-trips a record of numbers", () => {
    const schema = z.object({
      scores: z.record(z.string(), z.number()),
    });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].type).toBe("record");
    expect(descriptor2.fields[0].name).toBe(descriptor1.fields[0].name);
    expect(descriptor2.fields[0].metadata.kind).toBe("record");
    if (
      descriptor2.fields[0].metadata.kind === "record" &&
      descriptor1.fields[0].metadata.kind === "record"
    ) {
      expect(descriptor2.fields[0].metadata.valueDescriptor.type).toBe(
        descriptor1.fields[0].metadata.valueDescriptor.type,
      );
    }
  });

  it("round-trips a discriminated union", () => {
    const schema = z.object({
      contact: z.discriminatedUnion("type", [
        z.object({ type: z.literal("email"), address: z.string() }),
        z.object({ type: z.literal("phone"), number: z.string() }),
      ]),
    });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    const f1 = descriptor1.fields[0];
    const f2 = descriptor2.fields[0];
    expect(f2.type).toBe("union");
    expect(f2.name).toBe("contact");
    expect(f2.metadata.kind).toBe("union");
    if (f1.metadata.kind === "union" && f2.metadata.kind === "union") {
      expect(f2.metadata.discriminator).toBe(f1.metadata.discriminator);
      expect(f2.metadata.variants).toHaveLength(f1.metadata.variants.length);
      for (let i = 0; i < f1.metadata.variants.length; i++) {
        expect(f2.metadata.variants[i].value).toBe(f1.metadata.variants[i].value);
        expect(f2.metadata.variants[i].fields).toHaveLength(f1.metadata.variants[i].fields.length);
      }
    }
  });

  it("round-trips a discriminated union with 3 variants", () => {
    const schema = z.object({
      shape: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("circle"), radius: z.number() }),
        z.object({ kind: z.literal("square"), side: z.number() }),
        z.object({
          kind: z.literal("rect"),
          width: z.number(),
          height: z.number(),
        }),
      ]),
    });
    const { descriptor2 } = roundTrip(schema);

    const f2 = descriptor2.fields[0];
    expect(f2.type).toBe("union");
    expect(f2.metadata.kind).toBe("union");
    if (f2.metadata.kind === "union") {
      expect(f2.metadata.discriminator).toBe("kind");
      expect(f2.metadata.variants).toHaveLength(3);
      expect(f2.metadata.variants[0].value).toBe("circle");
      expect(f2.metadata.variants[1].value).toBe("square");
      expect(f2.metadata.variants[2].value).toBe("rect");
    }
  });

  it("round-trips a plain union of scalars", () => {
    const schema = z.object({
      value: z.union([z.string(), z.number()]),
    });
    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields[0].type).toBe("union");
    expect(descriptor2.fields[0].metadata.kind).toBe("union");
    if (
      descriptor2.fields[0].metadata.kind === "union" &&
      descriptor1.fields[0].metadata.kind === "union"
    ) {
      expect(descriptor2.fields[0].metadata.variants).toHaveLength(
        descriptor1.fields[0].metadata.variants.length,
      );
    }
  });

  it("round-trips a complex multi-field schema", () => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.email(),
      age: z.number().int().min(0).max(150).optional(),
      role: z.enum(["admin", "user"]),
      active: z.boolean(),
      tags: z.array(z.string()),
    });

    const { descriptor1, descriptor2 } = roundTrip(schema);

    expect(descriptor2.fields).toHaveLength(descriptor1.fields.length);

    for (let i = 0; i < descriptor1.fields.length; i++) {
      const f1 = descriptor1.fields[i];
      const f2 = descriptor2.fields[i];
      expect(f2.name).toBe(f1.name);
      expect(f2.type).toBe(f1.type);
      expect(f2.isOptional).toBe(f1.isOptional);
      expect(f2.isNullable).toBe(f1.isNullable);
    }
  });
});

/**
 * The cases above assert field-by-field, so a constraint the writer never
 * emitted passed by simply not being looked at -- which is how the writer
 * stayed lossy while the suite was green. These compare whole descriptors.
 */
describe("writer re-emit parity (#148)", () => {
  // Criterion 1: the canonical adversarial fixture, whole.
  it("round-trips the canonical fixture with every field identical", () => {
    const { descriptor1, descriptor2 } = roundTrip(architectureObject);
    expect(descriptor2.fields).toEqual(descriptor1.fields);
  });

  // Criterion 2: exclusive bounds. Emitting .min()/.max() for these turns
  // .positive() into .nonnegative() -- the boundary moves by one, silently.
  it("preserves exclusive vs inclusive numeric bounds", () => {
    const { descriptor1, descriptor2, code } = roundTrip(
      z.object({
        exclusiveMin: z.number().gt(5),
        inclusiveMin: z.number().gte(5),
        exclusiveMax: z.number().lt(10),
        inclusiveMax: z.number().lte(10),
        positive: z.number().positive(),
        nonneg: z.number().nonnegative(),
      }),
    );
    expect(code).toContain(".gt(5)");
    expect(code).toContain(".lt(10)");
    expect(descriptor2.fields).toEqual(descriptor1.fields);

    const byName = Object.fromEntries(descriptor2.fields.map((f) => [f.name, f]));
    expect(byName.positive.constraints).toEqual({ min: 0, minExclusive: true });
    expect(byName.nonneg.constraints).toEqual({ min: 0 });
    expect(byName.positive.constraints).not.toEqual(byName.nonneg.constraints);
  });

  // Criterion 3: exact length, prefix, suffix.
  it("preserves exact length, startsWith and endsWith", () => {
    const { descriptor1, descriptor2 } = roundTrip(
      z.object({
        code: z.string().length(6),
        prefixed: z.string().startsWith("ID-"),
        suffixed: z.string().endsWith(".png"),
        both: z.string().startsWith("a").endsWith("z"),
        sizedList: z.array(z.string()).length(3),
      }),
    );
    expect(descriptor2.fields).toEqual(descriptor1.fields);
  });

  // Criterion 4: defaults survive the trip out as well as in.
  it("preserves defaults of every JSON-shaped kind", () => {
    const { descriptor1, descriptor2 } = roundTrip(
      z.object({
        str: z.string().default("hello"),
        num: z.number().default(42),
        bool: z.boolean().default(true),
        enumerated: z.enum(["a", "b"]).default("b"),
        list: z.array(z.string()).default([]),
        nested: z.object({ a: z.string() }).default({ a: "x" }),
        withConstraints: z.string().min(2).max(8).default("mid"),
      }),
    );
    expect(descriptor2.fields).toEqual(descriptor1.fields);
  });

  // Criterion 5 (the #147 seam): the reader now captures meta, so the writer
  // must re-emit it or the round trip is lossy on the field #147 just added.
  it("preserves the full .meta() payload", () => {
    const { descriptor1, descriptor2, code } = roundTrip(
      z.object({
        annotated: z.string().meta({
          title: "Annotated",
          description: "with detail",
          examples: ["one"],
          deprecated: false,
        }),
        described: z.string().describe("plain"),
      }),
    );
    expect(code).toContain(".meta(");
    expect(descriptor2.fields).toEqual(descriptor1.fields);

    const byName = Object.fromEntries(descriptor2.fields.map((f) => [f.name, f]));
    expect(byName.annotated.label).toBe("Annotated");
    expect(byName.annotated.meta).toEqual({
      title: "Annotated",
      description: "with detail",
      examples: ["one"],
      deprecated: false,
    });
    expect(byName.described.description).toBe("plain");
  });

  // Criterion 6: constraints nested inside composites, not just at top level.
  it("round-trips constraints nested inside objects, arrays, tuples and unions", () => {
    const { descriptor1, descriptor2 } = roundTrip(
      z.object({
        nested: z.object({ deep: z.object({ value: z.string().min(2).meta({ title: "V" }) }) }),
        list: z.array(z.string().length(3)).min(1).max(5),
        pair: z.tuple([z.string().startsWith("x"), z.number().gt(0)]),
        choice: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("a"), count: z.number().int().lt(9) }),
          z.object({ kind: z.literal("b"), label: z.string().max(4).default("bb") }),
        ]),
      }),
    );
    expect(descriptor2.fields).toEqual(descriptor1.fields);
  });

  // Criterion 7: what the writer cannot reproduce must warn, never pass silently.
  it("warns instead of silently narrowing a record key", () => {
    const descriptor = introspect(z.object({ lookup: z.record(z.string(), z.number()) }), {
      ...INTROSPECT_OPTS,
    });
    const { warnings } = writeSchema({ form: descriptor });
    expect(warnings.some((w) => w.includes("record key"))).toBe(true);
  });

  it("warns instead of silently corrupting a non-JSON default", () => {
    const descriptor = introspect(z.object({ when: z.date() }), INTROSPECT_OPTS);
    descriptor.fields[0].defaultValue = new Date("2020-01-01");

    const { code, warnings } = writeSchema({ form: descriptor });
    expect(warnings.some((w) => w.includes("not a JSON literal"))).toBe(true);
    // A Date would stringify to a quoted string and re-read as a string default
    // on a date field. Omitting it and saying so beats a silent type change.
    expect(code).not.toContain(".default(");
  });
});
