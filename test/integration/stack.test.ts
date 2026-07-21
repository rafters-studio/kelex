import { describe, expect, it } from "vitest";
import { generate } from "../../src/codegen";
import { introspect } from "../../src/introspection";
import type { FormDescriptor } from "../../src/introspection";
import { compositeTarget } from "../../src/targets";
import { evaluateSchemaCode } from "../helpers/evaluate-schema";
import { writeSchema } from "../../src/schema-writer/writer";
import { rung1Contact, rung2Account, rung3Profile, rung4Order, rung5Enterprise } from "./schemas";

const OPTS = {
  formName: "TestForm",
  schemaImportPath: "./schema",
  schemaExportName: "testSchema",
};

/**
 * End-to-end integration over the wired stack: schema -> `generate()` ->
 * introspect -> descriptor -> composite target, plus the schema-writer round
 * trip. Deliberately stops before any real codegen plugin -- the composite
 * target is the identity serialization of the product, and the mapping layer
 * (`resolveField`) is parked, so neither is exercised here.
 *
 * Each rung adds a class of construct; assertions common to all rungs run in
 * the shared block, and per-rung specifics (warnings, field counts) follow.
 */

interface Rung {
  name: string;
  schema: unknown;
  fieldCount: number;
  /** Warnings expected on the FIRST introspect pass. See the round-trip note below. */
  expectedWarnings: number;
}

const RUNGS: Rung[] = [
  { name: "1 · flat scalars", schema: rung1Contact, fieldCount: 4, expectedWarnings: 0 },
  { name: "2 · constraints", schema: rung2Account, fieldCount: 9, expectedWarnings: 0 },
  { name: "3 · nesting + meta", schema: rung3Profile, fieldCount: 6, expectedWarnings: 0 },
  { name: "4 · composites", schema: rung4Order, fieldCount: 7, expectedWarnings: 0 },
  { name: "5 · very complex", schema: rung5Enterprise, fieldCount: 11, expectedWarnings: 6 },
];

function descriptorOf(schema: unknown): FormDescriptor {
  return introspect(schema as Parameters<typeof introspect>[0], OPTS);
}

describe("integration: schema -> generate -> composite (up to the plugins)", () => {
  for (const rung of RUNGS) {
    describe(`rung ${rung.name}`, () => {
      it("generate() produces a composite artifact whose JSON is the descriptor", () => {
        const result = generate({
          schema: rung.schema as Parameters<typeof generate>[0]["schema"],
          formName: OPTS.formName,
          schemaImportPath: OPTS.schemaImportPath,
          schemaExportName: OPTS.schemaExportName,
          target: compositeTarget,
        });

        expect(result.files).toHaveLength(1);
        const file = result.files[0];
        expect(file.filename).toMatch(/\.composite\.json$/);

        // The composite target serializes the descriptor verbatim, so parsing
        // the artifact must reproduce exactly what introspect() returned.
        const parsed = JSON.parse(file.content) as FormDescriptor;
        expect(parsed).toEqual(descriptorOf(rung.schema));

        // generate() surfaces the descriptor's warnings.
        expect(result.warnings).toEqual(parsed.warnings);
        expect(result.fields).toEqual(parsed.fields.map((f) => f.name));
      });

      it("stamps a deterministic version into the artifact", () => {
        const parsed = JSON.parse(
          generate({
            schema: rung.schema as Parameters<typeof generate>[0]["schema"],
            formName: OPTS.formName,
            schemaImportPath: OPTS.schemaImportPath,
            schemaExportName: OPTS.schemaExportName,
            target: compositeTarget,
          }).files[0].content,
        ) as FormDescriptor;

        // Discoverable, top-level, 16 hex chars, and stable run to run.
        expect(parsed.version).toMatch(/^[0-9a-f]{16}$/);
        expect(parsed.version).toBe(descriptorOf(rung.schema).version);
      });

      it("has the expected field count", () => {
        expect(descriptorOf(rung.schema).fields).toHaveLength(rung.fieldCount);
      });

      it("emits exactly the expected number of first-pass warnings", () => {
        expect(descriptorOf(rung.schema).warnings).toHaveLength(rung.expectedWarnings);
      });

      it("round-trips through the schema writer with an identical field tree", () => {
        const before = descriptorOf(rung.schema);
        const { code } = writeSchema({ form: before });
        const after = introspect(evaluateSchemaCode(code), OPTS);

        // Whole-tree equality, not field-by-field. The writer omits what it
        // warns about (refine predicates, catch values), but none of those live
        // in `fields`, so the field tree is conserved exactly.
        expect(after.fields).toEqual(before.fields);

        // Version is computed from `fields`, so it must survive the trip.
        expect(after.version).toBe(before.version);
      });

      it("does not throw a warning it cannot re-emit on the way back out", () => {
        // The re-emitted schema has already had its unrepresentable constructs
        // dropped, so the SECOND pass must be clean -- a warning here would mean
        // the writer emitted something the reader then failed to represent.
        const before = descriptorOf(rung.schema);
        const { code } = writeSchema({ form: before });
        const after = introspect(evaluateSchemaCode(code), OPTS);
        expect(after.warnings).toEqual([]);
      });
    });
  }
});

