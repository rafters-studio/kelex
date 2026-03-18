import { describe, expect, it } from "vitest";
import { compositeTarget } from "../../src/targets/composite";
import { reactTanStackTarget } from "../../src/targets/react-tanstack";
import {
  listTargets,
  registerTarget,
  resolveTarget,
} from "../../src/targets/registry";
import type { CodegenTarget } from "../../src/targets/types";

describe("resolveTarget", () => {
  it("resolves react-tanstack target", () => {
    const target = resolveTarget("react-tanstack");
    expect(target).toBe(reactTanStackTarget);
  });

  it("resolves composite target", () => {
    const target = resolveTarget("composite");
    expect(target).toBe(compositeTarget);
  });

  it("throws for unknown target", () => {
    expect(() => resolveTarget("nonexistent")).toThrow("Unknown target");
    expect(() => resolveTarget("nonexistent")).toThrow("nonexistent");
  });

  it("error message lists available targets", () => {
    expect(() => resolveTarget("nope")).toThrow("react-tanstack");
    expect(() => resolveTarget("nope")).toThrow("composite");
  });
});

describe("listTargets", () => {
  it("returns all registered targets", () => {
    const targets = listTargets();
    expect(targets.length).toBeGreaterThanOrEqual(2);
    const names = targets.map((t) => t.name);
    expect(names).toContain("react-tanstack");
    expect(names).toContain("composite");
  });

  it("returns CodegenTarget instances", () => {
    const targets = listTargets();
    for (const target of targets) {
      expect(target.name).toBeDefined();
      expect(target.description).toBeDefined();
      expect(target.defaultExtension).toBeDefined();
      expect(typeof target.generate).toBe("function");
    }
  });
});

describe("registerTarget", () => {
  it("registers a custom target", () => {
    const custom: CodegenTarget = {
      name: "custom-test",
      description: "Custom test target",
      defaultExtension: ".custom",
      generate() {
        return { files: [], fields: [], warnings: [] };
      },
    };

    registerTarget(custom);
    expect(resolveTarget("custom-test")).toBe(custom);
  });
});
