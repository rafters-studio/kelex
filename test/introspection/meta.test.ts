import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { introspect } from "../../src/introspection/introspect";
import type { FieldDescriptor } from "../../src/introspection/types";
import { architectureObject } from "../fixtures/architecture-fixture";

const OPTIONS = {
  formName: "MetaForm",
  schemaImportPath: "./meta-fixture",
  schemaExportName: "metaObject",
};

function fieldsOf(schema: Parameters<typeof introspect>[0]): Record<string, FieldDescriptor> {
  const descriptor = introspect(schema, OPTIONS);
  return Object.fromEntries(descriptor.fields.map((field) => [field.name, field]));
}

describe("meta capture (#147)", () => {
  // Criterion 1: .meta({ title }) becomes the label instead of the name derivation.
  it("uses .meta({ title }) as the label", () => {
    const fields = fieldsOf(z.object({ firstName: z.string().meta({ title: "Given name" }) }));
    expect(fields.firstName.label).toBe("Given name");
  });

  // Criterion 2: absent meta still falls back to the name-derived label.
  it("falls back to the name-derived label when no meta is set", () => {
    const fields = fieldsOf(z.object({ firstName: z.string() }));
    expect(fields.firstName.label).toBe("First Name");
  });

  // Criterion 3: the canonical fixture's title field -- the exact gap #141/PR #146 surfaced.
  it("captures the fixture's explicit title, which the lossless reader dropped", () => {
    const fields = fieldsOf(architectureObject);
    expect(fields.title.label).toBe("Title");
    expect(fields.title.meta).toEqual({ title: "Title" });
    // Constraints must survive alongside meta, not be replaced by it.
    expect(fields.title.constraints).toEqual({ minLength: 3, maxLength: 80 });
  });

  // Criterion 4: .describe() and .meta({ description }) both land on description.
  it("captures descriptions from both .describe() and .meta()", () => {
    const fields = fieldsOf(
      z.object({
        a: z.string().describe("via describe"),
        b: z.string().meta({ description: "via meta" }),
      }),
    );
    expect(fields.a.description).toBe("via describe");
    expect(fields.b.description).toBe("via meta");
  });

  // Criterion 5 (the real gotcha): Zod 4 registers meta against the schema INSTANCE,
  // so a wrapper added after .meta() -- or .meta() added after a wrapper -- puts the
  // payload on a different instance than the unwrapped inner the reader used to read.
  it("finds meta at any level of the wrapper chain", () => {
    const fields = fieldsOf(
      z.object({
        innerMeta: z.string().meta({ title: "Inner" }).optional(),
        outerMeta: z.string().optional().meta({ title: "Outer" }),
        deep: z.string().meta({ title: "Deep" }).optional().default("x"),
        acrossPipe: z
          .string()
          .meta({ title: "Piped" })
          .transform((s) => s.length),
      }),
    );
    expect(fields.innerMeta.label).toBe("Inner");
    expect(fields.outerMeta.label).toBe("Outer");
    expect(fields.deep.label).toBe("Deep");
    expect(fields.acrossPipe.label).toBe("Piped");
  });

  // Criterion 6: when both levels carry meta, the outermost call wins per key,
  // but keys only the inner set are still preserved.
  it("merges meta across the chain with the outermost winning per key", () => {
    const fields = fieldsOf(
      z.object({
        both: z
          .string()
          .meta({ title: "Inner", description: "kept from inner" })
          .optional()
          .meta({ title: "Outer" }),
      }),
    );
    expect(fields.both.label).toBe("Outer");
    expect(fields.both.description).toBe("kept from inner");
  });

  // Criterion 7 (losslessness): the payload is an open record. Capturing only
  // title/description would silently drop the rest -- the exact failure class
  // the lossless-reader work exists to eliminate.
  it("carries the full meta payload verbatim, not just title and description", () => {
    const fields = fieldsOf(
      z.object({
        rich: z.string().meta({
          title: "Rich",
          description: "desc",
          examples: ["a", "b"],
          deprecated: true,
          "x-custom": { nested: 1 },
        }),
      }),
    );
    expect(fields.rich.meta).toEqual({
      title: "Rich",
      description: "desc",
      examples: ["a", "b"],
      deprecated: true,
      "x-custom": { nested: 1 },
    });
  });

  // Criterion 8: meta on composite types and on nested fields, not just top-level scalars.
  it("captures meta on nested fields and composite types", () => {
    const fields = fieldsOf(
      z.object({
        author: z
          .object({ email: z.string().meta({ title: "Email address" }) })
          .meta({ title: "Author" }),
        tags: z.array(z.string()).meta({ title: "Tags" }),
      }),
    );
    expect(fields.author.label).toBe("Author");
    expect(fields.tags.label).toBe("Tags");
    const authorMeta = fields.author.metadata;
    if (authorMeta.kind !== "object") {
      throw new Error("expected object metadata");
    }
    expect(authorMeta.fields[0].label).toBe("Email address");
  });

  // Criterion 9: no meta means no meta key at all -- an empty object would make
  // every un-annotated field look annotated to a descriptor consumer.
  it("omits the meta key entirely when the author set none", () => {
    const fields = fieldsOf(z.object({ plain: z.string() }));
    expect(fields.plain.meta).toBeUndefined();
    expect("meta" in fields.plain).toBe(false);
  });
});
