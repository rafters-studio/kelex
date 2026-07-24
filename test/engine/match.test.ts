import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { matches, matchesEntry, resolveConfig } from "../../src/engine/match";
import type { Entry } from "../../src/engine/types";
import { introspect } from "../../src/introspection";
import type { FieldDescriptor } from "../../src/introspection";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
function fieldOf(schema: Parameters<typeof introspect>[0], name: string): FieldDescriptor {
  const f = introspect(schema, OPTS).fields.find((x) => x.name === name);
  if (!f) throw new Error(`no field ${name}`);
  return f;
}

describe("match engine (#221)", () => {
  it("matches a type-only entry", () => {
    const email = fieldOf(z.object({ email: z.string().email() }), "email");
    expect(matchesEntry(email, { type: "string" })).toBe(true);
    expect(matchesEntry(email, { type: "number" })).toBe(false);
  });

  it("matches on format", () => {
    const email = fieldOf(z.object({ email: z.string().email() }), "email");
    const plain = fieldOf(z.object({ x: z.string() }), "x");
    expect(matchesEntry(email, { type: "string", format: "email" })).toBe(true);
    expect(matchesEntry(plain, { type: "string", format: "email" })).toBe(false);
  });

  it("matches a length bucket, reading length OR maxLength", () => {
    const bio = fieldOf(z.object({ bio: z.string().max(500) }), "bio");
    expect(matchesEntry(bio, { type: "string", maxLength: { gt: 100 } })).toBe(true);
    const code = fieldOf(z.object({ code: z.string().length(6) }), "code");
    expect(matchesEntry(code, { type: "string", maxLength: { lte: 8 } })).toBe(true);
  });

  it("matches a .meta({ ui }) hint", () => {
    const otp = fieldOf(z.object({ otp: z.string().meta({ ui: "otp" }) }), "otp");
    const plain = fieldOf(z.object({ x: z.string() }), "x");
    expect(matchesEntry(otp, { type: "string", ui: "otp" })).toBe(true);
    expect(matchesEntry(plain, { type: "string", ui: "otp" })).toBe(false);
  });

  it("matches an object shape via hasFields", () => {
    const addr = fieldOf(
      z.object({ addr: z.object({ street: z.string(), city: z.string(), zip: z.string() }) }),
      "addr",
    );
    expect(matchesEntry(addr, { type: "object", hasFields: ["street", "city", "zip"] })).toBe(true);
    expect(matchesEntry(addr, { type: "object", hasFields: ["street", "phone"] })).toBe(false);
  });

  it("resolves FIRST-MATCH in inventory order (not specificity)", () => {
    const inv: Entry[] = [
      { match: { type: "string", format: "email" }, component: "email-input" },
      { match: { type: "string" }, component: "text-input" },
    ];
    const email = fieldOf(z.object({ email: z.string().email() }), "email");
    const plain = fieldOf(z.object({ x: z.string() }), "x");
    expect(matches(email, inv)?.component).toBe("email-input");
    expect(matches(plain, inv)?.component).toBe("text-input");
    // reversed: the catch-all now wins for BOTH -- order is precedence.
    expect(matches(email, [...inv].reverse())?.component).toBe("text-input");
  });

  it("resolves a $ref setting from the field's constraints", () => {
    const code = fieldOf(z.object({ code: z.string().length(6) }), "code");
    expect(resolveConfig(code, { maxLength: "$length" })).toEqual({ maxLength: 6 });
    expect(resolveConfig(code, { type: "text" })).toEqual({ type: "text" });
  });

  it("resolves a {ref, default} to the constraint or its default", () => {
    const age = fieldOf(z.object({ age: z.number().min(0).max(120) }), "age");
    expect(resolveConfig(age, { step: { ref: "$step", default: 1 } })).toEqual({ step: 1 });
  });

  it("resolves $values to enum values", () => {
    const role = fieldOf(z.object({ role: z.enum(["a", "b", "c"]) }), "role");
    expect(resolveConfig(role, { options: "$values" })).toEqual({ options: ["a", "b", "c"] });
  });
});
