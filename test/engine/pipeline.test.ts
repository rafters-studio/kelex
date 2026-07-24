import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { render } from "../../src/engine/render";
import { renderForm, validateRenderer } from "../../src/engine/pipeline";
import type { Handler, Renderer } from "../../src/engine/types";
import { introspect } from "../../src/introspection";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const d = (schema: Parameters<typeof introspect>[0]) => introspect(schema, OPTS);

// A COMPLETE string renderer: a type-only catch-all for every FieldType.
const complete: Renderer<string> = {
  inventory: [
    { match: { type: "string" }, component: "c" },
    { match: { type: "number" }, component: "c" },
    { match: { type: "boolean" }, component: "c" },
    { match: { type: "date" }, component: "c" },
    { match: { type: "enum" }, component: "c" },
    { match: { type: "literal" }, component: "c" },
    { match: { type: "object" }, component: "g" },
    { match: { type: "tuple" }, component: "g" },
    { match: { type: "array" }, component: "list" },
    { match: { type: "record" }, component: "list" },
    { match: { type: "union" }, component: "ch" },
    { match: { type: "ref" }, component: "rec" },
  ],
  compose: {
    c: (i) => `<c:${i.key}>`,
    g: (i) => (i.shape === "group" ? `<g>${i.children.map((x) => x.rendered).join("")}</g>` : "?"),
    list: (i) => (i.shape === "list" ? `<l>${i.item.rendered}</l>` : "?"),
    ch: (i) =>
      i.shape === "choice"
        ? `<ch>${i.variants.map((v) => v.children.map((x) => x.rendered).join("")).join("")}</ch>`
        : "?",
    rec: (i) => `<rec:${i.key}>`,
  },
  form: (top) => `<form>${top.map((x) => x.rendered).join("")}</form>`,
  fallback: (i) => `<fb:${i.key}>`,
};

describe("renderForm pipeline + floor (#223)", () => {
  it("returns the rendered form when no handler is given", () => {
    const desc = d(z.object({ a: z.string() }));
    expect(renderForm(desc, complete)).toBe(render(desc, complete));
  });

  it("applies the handler to the rendered form, passing the control manifest", () => {
    const handler: Handler<string> = {
      wire: (form, controls) => `${form}|wired:${controls.length}`,
    };
    const desc = d(z.object({ a: z.string(), b: z.number() }));
    expect(renderForm(desc, complete, handler)).toBe(`${render(desc, complete)}|wired:2`);
  });

  it("validateRenderer passes for a complete renderer", () => {
    expect(validateRenderer(complete)).toEqual([]);
  });

  it("floor requires a TYPE-ONLY catch-all -- a constrained entry does not count", () => {
    const partial: Renderer<string> = {
      ...complete,
      inventory: complete.inventory
        .filter((e) => e.match.type !== "string")
        .concat({ match: { type: "string", maxLength: { gt: 100 } }, component: "c" }),
    };
    expect(validateRenderer(partial).some((g) => g.includes('"string"'))).toBe(true);
    expect(() => renderForm(d(z.object({ a: z.string() })), partial)).toThrow(/string/);
  });

  it("floor rejects an inventory entry with no composer", () => {
    const bad: Renderer<string> = {
      ...complete,
      inventory: complete.inventory.concat({
        match: { type: "string", format: "email" },
        component: "missing",
      }),
    };
    expect(validateRenderer(bad).some((g) => g.includes("missing"))).toBe(true);
  });

  it("keeps the old generate export alongside the new renderForm", async () => {
    const mod = await import("../../src/index");
    expect(typeof mod.generate).toBe("function"); // old target pipeline, untouched
    expect(typeof mod.renderForm).toBe("function"); // new engine pipeline
  });
});
