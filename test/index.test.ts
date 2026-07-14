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

  it("exports all mapping functions and data", async () => {
    const mod = await import("../src/index");
    expect(Array.isArray(mod.defaultMappingRules)).toBe(true);
    expect(typeof mod.findMatchingRule).toBe("function");
    expect(typeof mod.resolveField).toBe("function");
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