describe("integration: the ladder is a monotonic complexity gradient", () => {
  it("each rung introspects to at least as many fields as intended, simple to complex", () => {
    // A sanity check that the fixtures did not silently collapse -- e.g. a
    // top-level intersection that failed to merge would drop to zero fields.
    const counts = RUNGS.map((r) => descriptorOf(r.schema).fields.length);
    expect(counts).toEqual([4, 9, 6, 7, 11]);
  });

  it("only the complex rungs produce warnings", () => {
    const withWarnings = RUNGS.filter((r) => descriptorOf(r.schema).warnings.length > 0).map(
      (r) => r.name,
    );
    expect(withWarnings).toEqual(["5 · very complex"]);
  });
});

describe("integration: rung 5 exercises the 2026-07-20 fixes end to end", () => {
  const warningsOf = (): string[] => descriptorOf(rung5Enterprise).warnings;

  it("surfaces the refine on the NESTED intersection (#153), with its message", () => {
    // The inner intersection's refine must not vanish when members merge.
    expect(warningsOf().some((w) => w.includes("revision must be non-negative"))).toBe(true);
  });

  it("surfaces the root refine with its message (#156)", () => {
    expect(warningsOf().some((w) => w.includes("an account must have at least one tag"))).toBe(
      true,
    );
  });

  it("both refines report as form-level, not as a field named (form)", () => {
    const refineWarnings = warningsOf().filter((w) => w.includes(".refine()"));
    expect(refineWarnings).toHaveLength(2);
    expect(refineWarnings.every((w) => w.startsWith("Form-level"))).toBe(true);
    expect(warningsOf().some((w) => w.includes('Field "(form)"'))).toBe(false);
  });

  it("path-qualifies a caught field inside an array of unions (#154, #158)", () => {
    expect(
      warningsOf().some(
        (w) => w.includes('Field "contacts[0].verified"') && w.includes(".catch()"),
      ),
    ).toBe(true);
  });

  it("path-qualifies a caught enum nested three levels deep (#154, #158)", () => {
    expect(
      warningsOf().some(
        (w) => w.includes('Field "settings.display.theme"') && w.includes(".catch()"),
      ),
    ).toBe(true);
  });

  it("resolves a wrapper placed before a transform (#149)", () => {
    const slug = descriptorOf(rung5Enterprise).fields.find((f) => f.name === "slug");
    expect(slug?.type).toBe("string");
    expect(slug?.isOptional).toBe(true);
    expect(slug?.constraints).toMatchObject({ minLength: 3, maxLength: 64 });
  });

  it("captures a .meta() label carried on an entity field (#147)", () => {
    const accountId = descriptorOf(rung5Enterprise).fields.find((f) => f.name === "accountId");
    expect(accountId?.label).toBe("Account ID");
    expect(accountId?.meta).toMatchObject({ description: "Immutable identifier" });
  });

  it("recovers a caught number field's constraints rather than degrading to string (#154)", () => {
    const priority = descriptorOf(rung5Enterprise).fields.find((f) => f.name === "priority");
    expect(priority?.type).toBe("number");
    expect(priority?.isOptional).toBe(true);
    expect(priority?.constraints).toMatchObject({ isInt: true, min: 1, max: 5 });
  });
});
