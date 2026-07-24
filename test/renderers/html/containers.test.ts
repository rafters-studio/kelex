import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { render, validateRenderer } from "../../../src/engine";
import { conformance } from "../../../src/conformance";
import { introspect } from "../../../src/introspection";
import { createHtmlRenderer, htmlRenderer } from "../../../src/renderers/html";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const asSchema = (s: unknown) => s as Parameters<typeof introspect>[0];
const one = (schema: unknown): string =>
  render(introspect(asSchema(z.object({ f: schema as never })), OPTS), htmlRenderer);

describe("htmlRenderer -- containers, form, buttons (#228)", () => {
  it("renders object/tuple as a labelled fieldset", () => {
    const html = one(z.object({ a: z.string(), b: z.number() }));
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend>");
    expect(html).toContain('name="f.a"');
    expect(html).toContain('name="f.b"');
  });

  it("renders array/record as a repeater -- <template> row + inert add/remove buttons", () => {
    const html = one(z.array(z.object({ label: z.string() })));
    expect(html).toContain('<template data-row="f.*"');
    expect(html).toContain('name="f.*.label"'); // the template row carries the * path
    expect(html).toContain('<button type="button" data-add-row="f"');
    expect(html).toContain('data-remove-row="f"');
    expect(html).not.toContain("<script"); // no event wiring
  });

  it("renders a discriminated union as a switch -- selector stamps the discriminator, tagged panels", () => {
    const html = one(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("circle"), radius: z.number() }),
        z.object({ kind: z.literal("rect"), w: z.number() }),
      ]),
    );
    expect(html).toContain('data-variant-of="f"');
    expect(html).toContain('name="f.kind"'); // discriminator selector control
    expect(html).toContain("data-variant");
    expect(html).toContain('data-when="circle"');
    expect(html).toContain('name="f.radius"');
  });

  it("renders a plain union switch without a discriminator name", () => {
    const html = one(z.union([z.string(), z.number()]));
    expect(html).toContain('data-variant-of="f"');
    expect(html).toContain("data-variant");
  });

  it("all interactivity is inert -- buttons are type=button/submit, no <script>", () => {
    const html = render(
      introspect(asSchema(z.object({ tags: z.array(z.string()) })), OPTS),
      htmlRenderer,
    );
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/on[a-z]+=/); // no inline event handlers
  });

  it("the form composer wraps <form> with the options action + a submit button", () => {
    const withAction = createHtmlRenderer({ action: "/submit" });
    const html = render(introspect(asSchema(z.object({ a: z.string() })), OPTS), withAction);
    expect(html).toContain('<form action="/submit" method="post">');
    expect(html).toContain('<button type="submit">');
    // The default instance posts to the same URL (no action).
    expect(one(z.string())).toContain('<form method="post">');
  });

  it("passes the FULL floor -- a catch-all for every FieldType", () => {
    expect(validateRenderer(htmlRenderer)).toEqual([]);
  });

  it("is classless across containers -- no `class` attribute", () => {
    const html = render(
      introspect(
        asSchema(
          z.object({
            group: z.object({ x: z.string() }),
            list: z.array(z.number()),
            choice: z.union([z.string(), z.number()]),
          }),
        ),
        OPTS,
      ),
      htmlRenderer,
    );
    expect(html).not.toMatch(/\sclass=/);
  });

  it("passes full conformance (renderer-only) over every shape", async () => {
    const names = (s: string) => [...s.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    const report = await conformance(htmlRenderer, undefined, { names, fuzzCount: 40 });
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it("preserves the join through a pass-through handler (a handler must not drop a control)", async () => {
    const names = (s: string) => [...s.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    const passthrough = { wire: (form: string) => form };
    const report = await conformance(htmlRenderer, passthrough, { names, fuzzCount: 10 });
    expect(report.passed).toBe(true);
  });

  it("ships form.css -- a classless stylesheet covering the semantic + aria hooks", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../../../src/renderers/html/form.css", import.meta.url)),
      "utf8",
    );
    for (const sel of [
      "label",
      "input",
      "select",
      "textarea",
      "fieldset",
      "legend",
      "button",
      ":required",
      "[aria-invalid=",
      '[role="alert"]',
      '[role="alert"]:empty',
    ]) {
      expect(css).toContain(sel);
    }
    expect(css).not.toMatch(/\.[a-zA-Z][\w-]*\s*\{/); // no class selectors
  });
});
