import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/introspection/sha256";

/**
 * Reference digest. node:crypto is used HERE, in the test, deliberately -- the
 * point is to prove the dependency-free implementation agrees with it, so the
 * library can stop importing it. Asserting against hardcoded strings would only
 * prove the implementation matches itself.
 */
function reference(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function agrees(input: string): void {
  expect(sha256Hex(input)).toBe(reference(input));
}

describe("sha256 (#165)", () => {
  it("matches node:crypto on an empty string", () => {
    agrees("");
  });

  it("matches node:crypto on short inputs", () => {
    agrees("a");
    agrees("abc");
    agrees("hello world");
  });

  // The padding boundaries. A message needs a 0x80 byte plus an 8-byte length,
  // so at 56 bytes the length no longer fits in the block and a second block is
  // appended. Implementations that get padding wrong pass every other case and
  // fail exactly here.
  it("matches node:crypto across the 64-byte padding boundary", () => {
    for (const length of [54, 55, 56, 57, 58, 63, 64, 65]) {
      agrees("x".repeat(length));
    }
  });

  it("matches node:crypto across the second block boundary", () => {
    for (const length of [119, 120, 127, 128, 129]) {
      agrees("y".repeat(length));
    }
  });

  it("matches node:crypto on multi-block input", () => {
    agrees("z".repeat(1000));
    agrees(JSON.stringify({ nested: Array.from({ length: 200 }, (_, i) => ({ i })) }));
  });

  // UTF-8 encoding must agree, or any schema with a non-ASCII label or default
  // would hash differently than it did before this change.
  it("matches node:crypto on non-ASCII input", () => {
    agrees("café");
    agrees("日本語のラベル");
    agrees("emoji: \u{1F600}\u{1F680}");
    agrees("combining: é");
  });

  it("matches node:crypto on JSON containing quotes and escapes", () => {
    agrees(JSON.stringify({ a: 'quote " and \\ backslash', b: "newline \n tab \t" }));
  });

  it("produces 64 lowercase hex characters", () => {
    expect(sha256Hex("anything")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic across calls", () => {
    expect(sha256Hex("stable")).toBe(sha256Hex("stable"));
  });

  it("differs for inputs differing by one bit", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });
});
