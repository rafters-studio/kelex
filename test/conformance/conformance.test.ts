import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { conformance } from "../../src/conformance";
import type { FieldType } from "../../src/introspection/types";
import type { Composer, Entry, Input, Renderer } from "../../src/engine/types";

// A minimal COMPLETE renderer whose T is a string. Every FieldType gets a
// type-only catch-all (the floor), and every composer stamps `name="<key>"` so
// the conformance names-reader can find it in the output.
const ALL_TYPES: FieldType[] = [
  "string",
  "number",
  "boolean",
  "date",
  "enum",
  "literal",
  "object",
  "array",
  "union",
  "tuple",
  "record",
  "ref",
];

const COMPONENT: Record<FieldType, string> = {
  string: "control",
  number: "control",
  boolean: "control",
  date: "control",
  enum: "control",
  literal: "control",
  object: "group",
  tuple: "group",
  array: "list",
  record: "list",
  union: "choice",
  ref: "recursive",
};

const inventory: Entry[] = ALL_TYPES.map((type) => ({
  match: { type },
  component: COMPONENT[type],
}));

const kids = (input: Extract<Input<string>, { shape: "group" }>) =>
  input.children.map((c) => c.rendered).join("");

function composers(): Record<string, Composer<string>> {
  return {
    control: (i) => `<control name="${i.key}"/>`,
    group: (i) => (i.shape === "group" ? `<group name="${i.key}">${kids(i)}</group>` : ""),
    list: (i) => (i.shape === "list" ? `<list name="${i.key}">${i.item.rendered}</list>` : ""),
    choice: (i) => {
      if (i.shape !== "choice") return "";
      // A discriminated union's discriminator is the selector, dropped from the
      // variant children by the fold -- so the choice composer stamps it here, at
      // `<key>.<discriminator>`. controlPaths lists it, so path-preservation
      // forces a conforming renderer to actually render the selector.
      const disc = i.field.metadata.kind === "union" ? i.field.metadata.discriminator : undefined;
      const selector = disc ? `<control name="${i.key}.${disc}"/>` : "";
      const variants = i.variants.flatMap((v) => v.children.map((c) => c.rendered)).join("");
      return `<choice name="${i.key}">${selector}${variants}</choice>`;
    },
    recursive: (i) => `<recursive name="${i.key}"/>`,
  };
}

const complete: Renderer<string> = {
  inventory,
  compose: composers(),
  form: (children) => `<form>${children.map((c) => c.rendered).join("")}</form>`,
  fallback: (i) => `<fallback name="${i.key}"/>`,
};

// Reads stamped names out of the string output.
const names = (rendered: string) => [...rendered.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);

describe("conformance -- the contract, proven (#225)", () => {
  it("passes for a complete renderer, running all five invariants", async () => {
    const report = await conformance(complete, undefined, { names, fuzzCount: 20 });
    expect(report.passed).toBe(true);
    expect(report.failures).toEqual([]);
    // AC1: the five invariants ran over battery + fuzz, and handler-join over the battery.
    expect(report.coverage.schemas).toBeGreaterThan(20);
    expect(report.coverage.handlerJoinCases).toBeGreaterThan(0);
    expect(report.coverage.everySchema).toContain("path-preservation");
    expect(report.coverage.batteryOnly).toEqual(["handler-join"]);
    // All five invariants are accounted for -- none silently skipped.
    const ran = [
      ...report.coverage.everySchema,
      ...report.coverage.batteryOnly,
      ...report.coverage.rendererLevel,
    ];
    expect([...ran].sort()).toEqual(
      ["determinism", "floor", "handler-join", "path-preservation", "totality"].sort(),
    );
  });

  it("FAILS naming floor for a renderer missing a type-only catch-all", async () => {
    // Drop the "date" catch-all -- the floor gap.
    const broken: Renderer<string> = {
      ...complete,
      inventory: inventory.filter((e) => e.match.type !== "date"),
    };
    const report = await conformance(broken, undefined, { names, fuzzCount: 5 });
    expect(report.passed).toBe(false);
    expect(report.failures.every((f) => f.invariant === "floor")).toBe(true);
    expect(report.failures.some((f) => f.detail.includes("date"))).toBe(true);
  });

  it("FAILS naming path-preservation for a renderer that drops a field", async () => {
    // A group composer that omits its first child -> a leaf never reaches output.
    const dropped: Renderer<string> = {
      ...complete,
      compose: {
        ...composers(),
        group: (i) =>
          i.shape === "group"
            ? `<group name="${i.key}">${i.children
                .slice(1)
                .map((c) => c.rendered)
                .join("")}</group>`
            : "",
      },
    };
    const report = await conformance(dropped, undefined, { names, fuzzCount: 0 });
    expect(report.passed).toBe(false);
    expect(report.failures.some((f) => f.invariant === "path-preservation")).toBe(true);
  });

  it("FAILS naming path-preservation for a choice composer that omits the selector", async () => {
    // The discriminator (`shape.kind`) is a real control listed by controlPaths
    // but dropped from the variant children -- a choice composer that does not
    // stamp its selector loses it. This locks that implicit contract clause.
    const noSelector: Renderer<string> = {
      ...complete,
      compose: {
        ...composers(),
        choice: (i) =>
          i.shape === "choice"
            ? `<choice name="${i.key}">${i.variants
                .flatMap((v) => v.children.map((c) => c.rendered))
                .join("")}</choice>`
            : "",
      },
    };
    const report = await conformance(noSelector, undefined, { names, fuzzCount: 0 });
    expect(report.passed).toBe(false);
    const pp = report.failures.filter((f) => f.invariant === "path-preservation");
    expect(pp.some((f) => f.detail.includes(".kind"))).toBe(true);
  });

  it("FAILS naming path-preservation for a handler that drops a control", async () => {
    // A handler that strips every stamped name -> the join is lost.
    const stripping = { wire: (form: string) => form.replace(/ name="[^"]+"/g, "") };
    const report = await conformance(complete, stripping, { names, fuzzCount: 3 });
    expect(report.passed).toBe(false);
    expect(report.failures.some((f) => f.invariant === "path-preservation")).toBe(true);
  });

  it("reproduces from a seed -- same seed, same schemas, same verdict", async () => {
    const a = await conformance(complete, undefined, { names, seed: 42, fuzzCount: 10 });
    const b = await conformance(complete, undefined, { names, seed: 42, fuzzCount: 10 });
    expect(a).toEqual(b);
  });

  it("binds real Standard Schema issues from the battery's bad data", async () => {
    // The handler-join battery: bad data on email/nested/array-row/record cases,
    // every issue bound. Proven here directly with one of the battery shapes.
    const schema = z.object({ tags: z.array(z.object({ label: z.string().min(1) })) });
    const result = await schema["~standard"].validate({ tags: [{ label: "" }] });
    expect("issues" in result && result.issues && result.issues.length).toBeTruthy();
    // The full battery is exercised inside conformance; the complete-renderer run
    // above asserts passed === true, i.e. every battery issue bound.
    const report = await conformance(complete, undefined, { names, fuzzCount: 0 });
    expect(report.failures.some((f) => f.invariant === "handler-join")).toBe(false);
  });
});
