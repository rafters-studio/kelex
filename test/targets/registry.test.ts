import { afterEach, describe, expect, it } from "vitest";
import { compositeTarget } from "../../src/targets/composite";
import {
  listTargets,
  registerTarget,
  resolveTarget,
  unregisterTarget,
} from "../../src/targets/registry";
import type { CodegenTarget } from "../../src/targets/types";

const customTarget: CodegenTarget = {
  name: "custom-test",
  description: "Custom test target",
  defaultExtension: ".custom",
  generate() {
    return {
      files: [{ filename: "test.custom", content: "" }],
      fields: [],
      warnings: [],
    };
  },
};

afterEach(() => {
  unregisterTarget("custom-test");
});

describe("resolveTarget", () => {
  it("resolves composite target", () => {
    const target = resolveTarget("composite");
    expect(target).toBe(compositeTarget);
  });

  it("throws for unknown target", () => {
    expect(() => resolveTarget("nonexistent")).toThrow("Unknown target");
    expect(() => resolveTarget("nonexistent")).toThrow("nonexistent");
  });

  it("error message lists available targets", () => {
    expect(() => resolveTarget("nope")).toThrow("composite");
  });
});

describe("listTargets", () => {
  it("returns all registered targets", () => {
    const targets = listTargets();
    expect(targets.length).toBeGreaterThanOrEqual(1);
    const names = targets.map((t) => t.name);
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
    registerTarget(customTarget);
    expect(resolveTarget("custom-test")).toBe(customTarget);
  });

  it("throws when registering a name that already exists", () => {
    expect(() => registerTarget(compositeTarget)).toThrow("already registered");
  });

  it("allows overwrite with force option", () => {
    registerTarget(customTarget);
    const replacement: CodegenTarget = {
      ...customTarget,
      description: "Replaced",
    };
    registerTarget(replacement, { force: true });
    expect(resolveTarget("custom-test").description).toBe("Replaced");
  });
});

describe("unregisterTarget", () => {
  it("removes a registered target", () => {
    registerTarget(customTarget);
    unregisterTarget("custom-test");
    expect(() => resolveTarget("custom-test")).toThrow("Unknown target");
  });

  it("is a no-op for unknown names", () => {
    expect(() => unregisterTarget("nonexistent")).not.toThrow();
  });

  it("throws when removing a built-in target", () => {
    expect(() => unregisterTarget("composite")).toThrow("Cannot unregister built-in");
  });
});
