import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import type { $ZodType } from "zod/v4/core";
import { introspect } from "../../src/introspection";
import { compositeTarget } from "../../src/targets/composite";
import { architectureObject } from "../fixtures/architecture-fixture";

const OPTIONS = {
  formName: "VersionForm",
  schemaImportPath: "./version-fixture",
  schemaExportName: "versionSchema",
};

function versionOf(schema: $ZodType, options = OPTIONS): string {
  return introspect(schema, options).version;
}

describe("descriptor content version (#143)", () => {
  // Criterion 1: deterministic -- the same schema always hashes the same, so a
  // consumer can pin against it and a regenerate produces a comparable value.
  it("produces the same version for the same schema every time", () => {
    expect(versionOf(architectureObject)).toBe(versionOf(architectureObject));
    expect(versionOf(z.object({ a: z.string().min(1) }))).toBe(
      versionOf(z.object({ a: z.string().min(1) })),
    );
  });

  it("produces a stable, non-empty hash", () => {
    expect(versionOf(architectureObject)).toMatch(/^[0-9a-f]{16}$/);
  });

  // Pinned in #165, when the digest moved from node:crypto to a dependency-free
  // implementation so the library could run outside Node. Every other assertion
  // here is relational -- "this changes, that does not" -- so all of them would
  // still pass if the hash function were swapped for a different one and every
  // published version silently rerolled. This is the one that would not.
  //
  // The value was taken from main BEFORE the swap and verified identical after.
  // If a change moves it, that is a breaking change for every consumer pinned
  // against a descriptor version, and it needs a deliberate decision rather
  // than an updated expectation.
  it("produces the exact hash published for the canonical fixture", () => {
    expect(versionOf(architectureObject)).toBe("11617b63d9d43a33");
  });

  // Criterion 2: cosmetic options must not churn the version, or every consumer
  // re-pins because someone renamed the generated component.
  it("ignores formName, import path and export name", () => {
    const base = versionOf(z.object({ a: z.string() }));
    expect(
      versionOf(z.object({ a: z.string() }), {
        formName: "CompletelyDifferentForm",
        schemaImportPath: "../elsewhere/other",
        schemaExportName: "renamedSchema",
      }),
    ).toBe(base);
  });

  // Criterion 3: presentation is not the data contract. A label edit must not
  // invalidate captured records or trigger a downstream schema evolution.
  it("ignores meta, labels and descriptions", () => {
    const bare = versionOf(z.object({ a: z.string().min(2) }));
    const annotated = versionOf(
      z.object({
        a: z
          .string()
          .min(2)
          .meta({ title: "Alpha", description: "the first", examples: ["x"] }),
      }),
    );
    expect(annotated).toBe(bare);
  });

  // Criterion 4: anything that changes what data conforms MUST change the version.
  it("changes when a field is added, removed or renamed", () => {
    const base = versionOf(z.object({ a: z.string() }));
    expect(versionOf(z.object({ a: z.string(), b: z.number() }))).not.toBe(base);
    expect(versionOf(z.object({ renamed: z.string() }))).not.toBe(base);
    expect(versionOf(z.object({}))).not.toBe(base);
  });

  it("changes when a type changes", () => {
    expect(versionOf(z.object({ a: z.string() }))).not.toBe(versionOf(z.object({ a: z.number() })));
  });

  it("changes when a constraint changes", () => {
    const base = versionOf(z.object({ a: z.string().min(2) }));
    expect(versionOf(z.object({ a: z.string().min(3) }))).not.toBe(base);
    expect(versionOf(z.object({ a: z.string() }))).not.toBe(base);
  });

  // Criterion 5: the exclusivity distinction is a real boundary difference, so
  // it must move the version -- .positive() and .nonnegative() are not the same
  // contract even though both read as min 0.
  it("changes between exclusive and inclusive bounds", () => {
    expect(versionOf(z.object({ a: z.number().positive() }))).not.toBe(
      versionOf(z.object({ a: z.number().nonnegative() })),
    );
  });

  it("changes when optionality or nullability changes", () => {
    const base = versionOf(z.object({ a: z.string() }));
    expect(versionOf(z.object({ a: z.string().optional() }))).not.toBe(base);
    expect(versionOf(z.object({ a: z.string().nullable() }))).not.toBe(base);
  });

  it("changes when a default changes", () => {
    const base = versionOf(z.object({ a: z.string().default("x") }));
    expect(versionOf(z.object({ a: z.string().default("y") }))).not.toBe(base);
    expect(versionOf(z.object({ a: z.string() }))).not.toBe(base);
  });

  // Criterion 6: declaration order is semantic -- a form has exactly one order,
  // and reordering fields is a contract change for anything positional.
  it("changes when field declaration order changes", () => {
    expect(versionOf(z.object({ a: z.string(), b: z.number() }))).not.toBe(
      versionOf(z.object({ b: z.number(), a: z.string() })),
    );
  });

  it("changes when a nested field changes", () => {
    const base = versionOf(z.object({ outer: z.object({ inner: z.string().min(1) }) }));
    expect(versionOf(z.object({ outer: z.object({ inner: z.string().min(2) }) }))).not.toBe(base);
  });

  it("changes when enum values or union variants change", () => {
    expect(versionOf(z.object({ a: z.enum(["x", "y"]) }))).not.toBe(
      versionOf(z.object({ a: z.enum(["x", "z"]) })),
    );
    expect(
      versionOf(
        z.object({
          a: z.discriminatedUnion("k", [
            z.object({ k: z.literal("one"), v: z.string() }),
            z.object({ k: z.literal("two"), v: z.number() }),
          ]),
        }),
      ),
    ).not.toBe(
      versionOf(
        z.object({
          a: z.discriminatedUnion("k", [z.object({ k: z.literal("one"), v: z.string() })]),
        }),
      ),
    );
  });

  // Criterion 7: stamped into the emitted artifact as a discoverable top-level
  // field, so a regenerate can diff it without re-deriving the descriptor.
  it("is a top-level field of the composite artifact", () => {
    const descriptor = introspect(architectureObject, OPTIONS);
    const result = compositeTarget.generate(descriptor, {});
    const parsed = JSON.parse(result.files[0].content) as Record<string, unknown>;

    expect(parsed.version).toBe(descriptor.version);
    expect(typeof parsed.version).toBe("string");
  });
});
