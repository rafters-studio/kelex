import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { controlPaths } from "../../src/engine/paths";
import { introspect } from "../../src/introspection";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const keys = (schema: Parameters<typeof introspect>[0]): string[] =>
  controlPaths(introspect(schema, OPTS)).map((c) => c.key);

describe("controlPaths -- the join manifest (#221)", () => {
  it("keys flat and nested fields by dotted path", () => {
    expect(keys(z.object({ name: z.string(), user: z.object({ email: z.string() }) }))).toEqual([
      "name",
      "user.email",
    ]);
  });

  it("uses * for an array element template", () => {
    expect(
      keys(z.object({ tags: z.array(z.object({ label: z.string(), weight: z.number() })) })),
    ).toEqual(["tags.*.label", "tags.*.weight"]);
  });

  it("uses * for a record value", () => {
    expect(keys(z.object({ dict: z.record(z.string(), z.number()) }))).toEqual(["dict.*"]);
  });

  it("lists union variant fields and the discriminator once", () => {
    const k = keys(
      z.object({
        pay: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("card"), num: z.string() }),
          z.object({ kind: z.literal("bank"), acct: z.string() }),
        ]),
      }),
    );
    expect(k).toContain("pay.kind");
    expect(k).toContain("pay.num");
    expect(k).toContain("pay.acct");
    expect(k.filter((x) => x === "pay.kind")).toHaveLength(1); // deduped
  });

  it("stops at a recursive (ref) boundary -- no infinite expansion", () => {
    const Cat: z.ZodType = z.lazy(() => z.object({ name: z.string(), kids: z.array(Cat) }));
    const k = keys(z.object({ root: Cat }));
    expect(k).toContain("root.name");
    expect(k.some((x) => x.startsWith("root.kids"))).toBe(false);
  });
});
