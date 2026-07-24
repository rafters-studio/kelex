import { describe, expect, it } from "vitest";
import { pathToId } from "../../../src/renderers/html/path-id";

describe("pathToId -- injective, valid HTML id (#226)", () => {
  it("produces a valid HTML id (no dots, no `*`) from any path", () => {
    expect(pathToId("home.zip")).not.toMatch(/[.*]/);
    expect(pathToId("tags.*.label")).not.toMatch(/[.*]/);
    expect(pathToId("tags.*.label")).toMatch(/^[A-Za-z0-9_]+$/);
  });

  it("is injective -- collision-prone paths map to distinct ids", () => {
    // The naive `.`->`-`, `*`->`_` scheme collides on these; the escape must not.
    const pairs = [
      ["first.name", "first-name"],
      ["first.name", "first_name"],
      ["a.b", "a*b"],
      ["a_b", "a.b"],
      ["x-y", "x.y"],
    ];
    for (const [p, q] of pairs) {
      expect(pathToId(p)).not.toBe(pathToId(q));
    }
  });

  it("keeps the literal path as `name` while `id` is the encoded form -- both key one control", () => {
    const key = "tags.*.label";
    // name is the raw path (the join key); id is its encoding.
    expect(pathToId(key)).not.toBe(key);
    // Distinct paths never share an id, so id -> control is unambiguous.
    expect(pathToId("a.b.c")).not.toBe(pathToId("a.b"));
  });
});
