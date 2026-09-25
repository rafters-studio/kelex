import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import tsdownConfig from "../tsdown.config";

// The published surface is the package.json "exports" map; each subpath is one
// tsdown entry. This pins the two together and keeps internals off every entry.

const entries = (tsdownConfig as { entry: Record<string, string> }).entry;
const subpathOf = (entry: string) => (entry === "index" ? "." : `./${entry}`);
const published = Object.keys(entries).filter((name) => name !== "cli");

// Component selection is the consumer's decision (#155), and target codegen is
// kelex's own business: neither belongs to the public API.
const INTERNAL = ["defaultMappingRules", "findMatchingRule", "resolveField", "generate"];

describe("public surface", () => {
  it("exports exactly one subpath per built entry (the CLI is a bin, not an export)", () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(published.map(subpathOf).sort());
  });

  it.each(published)("the %s entry keeps the mapping module and codegen internal", async (name) => {
    const mod: Record<string, unknown> = await import(
      pathToFileURL(resolve(__dirname, "..", entries[name])).href
    );
    for (const symbol of INTERNAL) expect(mod[symbol], symbol).toBeUndefined();
  });

  it("the engine entry carries the pipeline plugin authors call", async () => {
    const engine: Record<string, unknown> = await import("../src/engine");
    expect(typeof engine.renderForm).toBe("function");
  });
});
