import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import type { FieldDescriptor } from "../../src/introspection/types";

const OPTIONS = {
  formName: "CatchForm",
  schemaImportPath: "./catch-fixture",
  schemaExportName: "catchSchema",
};

function fieldsOf(schema: Parameters<typeof introspect>[0]): Record<string, FieldDescriptor> {
  return Object.fromEntries(introspect(schema, OPTIONS).fields.map((f) => [f.name, f]));
}

describe("catch handling (#154)", () => {
  // Criterion 1: the reported bug. A caught number was resolving to an
  // unconstrained STRING, so a render seat would emit a text input for it.
  it("keeps the inner type and constraints through .catch()", () => {
    const fields = fieldsOf(z.object({ score: z.number().min(5).catch(0) }));
    expect(fields.score.type).toBe("number");
    expect(fields.score.constraints).toEqual({ min: 5 });
  });

  // Criterion 2: same for the other inner types, including enum, whose values
  // were being lost entirely.
  it("keeps string, enum and composite inner types through .catch()", () => {
    const fields = fieldsOf(
      z.object({
        text: z.string().min(3).catch("fallback"),
        choice: z.enum(["a", "b"]).catch("a"),
        list: z.array(z.string()).max(2).catch([]),
      }),
    );

    expect(fields.text.type).toBe("string");
    expect(fields.text.constraints.minLength).toBe(3);

    expect(fields.choice.type).toBe("enum");
    if (fields.choice.metadata.kind !== "enum") {
      throw new Error("expected enum metadata");
    }
    expect(fields.choice.metadata.values).toEqual(["a", "b"]);

    expect(fields.list.type).toBe("array");
    expect(fields.list.constraints.maxItems).toBe(2);
  });

  // Criterion 3: the fallback value is unrepresentable, so it must be warned
  // about rather than dropped silently -- and rather than fabricated. Zod
  // stores .catch(0) as a thunk, so recovering the literal would mean invoking
  // user code, and a context-dependent callback would yield a JSON-safe but
  // fabricated value indistinguishable from a real one.
  it("warns that the catch fallback is not represented", () => {
    const descriptor = introspect(z.object({ score: z.number().catch(0) }), OPTIONS);
    expect(descriptor.warnings).toHaveLength(1);
    expect(descriptor.warnings[0].message).toContain("score");
    expect(descriptor.warnings[0].message).toContain(".catch()");
  });

  it("does not warn when no catch is present", () => {
    expect(introspect(z.object({ score: z.number() }), OPTIONS).warnings).toEqual([]);
  });

  // Criterion 4: the old behavior emitted an "unsupported type" warning, which
  // told a consumer the wrong thing -- the type was supported, the wrapper was
  // not. That warning must be gone.
  it("no longer reports catch as an unsupported type", () => {
    const descriptor = introspect(z.object({ score: z.number().catch(0) }), OPTIONS);
    expect(descriptor.warnings.some((w) => w.message.includes("unsupported type"))).toBe(false);
  });

  // Criterion 5: the wrapper-composition class from #149 -- catch must resolve
  // correctly in any order relative to the other wrappers.
  it("resolves catch composed with optional, nullable and default in any order", () => {
    const fields = fieldsOf(
      z.object({
        catchThenOptional: z.number().min(1).catch(0).optional(),
        optionalThenCatch: z.number().min(1).optional().catch(0),
        catchThenNullable: z.number().min(1).catch(0).nullable(),
        defaultThenCatch: z.number().min(1).default(7).catch(0),
      }),
    );

    expect(fields.catchThenOptional.type).toBe("number");
    expect(fields.catchThenOptional.isOptional).toBe(true);
    expect(fields.catchThenOptional.constraints.min).toBe(1);

    expect(fields.optionalThenCatch.type).toBe("number");
    expect(fields.optionalThenCatch.isOptional).toBe(true);

    expect(fields.catchThenNullable.type).toBe("number");
    expect(fields.catchThenNullable.isNullable).toBe(true);

    expect(fields.defaultThenCatch.type).toBe("number");
    expect(fields.defaultThenCatch.defaultValue).toBe(7);
  });

  // Criterion 6: catch around a pipe, the shape that broke in #149.
  it("resolves catch composed with a transform", () => {
    const fields = fieldsOf(
      z.object({
        piped: z
          .string()
          .min(2)
          .catch("x")
          .transform((s) => s.length),
      }),
    );
    expect(fields.piped.type).toBe("string");
    expect(fields.piped.constraints.minLength).toBe(2);
  });

  // Criterion 8: every case above is a TOP-LEVEL field, and introspectField
  // recursing correctly is an assumption, not a demonstration -- the same
  // assumption that was wrong for meta before #147. These exercise catch at
  // depth through each composite kind.
  it("resolves catch inside an array element's object", () => {
    // Shape of a real bag-entry form: repeating line items, each with caught fields.
    const fields = fieldsOf(
      z.object({
        bag: z.array(
          z.object({
            quality: z.enum(["premium", "prototype"]).catch("premium"),
            rank: z.number().int().min(1).max(6).catch(1),
            count: z.number().int().min(0).catch(0).meta({ title: "How many" }),
          }),
        ),
      }),
    );

    const element = fields.bag.metadata;
    if (element.kind !== "array" || element.element.metadata.kind !== "object") {
      throw new Error("expected array of object");
    }
    const item = Object.fromEntries(element.element.metadata.fields.map((f) => [f.name, f]));

    expect(item.quality.type).toBe("enum");
    if (item.quality.metadata.kind !== "enum") {
      throw new Error("expected enum metadata");
    }
    expect(item.quality.metadata.values).toEqual(["premium", "prototype"]);
    expect(item.rank.constraints).toEqual({ isInt: true, min: 1, max: 6 });
    // meta must survive the catch at depth too, not just at the top level
    expect(item.count.label).toBe("How many");
  });

  it("resolves catch at depth through nested objects, unions, tuples and records", () => {
    const fields = fieldsOf(
      z.object({
        identity: z.object({
          origin: z.object({
            discipline: z.object({
              name: z.string().min(1).catch("unset").meta({ title: "Discipline" }),
              rank: z.number().min(0).max(80).catch(0),
            }),
          }),
        }),
        loadout: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("ship"), hull: z.number().positive().catch(1) }),
        ]),
        coords: z.tuple([z.number().catch(0)]),
        stats: z.record(z.string(), z.number().min(0).catch(0)),
      }),
    );

    const identity = fields.identity.metadata;
    if (identity.kind !== "object") throw new Error("expected object");
    const origin = identity.fields[0].metadata;
    if (origin.kind !== "object") throw new Error("expected object");
    const discipline = origin.fields[0].metadata;
    if (discipline.kind !== "object") throw new Error("expected object");
    // depth 4, and still a string rather than the degraded-to-string default
    expect(discipline.fields[0].type).toBe("string");
    expect(discipline.fields[0].label).toBe("Discipline");
    expect(discipline.fields[1].constraints).toEqual({ min: 0, max: 80 });

    const loadout = fields.loadout.metadata;
    if (loadout.kind !== "union") throw new Error("expected union");
    expect(loadout.variants[0].fields[1].type).toBe("number");

    const coords = fields.coords.metadata;
    if (coords.kind !== "tuple") throw new Error("expected tuple");
    expect(coords.elements[0].type).toBe("number");

    const stats = fields.stats.metadata;
    if (stats.kind !== "record") throw new Error("expected record");
    expect(stats.valueDescriptor.type).toBe("number");
    expect(stats.valueDescriptor.constraints).toEqual({ min: 0 });
  });

  // Criterion 7: meta must still be reachable through a catch wrapper, since
  // catch joined FLAG_WRAPPERS and the meta walk uses that same list.
  it("finds meta through a catch wrapper", () => {
    const fields = fieldsOf(
      z.object({
        inner: z.string().meta({ title: "Inner" }).catch("x"),
        outer: z.string().catch("x").meta({ title: "Outer" }),
      }),
    );
    expect(fields.inner.label).toBe("Inner");
    expect(fields.outer.label).toBe("Outer");
  });
});
