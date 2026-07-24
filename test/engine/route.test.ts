import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { controlPaths } from "../../src/engine/paths";
import { route } from "../../src/engine/route";
import type { Issue } from "../../src/engine/route";
import { introspect } from "../../src/introspection";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const asSchema = (s: unknown) => s as Parameters<typeof introspect>[0];

// Real controls (home.zip, tags.*.label) from a real descriptor -- no fakes.
const controls = controlPaths(
  introspect(
    asSchema(
      z.object({
        home: z.object({ zip: z.string() }),
        tags: z.array(z.object({ label: z.string() })),
      }),
    ),
    OPTS,
  ),
);

describe("route -- the join executed (#224)", () => {
  it("binds an issue to a control by exact path", () => {
    const [b] = route(controls, [{ message: "Required", path: ["home", "zip"] }]);
    expect(b.key).toBe("home.zip");
    expect(b.control?.key).toBe("home.zip");
  });

  it("binds an array-row issue to the * template by wildcard", () => {
    const [b] = route(controls, [{ message: "Too small", path: ["tags", 2, "label"] }]);
    expect(b.key).toBe("tags.2.label");
    expect(b.control?.key).toBe("tags.*.label");
  });

  it("binds a record-key issue to the * template by wildcard", () => {
    // A record's value control uses the same "*" slot as an array row, so a
    // string key must bind exactly as a numeric index does.
    const recordControls = controlPaths(
      introspect(asSchema(z.object({ prefs: z.record(z.string(), z.string().min(1)) })), OPTS),
    );
    const [b] = route(recordControls, [{ message: "Too small", path: ["prefs", "theme"] }]);
    expect(b.key).toBe("prefs.theme");
    expect(b.control?.key).toBe("prefs.*");
  });

  it("normalizes a {key}-wrapped path", () => {
    const [b] = route(controls, [
      { message: "x", path: [{ key: "tags" }, { key: 5 }, { key: "label" }] },
    ]);
    expect(b.control?.key).toBe("tags.*.label");
  });

  it("surfaces an unbound issue (control undefined), never dropping it", () => {
    const [b] = route(controls, [{ message: "?", path: ["nope"] }]);
    expect(b.control).toBeUndefined();
    expect(b.message).toBe("?");
  });

  it("routes real Standard Schema issues from bad data", async () => {
    const schema = z.object({
      email: z.string().email(),
      home: z.object({ zip: z.string().length(5) }),
      tags: z.array(z.object({ label: z.string().min(1) })),
    });
    const cs = controlPaths(introspect(asSchema(schema), OPTS));
    const bad = { email: "nope", home: { zip: "1" }, tags: [{ label: "ok" }, { label: "" }] };
    const result = await schema["~standard"].validate(bad);
    const issues: readonly Issue[] = "issues" in result && result.issues ? result.issues : [];

    const bindings = route(cs, issues);
    expect(bindings.length).toBeGreaterThan(0);
    expect(bindings.every((b) => b.control !== undefined)).toBe(true); // all bound
    const tagBinding = bindings.find((b) => b.key.startsWith("tags."));
    expect(tagBinding?.control?.key).toBe("tags.*.label"); // array row -> * template
  });
});
