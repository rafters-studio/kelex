import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection";
import { writeSchema } from "../../src/schema-writer/writer";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";

const OPTIONS = { formName: "F", schemaImportPath: "./f", schemaExportName: "testSchema" };
const constraintsOf = (s: Parameters<typeof introspect>[0]) =>
  introspect(s, OPTIONS).fields[0].constraints;
const versionOf = (s: Parameters<typeof introspect>[0]) => introspect(s, OPTIONS).version;

describe("z.int() int-ness (#178)", () => {
  // M2: z.int() carries int-ness as a def-level format, which was dropped.
  it("reads isInt from z.int()", () => {
    expect(constraintsOf(z.object({ a: z.int() }))).toMatchObject({ isInt: true });
  });

  it("z.number().int() is unchanged", () => {
    expect(constraintsOf(z.object({ a: z.number().int() }))).toMatchObject({ isInt: true });
  });

  // The two spellings must be equivalent -- same constraints, same version.
  it("z.int() and z.number().int() produce the same constraints and version", () => {
    expect(constraintsOf(z.object({ a: z.int() }))).toEqual(
      constraintsOf(z.object({ a: z.number().int() })),
    );
    expect(versionOf(z.object({ a: z.int() }))).toBe(versionOf(z.object({ a: z.number().int() })));
  });

  it("a plain number is not marked int", () => {
    expect(constraintsOf(z.object({ a: z.number() })).isInt).toBeUndefined();
  });

  // The writer re-emits an int-constrained number that round-trips.
  it("round-trips z.int() as an int-constrained number", () => {
    const before = introspect(z.object({ a: z.int() }), OPTIONS);
    const after = introspect(evaluateSchemaCode(writeSchema({ form: before }).code), OPTIONS);
    expect(after.fields[0].constraints).toMatchObject({ isInt: true });
  });
});
