import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { render, validateRenderer } from "../../../src/engine";
import { conformance } from "../../../src/conformance";
import type { FieldType } from "../../../src/introspection/types";
import { introspect } from "../../../src/introspection";
import { htmlRenderer } from "../../../src/renderers/html";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const asSchema = (s: unknown) => s as Parameters<typeof introspect>[0];
const SCALARS: FieldType[] = ["string", "number", "boolean", "date", "enum", "literal"];

/** Render a single field `f` and return the HTML string. */
const one = (schema: unknown): string =>
  render(introspect(asSchema(z.object({ f: schema as never })), OPTS), htmlRenderer);

describe("htmlRenderer -- default base-HTML leaf controls (#226)", () => {
  it("passes the leaf floor -- a type-only catch-all for every scalar type", () => {
    expect(validateRenderer(htmlRenderer, SCALARS)).toEqual([]);
  });

  it("emits the hook trio, label, error slot, and native validation attrs", () => {
    const html = one(z.string().min(2).max(8));
    expect(html).toContain('name="f"');
    expect(html).toContain('id="f"');
    expect(html).toContain('data-path="f"');
    expect(html).toContain('aria-invalid="false"');
    expect(html).toContain('aria-describedby="f-error"');
    expect(html).toContain('<label for="f">');
    expect(html).toContain(
      '<span id="f-error" data-error-for="f" role="alert" aria-live="polite">',
    );
    expect(html).toContain("required");
    expect(html).toContain('minlength="2"');
    expect(html).toContain('maxlength="8"');
  });

  it("drops `required` for an optional field", () => {
    expect(one(z.string().optional())).not.toContain("required");
  });

  it("demonstrates the FORMAT match kind -- email/url -> typed input", () => {
    expect(one(z.email())).toContain('type="email"');
    expect(one(z.url())).toContain('type="url"');
  });

  it("demonstrates the CONSTRAINT-BUCKET match kind -- long string -> textarea, bounded number -> range", () => {
    const long = one(z.string().max(500));
    expect(long).toContain("<textarea");
    expect(long).not.toContain('type="text"');

    const bounded = one(z.number().min(0).max(10));
    expect(bounded).toContain('type="range"');
    expect(bounded).toContain('min="0"');
    expect(bounded).toContain('max="10"');
  });

  it("demonstrates the META-HINT match kind -- password/otp via .meta({ ui })", () => {
    expect(one(z.string().meta({ ui: "password" }))).toContain('type="password"');
    expect(one(z.string().meta({ ui: "otp" }))).toContain('inputmode="numeric"');
  });

  it("renders enum by cardinality -- few -> radio group, many -> select", () => {
    const few = one(z.enum(["a", "b"]));
    expect(few).toContain('role="radiogroup"');
    expect(few).toContain('type="radio"');
    // The group is a control too -- it carries the canonical id + aria pair.
    expect(few).toContain('id="f"');
    expect(few).toContain('aria-invalid="false"');
    expect(few).toContain('aria-describedby="f-error"');

    const many = one(z.enum(["a", "b", "c", "d", "e", "f"]));
    expect(many).toContain("<select");
    expect(many).toContain("<option");
  });

  it("renders number/boolean/date/literal catch-alls to their native elements", () => {
    expect(one(z.number())).toContain('type="number"');
    expect(one(z.boolean())).toContain('type="checkbox"');
    expect(one(z.date())).toContain('type="date"');
    expect(one(z.literal("x"))).toContain('type="hidden"');
  });

  it("does not mark a plain boolean checkbox required (false is valid)", () => {
    expect(one(z.boolean())).not.toContain("required");
  });

  it("emits a bare YYYY-MM-DD for a bounded date's min/max (not an ISO timestamp)", () => {
    const html = one(z.date().min(new Date("2020-01-01")).max(new Date("2021-06-15")));
    expect(html).toContain('min="2020-01-01"');
    expect(html).toContain('max="2021-06-15"');
    expect(html).not.toMatch(/min="[^"]*T/); // no time portion
  });

  it("emits a single valid value for a multi-value literal, not the joined array", () => {
    const html = one(z.literal(["draft", "published", "archived"]));
    expect(html).toContain('value="draft"');
    expect(html).not.toContain("draft,published");
  });

  it("gives a radio group's option ids no collision with a sibling field's id", () => {
    // `fx` option 0 and the `fx_0` control both used to resolve to id="fx__0".
    const html = render(
      introspect(asSchema(z.object({ fx: z.enum(["a", "b"]), fx_0: z.string() })), OPTS),
      htmlRenderer,
    );
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length); // all ids unique
  });

  it("is classless -- no `class` attribute anywhere in the output", () => {
    const html = render(
      introspect(
        asSchema(
          z.object({
            name: z.string(),
            age: z.number(),
            agree: z.boolean(),
            role: z.enum(["a", "b", "c", "d", "e"]),
          }),
        ),
        OPTS,
      ),
      htmlRenderer,
    );
    expect(html).not.toMatch(/\sclass=/);
  });

  it("passes conformance scoped to the leaf shapes", async () => {
    const names = (s: string) => [...s.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    const report = await conformance(htmlRenderer, undefined, {
      names,
      types: SCALARS,
      fuzzCount: 30,
    });
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.coverage.handlerJoinCases).toBeGreaterThan(0);
  });
});
