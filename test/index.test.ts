import { describe, expect, it } from "vitest";

describe("public API exports", () => {
  it("exports the generate orchestrator", async () => {
    const mod = await import("../src/index");
    expect(typeof mod.generate).toBe("function");
  });

  it("exports all introspection functions", async () => {
    const mod = await import("../src/index");
    expect(typeof mod.introspect).toBe("function");
    expect(typeof mod.extractConstraints).toBe("function");
    expect(typeof mod.unwrapSchema).toBe("function");
  });

  // Inverted in #155. kelex does not own component selection -- which component
  // renders a field belongs to the consumer, along with the rest of the
  // presentation layer. Exporting the mapping module contradicted that boundary
  // in the one place a consumer would actually discover it, and two render seats
  // caught the mismatch. The module stays in-tree; it is not public API.
  it("does not export the mapping module", async () => {
    const mod = (await import("../src/index")) as Record<string, unknown>;
    expect(mod.defaultMappingRules).toBeUndefined();
    expect(mod.findMatchingRule).toBeUndefined();
    expect(mod.resolveField).toBeUndefined();
  });

  it("exports all schema writer functions", async () => {
    const mod = await import("../src/index");
    expect(typeof mod.emitField).toBe("function");
    expect(typeof mod.writeSchema).toBe("function");
  });

  it("exports all target functions and built-in targets", async () => {
    const mod = await import("../src/index");
    expect(typeof mod.resolveTarget).toBe("function");
    expect(typeof mod.listTargets).toBe("function");
    expect(typeof mod.registerTarget).toBe("function");
    expect(typeof mod.unregisterTarget).toBe("function");
    expect(mod.compositeTarget).toBeDefined();
    expect(mod.compositeTarget.name).toBe("composite");
  });
});
